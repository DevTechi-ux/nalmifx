import Challenge from '../models/Challenge.js'
import ChallengeAccount from '../models/ChallengeAccount.js'
import PropSettings from '../models/PropSettings.js'
import Trade from '../models/Trade.js'
import User from '../models/User.js'
import Charges from '../models/Charges.js'
import { sendTemplateEmail } from '../services/emailService.js'

class PropTradingEngine {
  constructor() {
    this.ERROR_CODES = {
      CHALLENGE_MODE_DISABLED: 'CHALLENGE_MODE_DISABLED',
      CHALLENGE_NOT_FOUND: 'CHALLENGE_NOT_FOUND',
      ACCOUNT_NOT_ACTIVE: 'ACCOUNT_NOT_ACTIVE',
      ACCOUNT_FAILED: 'ACCOUNT_FAILED',
      ACCOUNT_EXPIRED: 'ACCOUNT_EXPIRED',
      SL_MANDATORY: 'SL_MANDATORY',
      MAX_TRADES_PER_DAY: 'MAX_TRADES_PER_DAY',
      MAX_CONCURRENT_TRADES: 'MAX_CONCURRENT_TRADES',
      SYMBOL_NOT_ALLOWED: 'SYMBOL_NOT_ALLOWED',
      SEGMENT_NOT_ALLOWED: 'SEGMENT_NOT_ALLOWED',
      MAX_LOSS_PER_TRADE: 'MAX_LOSS_PER_TRADE',
      MIN_HOLD_TIME: 'MIN_HOLD_TIME',
      DAILY_DRAWDOWN_BREACH: 'DAILY_DRAWDOWN_BREACH',
      OVERALL_DRAWDOWN_BREACH: 'OVERALL_DRAWDOWN_BREACH',
      INSUFFICIENT_MARGIN: 'INSUFFICIENT_MARGIN'
    }
  }

  // Check if challenge mode is enabled
  async isChallengeEnabled() {
    const settings = await PropSettings.getSettings()
    return settings.challengeModeEnabled
  }

  // Create challenge account after payment
  async createChallengeAccount(userId, challengeId, paymentId = null) {
    const challenge = await Challenge.findById(challengeId)
    if (!challenge || !challenge.isActive) {
      throw new Error('Challenge not found or inactive')
    }

    const accountId = await ChallengeAccount.generateAccountId('CH')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (challenge.rules.challengeExpiryDays || 30))

    // Use the challenge's declared stepsCount as totalPhases verbatim. A
    // silent `|| 2` fallback let CH196289 end up with totalPhases=2 while
    // the challenge it pointed at had stepsCount=0/null — checkProfitTarget
    // then refused to advance.
    const stepsCount = Number.isFinite(challenge.stepsCount) ? challenge.stepsCount : 2
    const account = await ChallengeAccount.create({
      userId,
      challengeId,
      accountId,
      accountType: 'CHALLENGE',
      currentPhase: 1,
      totalPhases: stepsCount,
      status: 'ACTIVE',
      initialBalance: challenge.fundSize,
      currentBalance: challenge.fundSize,
      currentEquity: challenge.fundSize,
      phaseStartBalance: challenge.fundSize,
      dayStartEquity: challenge.fundSize,
      lowestEquityToday: challenge.fundSize,
      lowestEquityOverall: challenge.fundSize,
      highestEquity: challenge.fundSize,
      paymentId,
      paymentStatus: paymentId ? 'COMPLETED' : 'PENDING',
      profitSplitPercent: challenge.fundedSettings?.profitSplitPercent || 80,
      expiresAt
    })

    return account
  }

  // Validate trade open request for challenge account
  async validateTradeOpen(challengeAccountId, tradeParams) {
    const account = await ChallengeAccount.findById(challengeAccountId)
      .populate('challengeId')
    
    if (!account) {
      return { valid: false, error: 'Challenge account not found', code: 'ACCOUNT_NOT_FOUND' }
    }

    const challenge = account.challengeId
    const rules = challenge.rules

    // Check account status
    if (account.status === 'FAILED') {
      return { valid: false, error: 'Challenge account has failed', code: this.ERROR_CODES.ACCOUNT_FAILED }
    }
    if (account.status === 'EXPIRED') {
      return { valid: false, error: 'Challenge has expired', code: this.ERROR_CODES.ACCOUNT_EXPIRED }
    }
    if (account.status !== 'ACTIVE' && account.status !== 'FUNDED') {
      return { valid: false, error: 'Challenge account is not active', code: this.ERROR_CODES.ACCOUNT_NOT_ACTIVE }
    }

    // Check expiry
    if (new Date() > account.expiresAt) {
      account.status = 'EXPIRED'
      await account.save()
      return { valid: false, error: 'Challenge has expired', code: this.ERROR_CODES.ACCOUNT_EXPIRED }
    }

    // Check stop loss mandatory
    if (rules.stopLossMandatory && !tradeParams.sl && !tradeParams.stopLoss) {
      return { 
        valid: false, 
        error: 'Stop Loss is mandatory for this challenge', 
        code: this.ERROR_CODES.SL_MANDATORY,
        uiAction: 'SHOW_SL_POPUP'
      }
    }

    // Check max trades per day
    if (rules.maxTradesPerDay && account.tradesToday >= rules.maxTradesPerDay) {
      return { 
        valid: false, 
        error: `Maximum ${rules.maxTradesPerDay} trades per day allowed`, 
        code: this.ERROR_CODES.MAX_TRADES_PER_DAY,
        uiAction: 'DISABLE_TRADE_BUTTON'
      }
    }

    // Check max concurrent trades
    if (rules.maxConcurrentTrades && account.openTradesCount >= rules.maxConcurrentTrades) {
      return { 
        valid: false, 
        error: `Maximum ${rules.maxConcurrentTrades} concurrent trades allowed`, 
        code: this.ERROR_CODES.MAX_CONCURRENT_TRADES,
        uiAction: 'DISABLE_TRADE_BUTTON'
      }
    }

    // Check allowed symbols - only validate if explicitly set and not empty
    // If allowedSymbols is not set or empty, allow all symbols
    if (rules.allowedSymbols && Array.isArray(rules.allowedSymbols) && rules.allowedSymbols.length > 0) {
      if (!rules.allowedSymbols.includes(tradeParams.symbol)) {
        return { 
          valid: false, 
          error: `Symbol ${tradeParams.symbol} is not allowed for this challenge`, 
          code: this.ERROR_CODES.SYMBOL_NOT_ALLOWED,
          uiAction: 'SHOW_SYMBOL_WARNING'
        }
      }
    }
    // If no symbols specified, all symbols are allowed by default

    // Check allowed segments - only validate if explicitly set and not empty
    // If allowedSegments is not set or empty, allow all segments
    if (rules.allowedSegments && Array.isArray(rules.allowedSegments) && rules.allowedSegments.length > 0) {
      // Map frontend segment names to database values
      const segmentMapping = {
        'Forex': 'FOREX',
        'Crypto': 'CRYPTO',
        'Metals': 'COMMODITIES',
        'Stocks': 'STOCKS',
        'Indices': 'INDICES',
        'FOREX': 'FOREX',
        'CRYPTO': 'CRYPTO',
        'COMMODITIES': 'COMMODITIES',
        'STOCKS': 'STOCKS',
        'INDICES': 'INDICES'
      }
      const mappedSegment = segmentMapping[tradeParams.segment] || tradeParams.segment?.toUpperCase()
      
      if (!rules.allowedSegments.includes(mappedSegment)) {
        return { 
          valid: false, 
          error: `Segment ${tradeParams.segment} is not allowed for this challenge`, 
          code: this.ERROR_CODES.SEGMENT_NOT_ALLOWED,
          uiAction: 'SHOW_SEGMENT_WARNING'
        }
      }
    }
    // If no segments specified, all segments are allowed by default

    // Check max loss per trade (if SL is set)
    const stopLossValue = tradeParams.sl || tradeParams.stopLoss
    if (stopLossValue && rules.maxLossPerTradePercent) {
      const potentialLoss = this.calculatePotentialLoss({ ...tradeParams, stopLoss: stopLossValue })
      const maxLossAmount = (rules.maxLossPerTradePercent / 100) * account.currentEquity
      
      if (potentialLoss > maxLossAmount) {
        return { 
          valid: false, 
          error: `Potential loss exceeds ${rules.maxLossPerTradePercent}% limit. Adjust your stop loss.`, 
          code: this.ERROR_CODES.MAX_LOSS_PER_TRADE,
          uiAction: 'SHOW_LOSS_WARNING',
          maxAllowedLoss: maxLossAmount
        }
      }
    }

    // Check margin
    const marginRequired = this.calculateMargin(tradeParams, account)
    if (marginRequired > account.currentEquity * 0.9) {
      return { 
        valid: false, 
        error: 'Insufficient margin for this trade', 
        code: this.ERROR_CODES.INSUFFICIENT_MARGIN,
        uiAction: 'SHOW_MARGIN_WARNING'
      }
    }

    return { valid: true, account, challenge }
  }

  // Calculate execution price with spread
  // For FIXED spread: value is in PIPS (needs conversion based on symbol)
  // For PERCENTAGE spread: value is percentage of price difference
  calculateExecutionPrice(side, bid, ask, spreadValue, spreadType, symbol = '') {
    let spread = 0
    
    if (spreadType === 'PERCENTAGE') {
      spread = (ask - bid) * (spreadValue / 100)
    } else {
      // FIXED spread - value is in PIPS, need to convert to price
      const isJPYPair = symbol.includes('JPY')
      const isMetal = ['XAUUSD', 'XAGUSD'].includes(symbol)
      const isCrypto = ['BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD', 'BCHUSD'].includes(symbol)
      
      if (isCrypto) {
        spread = spreadValue || 0
      } else if (isMetal) {
        spread = (spreadValue || 0) * 0.01
      } else if (isJPYPair) {
        spread = (spreadValue || 0) * 0.01
      } else {
        spread = (spreadValue || 0) * 0.0001
      }
    }
    
    if (side === 'BUY') {
      return ask + spread
    } else {
      return bid - spread
    }
  }

  // Calculate commission
  calculateCommission(quantity, price, commissionType, commissionValue, contractSize) {
    if (commissionType === 'FIXED') {
      return commissionValue
    } else if (commissionType === 'PER_LOT') {
      return quantity * commissionValue
    } else if (commissionType === 'PERCENTAGE') {
      const tradeValue = quantity * contractSize * price
      return tradeValue * (commissionValue / 100)
    }
    return 0
  }

  // Open a trade for challenge account
  async openChallengeTrade(userId, challengeAccountId, tradeParams) {
    const account = await ChallengeAccount.findById(challengeAccountId)
      .populate('challengeId')
    
    if (!account) {
      throw new Error('Challenge account not found')
    }

    const challenge = account.challengeId
    const rules = challenge.rules

    const { symbol, segment, side, orderType, quantity, bid, ask, sl, tp, pendingPrice } = tradeParams
    const isPending = orderType && orderType !== 'MARKET'

    // MT5-style SL/TP validation
    // For pending orders, validate against the user's entry price (not current market)
    if (sl || tp) {
      const refBid = isPending ? pendingPrice : bid
      const refAsk = isPending ? pendingPrice : ask
      if (side === 'BUY') {
        if (sl && sl >= refBid) {
          throw new Error(`Invalid Stop Loss. For BUY trades, SL (${sl}) must be below ${isPending ? 'entry price' : 'current price'} (${refBid})`)
        }
        if (tp && tp <= refBid) {
          throw new Error(`Invalid Take Profit. For BUY trades, TP (${tp}) must be above ${isPending ? 'entry price' : 'current price'} (${refBid})`)
        }
      } else {
        if (sl && sl <= refAsk) {
          throw new Error(`Invalid Stop Loss. For SELL trades, SL (${sl}) must be above ${isPending ? 'entry price' : 'current price'} (${refAsk})`)
        }
        if (tp && tp >= refAsk) {
          throw new Error(`Invalid Take Profit. For SELL trades, TP (${tp}) must be below ${isPending ? 'entry price' : 'current price'} (${refAsk})`)
        }
      }
    }

    // Get charges for this trade (use default charges for challenge accounts)
    const charges = await Charges.getChargesForTrade(userId, symbol, segment || 'Forex', null)

    // Calculate execution price with spread
    // For MARKET orders: use current bid/ask + spread
    // For pending orders: openPrice is the user's entry price; actual fill is applied later
    const openPrice = isPending
      ? pendingPrice
      : this.calculateExecutionPrice(side, bid, ask, charges.spreadValue, charges.spreadType, symbol)

    // Get contract size based on symbol
    const contractSize = this.getContractSize(symbol)
    
    // Calculate margin
    const leverage = rules.maxLeverage || 100
    const marginRequired = (quantity * contractSize * openPrice) / leverage

    // Calculate commission on open
    let commission = 0
    const shouldChargeCommission = (side === 'BUY' && charges.commissionOnBuy !== false) || 
                                   (side === 'SELL' && charges.commissionOnSell !== false)
    if (shouldChargeCommission && charges.commissionValue > 0) {
      commission = this.calculateCommission(quantity, openPrice, charges.commissionType, charges.commissionValue, contractSize)
    }

    // Generate trade ID
    const tradeId = `CH${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Create trade
    const trade = await Trade.create({
      userId,
      tradingAccountId: challengeAccountId,
      accountType: 'ChallengeAccount',
      isChallengeAccount: true,
      tradeId,
      symbol,
      segment: segment || 'Forex',
      side,
      orderType,
      quantity,
      openPrice,
      currentPrice: openPrice,
      marginUsed: marginRequired,
      contractSize,
      leverage: leverage,
      spread: charges.spreadValue || 0,
      status: isPending ? 'PENDING' : 'OPEN',
      pendingPrice: isPending ? pendingPrice : null,
      openedAt: new Date(),
      sl: sl || null,
      tp: tp || null,
      stopLoss: sl || null,
      takeProfit: tp || null,
      commission,
      swap: 0
    })

    // Update challenge account stats only when the trade actually opens
    // (pending orders defer this until checkPendingOrders triggers execution)
    if (!isPending) {
      await this.onTradeOpened(challengeAccountId, trade)
    }

    return trade
  }

  // Get contract size based on symbol
  getContractSize(symbol) {
    if (symbol === 'XAUUSD') return 100
    if (symbol === 'XAGUSD') return 5000
    if (['BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD', 'BCHUSD'].includes(symbol)) return 1
    return 100000
  }

  // Validate trade close request
  async validateTradeClose(challengeAccountId, tradeId) {
    const account = await ChallengeAccount.findById(challengeAccountId)
      .populate('challengeId')
    
    if (!account) {
      return { valid: false, error: 'Challenge account not found' }
    }

    const challenge = account.challengeId
    const rules = challenge.rules
    const trade = await Trade.findById(tradeId)

    if (!trade) {
      return { valid: false, error: 'Trade not found' }
    }

    // Check minimum hold time
    if (rules.minTradeHoldTimeSeconds > 0) {
      const holdTime = (Date.now() - new Date(trade.openedAt).getTime()) / 1000
      
      if (holdTime < rules.minTradeHoldTimeSeconds) {
        const remainingSeconds = Math.ceil(rules.minTradeHoldTimeSeconds - holdTime)
        return { 
          valid: false, 
          error: `Minimum hold time not met. Wait ${remainingSeconds} more seconds.`, 
          code: this.ERROR_CODES.MIN_HOLD_TIME,
          uiAction: 'DISABLE_CLOSE_BUTTON',
          remainingSeconds,
          canCloseAt: new Date(new Date(trade.openedAt).getTime() + rules.minTradeHoldTimeSeconds * 1000)
        }
      }
    }

    return { valid: true, account, trade }
  }

  // Called after trade opens
  async onTradeOpened(challengeAccountId, trade) {
    const account = await ChallengeAccount.findById(challengeAccountId)
    if (!account) return

    account.openTradesCount += 1
    account.tradesToday += 1
    account.totalTrades += 1
    
    // Check if new trading day
    const today = new Date().toDateString()
    const lastDay = account.lastTradingDay ? account.lastTradingDay.toDateString() : null
    
    if (today !== lastDay) {
      account.tradingDaysCount += 1
      account.lastTradingDay = new Date()
      account.tradesToday = 1
      account.dayStartEquity = account.currentEquity
      account.lowestEquityToday = account.currentEquity
    }

    await account.save()
    return account
  }

  // Called after trade closes - CRITICAL for rule enforcement
  async onTradeClosed(challengeAccountId, trade, closePnL, priceCache = null) {
    const account = await ChallengeAccount.findById(challengeAccountId)
      .populate('challengeId')

    if (!account) return null

    const challenge = account.challengeId
    const rules = challenge.rules

    // Apply P&L. Clamp the persisted balance at zero — a challenge account's
    // balance must never go negative. The equity-zero stop below catches any
    // close that drives the balance to (or past) zero.
    const newBalance = account.currentBalance + closePnL
    const balanceWouldGoNegative = newBalance < 0
    account.currentBalance = Math.max(0, newBalance)
    account.currentEquity = account.currentBalance
    account.openTradesCount = Math.max(0, account.openTradesCount - 1)

    // Update equity tracking (drawdown / profit % / lowest-equity)
    await account.updateEquity(account.currentEquity)

    // PASSED / FAILED / EXPIRED accounts skip further risk checks. ACTIVE
    // *and* FUNDED accounts must still enforce drawdown — funded accounts
    // especially, since they're trading the firm's money.
    if (account.status !== 'ACTIVE' && account.status !== 'FUNDED') {
      await account.save()
      return { account, failed: false }
    }

    // ---- Equity-zero stop-out ----
    // If this close just brought equity to zero (or the loss would have
    // driven it below zero), fail the account and force-close any remaining
    // open positions so they can't accumulate further losses.
    if (account.currentEquity <= 0 || balanceWouldGoNegative) {
      account.status = 'FAILED'
      account.failedAt = new Date()
      account.failReason = 'Equity reached zero (stop-out)'
      account.violations.push({
        rule: 'EQUITY_ZERO_STOP_OUT',
        description: 'Account equity reached zero — all open positions force-closed',
        severity: 'FAIL',
        timestamp: new Date()
      })
      await account.save()
      await this.forceCloseAllOpenTrades(account, priceCache, 'STOP_OUT')
      return { account, failed: true, reason: 'Equity reached zero' }
    }

    // ---- Drawdown breach ----
    // Runs for both ACTIVE challenges and FUNDED accounts. When breached,
    // checkDrawdownBreach sets status='FAILED'; we also force-close opens.
    const drawdownCheck = await this.checkDrawdownBreach(account, rules)
    if (drawdownCheck.breached) {
      await this.forceCloseAllOpenTrades(account, priceCache, 'DRAWDOWN_BREACH')
      return { account, failed: true, reason: drawdownCheck.reason }
    }

    // ---- Profit target / phase progression — only for ACTIVE challenges ----
    if (account.status === 'ACTIVE') {
      const profitCheck = await this.checkProfitTarget(account, challenge)
      if (profitCheck.targetReached) {
        return { account, phaseCompleted: true, nextPhase: profitCheck.nextPhase }
      }
    }

    await account.save()
    return { account, failed: false }
  }

  // Force-close every open trade on a challenge/funded account. Called when
  // the account has just been failed (equity-zero or drawdown breach) so the
  // remaining positions don't continue to bleed.
  //   priceLookup: a Map-like with .get(symbol) → {bid, ask} OR an object map.
  async forceCloseAllOpenTrades(account, priceLookup = null, reason = 'STOP_OUT') {
    const openTrades = await Trade.find({ tradingAccountId: account._id, status: 'OPEN' })
    if (openTrades.length === 0) return []

    const getPx = (symbol) => {
      if (!priceLookup) return null
      if (typeof priceLookup.get === 'function') return priceLookup.get(symbol)
      return priceLookup[symbol] || null
    }

    const closed = []
    for (const trade of openTrades) {
      const px = getPx(trade.symbol)
      // If no live price, fall back to openPrice (zero raw P&L on this leg)
      const closePrice = trade.side === 'BUY'
        ? (px?.bid ?? trade.openPrice)
        : (px?.ask ?? trade.openPrice)
      const rawPnl = trade.side === 'BUY'
        ? (closePrice - trade.openPrice) * trade.quantity * trade.contractSize
        : (trade.openPrice - closePrice) * trade.quantity * trade.contractSize
      const realizedPnl = rawPnl - (trade.commission || 0) - (trade.swap || 0)

      // Atomic claim so a concurrent close can't double-apply the P&L
      const claimed = await Trade.findOneAndUpdate(
        { _id: trade._id, status: 'OPEN' },
        { status: 'CLOSED', closePrice, closedAt: new Date(), closedBy: reason, realizedPnl },
        { new: true }
      )
      if (!claimed) continue

      // Apply to account balance, clamped at zero
      account.currentBalance = Math.max(0, account.currentBalance + realizedPnl)
      account.currentEquity = account.currentBalance
      account.openTradesCount = Math.max(0, account.openTradesCount - 1)
      closed.push(claimed)
    }
    await account.save()
    return closed
  }

  // Real-time equity update (called on price changes). When floating-equity
  // alone breaches drawdown (no close has happened yet), we still need to
  // fail the account *and* force-close every open trade — otherwise the
  // floating loss keeps growing and the persisted balance never reflects it.
  async updateRealTimeEquity(challengeAccountId, newEquity, priceCache = null) {
    const account = await ChallengeAccount.findById(challengeAccountId)
      .populate('challengeId')

    if (!account || (account.status !== 'ACTIVE' && account.status !== 'FUNDED')) return null

    const rules = account.challengeId.rules

    // Update equity tracking from the live (floating) equity
    await account.updateEquity(newEquity)

    // Equity-zero stop-out from live floating equity. Force-close every open
    // trade at the current market so the persisted balance is finalised at
    // zero and no further losses can accumulate.
    if (newEquity <= 0) {
      account.status = 'FAILED'
      account.failedAt = new Date()
      account.failReason = 'Equity reached zero (stop-out)'
      account.violations.push({
        rule: 'EQUITY_ZERO_STOP_OUT',
        description: 'Account equity reached zero — all open positions force-closed',
        severity: 'FAIL',
        timestamp: new Date()
      })
      await account.save()
      await this.forceCloseAllOpenTrades(account, priceCache, 'STOP_OUT')
      return { account, breached: true, reason: 'Equity reached zero', code: 'EQUITY_ZERO_STOP_OUT' }
    }

    // Check for immediate drawdown breach (sets status='FAILED' inside)
    const drawdownCheck = await this.checkDrawdownBreach(account, rules)
    if (drawdownCheck.breached) {
      // Force-close opens so the realised balance lines up with the breach
      await this.forceCloseAllOpenTrades(account, priceCache, 'DRAWDOWN_BREACH')
      return {
        account,
        breached: true,
        reason: drawdownCheck.reason,
        code: drawdownCheck.code
      }
    }

    return {
      account,
      breached: false,
      dailyDrawdown: account.currentDailyDrawdownPercent,
      overallDrawdown: account.currentOverallDrawdownPercent,
      profitPercent: account.currentProfitPercent
    }
  }

  // Check drawdown breach
  async checkDrawdownBreach(account, rules) {
    let breachReason = null
    let breachCode = null

    // Daily drawdown check
    if (rules.maxDailyDrawdownPercent) {
      if (account.currentDailyDrawdownPercent >= rules.maxDailyDrawdownPercent) {
        breachReason = `Daily drawdown limit (${rules.maxDailyDrawdownPercent}%) exceeded`
        breachCode = this.ERROR_CODES.DAILY_DRAWDOWN_BREACH
        await account.addViolation(
          'DAILY_DRAWDOWN_BREACH',
          `Daily drawdown of ${account.currentDailyDrawdownPercent.toFixed(2)}% exceeded limit of ${rules.maxDailyDrawdownPercent}%`,
          'FAIL'
        )
      }
    }

    // Overall drawdown check
    if (!breachReason && rules.maxOverallDrawdownPercent) {
      if (account.currentOverallDrawdownPercent >= rules.maxOverallDrawdownPercent) {
        breachReason = `Overall drawdown limit (${rules.maxOverallDrawdownPercent}%) exceeded`
        breachCode = this.ERROR_CODES.OVERALL_DRAWDOWN_BREACH
        await account.addViolation(
          'OVERALL_DRAWDOWN_BREACH',
          `Overall drawdown of ${account.currentOverallDrawdownPercent.toFixed(2)}% exceeded limit of ${rules.maxOverallDrawdownPercent}%`,
          'FAIL'
        )
      }
    }

    // If breached, fail the account and send email
    if (breachReason) {
      account.status = 'FAILED'
      account.failedAt = new Date()
      account.failReason = breachReason
      await account.save()

      // Send failure email
      try {
        const user = await User.findById(account.userId)
        const challenge = await Challenge.findById(account.challengeId._id || account.challengeId)
        if (user && challenge) {
          await sendTemplateEmail('challenge_failed', user.email, {
            firstName: user.firstName || user.email.split('@')[0],
            challengeName: challenge.name,
            fundSize: `$${challenge.fundSize.toLocaleString()}`,
            accountId: account.accountId,
            failureReason: breachReason,
            failureDate: account.failedAt.toLocaleDateString(),
            platformName: 'NalmiFX',
            loginUrl: 'http://localhost:5173/login',
            supportEmail: 'support@nalmifx.com',
            year: new Date().getFullYear().toString()
          })
          console.log(`Challenge failure email sent to ${user.email} for drawdown breach`)
        }
      } catch (emailError) {
        console.error('Failed to send challenge failure email:', emailError)
      }

      return { 
        breached: true, 
        reason: breachReason,
        code: breachCode
      }
    }

    return { breached: false }
  }

  // Check profit target for phase progression
  async checkProfitTarget(account, challenge) {
    const rules = challenge.rules

    // Only ACTIVE challenge accounts can progress / pass. Once an account is
    // PASSED / FUNDED / FAILED / EXPIRED it must never re-trigger funding —
    // this is what previously caused a second funded account to be created
    // when another trade closed after the target was already hit.
    if (account.status !== 'ACTIVE') {
      return { targetReached: false }
    }

    // Zero-phase (instant fund) or funded accounts have no profit target.
    // IMPORTANT: read this from the account (totalPhases), not from the
    // parent challenge (stepsCount). The challenge config can drift after
    // an account is opened, but the account's own totalPhases is what its
    // lifecycle was set up with. Reading challenge.stepsCount caused 2-step
    // accounts to silently never progress when the challenge config was
    // misconfigured (CH196289 cleared phase 1 at +20% but stayed on phase 1).
    if ((account.totalPhases || 0) === 0 || account.accountType === 'FUNDED') {
      return { targetReached: false }
    }

    let targetPercent = 0
    if (account.currentPhase === 1) {
      targetPercent = rules.profitTargetPhase1Percent || 8
    } else if (account.currentPhase === 2) {
      targetPercent = rules.profitTargetPhase2Percent || 5
    } else {
      // Higher phases (rare, defensive). Fall back to phase-2 target.
      targetPercent = rules.profitTargetPhase2Percent || 5
    }

    if (account.currentProfitPercent >= targetPercent) {
      // Check if any violations
      if (account.violations.some(v => v.severity === 'FAIL')) {
        return { targetReached: false }
      }

      // Phase completed
      if (account.currentPhase < account.totalPhases) {
        // Move to next phase
        account.currentPhase += 1
        account.phaseStartBalance = account.currentEquity
        account.currentProfitPercent = 0
        account.currentDailyDrawdownPercent = 0
        account.maxDailyDrawdownHit = 0
        await account.save()
        
        return { targetReached: true, nextPhase: account.currentPhase, funded: false }
      } else {
        // Challenge passed - create funded account
        account.status = 'PASSED'
        account.passedAt = new Date()
        await account.save()
        
        // Send completion email
        try {
          const user = await User.findById(account.userId)
          if (user) {
            await sendTemplateEmail('challenge_completed', user.email, {
              firstName: user.firstName || user.email.split('@')[0],
              challengeName: challenge.name,
              fundSize: `$${challenge.fundSize.toLocaleString()}`,
              accountId: account.accountId,
              completionDate: account.passedAt.toLocaleDateString(),
              platformName: 'NalmiFX',
              loginUrl: 'http://localhost:5173/login',
              supportEmail: 'support@nalmifx.com',
              year: new Date().getFullYear().toString()
            })
          }
        } catch (emailError) {
          console.error('Failed to send challenge completion email:', emailError)
        }
        
        // Create funded account
        const fundedAccount = await this.createFundedAccount(account)
        
        return { targetReached: true, funded: true, fundedAccount }
      }
    }

    return { targetReached: false }
  }

  // Create funded account after passing challenge
  async createFundedAccount(challengeAccount) {
    // Idempotency guard — if this challenge account already spawned a funded
    // account, return the existing one instead of creating a duplicate.
    if (challengeAccount.fundedAccountId) {
      const existing = await ChallengeAccount.findById(challengeAccount.fundedAccountId)
      if (existing) {
        console.log(`[Funded] Challenge ${challengeAccount.accountId} already has funded account ${existing.accountId} — skipping duplicate creation`)
        return existing
      }
    }

    const challenge = await Challenge.findById(challengeAccount.challengeId)
    const accountId = await ChallengeAccount.generateAccountId('FND')
    
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1) // Funded accounts last 1 year

    const fundedAccount = await ChallengeAccount.create({
      userId: challengeAccount.userId,
      challengeId: challengeAccount.challengeId,
      accountId,
      accountType: 'FUNDED',
      currentPhase: 0,
      totalPhases: 0,
      status: 'FUNDED',
      initialBalance: challenge.fundSize,
      currentBalance: challenge.fundSize,
      currentEquity: challenge.fundSize,
      phaseStartBalance: challenge.fundSize,
      dayStartEquity: challenge.fundSize,
      lowestEquityToday: challenge.fundSize,
      lowestEquityOverall: challenge.fundSize,
      highestEquity: challenge.fundSize,
      profitSplitPercent: challenge.fundedSettings?.profitSplitPercent || 80,
      paymentStatus: 'COMPLETED',
      expiresAt
    })

    // Link to original challenge account
    challengeAccount.fundedAccountId = fundedAccount._id
    await challengeAccount.save()

    return fundedAccount
  }

  // Admin actions
  async forcePass(challengeAccountId, adminId) {
    const account = await ChallengeAccount.findById(challengeAccountId)
    if (!account) throw new Error('Account not found')

    account.status = 'PASSED'
    account.passedAt = new Date()
    account.violations.push({
      rule: 'ADMIN_FORCE_PASS',
      description: `Forced pass by admin ${adminId}`,
      severity: 'WARNING'
    })
    await account.save()

    // Send completion email
    try {
      const user = await User.findById(account.userId)
      const challenge = await Challenge.findById(account.challengeId)
      if (user && challenge) {
        await sendTemplateEmail('challenge_completed', user.email, {
          firstName: user.firstName || user.email.split('@')[0],
          challengeName: challenge.name,
          fundSize: `$${challenge.fundSize.toLocaleString()}`,
          accountId: account.accountId,
          completionDate: account.passedAt.toLocaleDateString(),
          platformName: 'NalmiFX',
          loginUrl: 'http://localhost:5173/login',
          supportEmail: 'support@nalmifx.com',
          year: new Date().getFullYear().toString()
        })
        console.log(`Challenge completion email sent to ${user.email} (admin force pass)`)
      }
    } catch (emailError) {
      console.error('Failed to send challenge completion email:', emailError)
    }

    // Create funded account
    const fundedAccount = await this.createFundedAccount(account)
    return { account, fundedAccount }
  }

  async forceFail(challengeAccountId, adminId, reason = '') {
    const account = await ChallengeAccount.findById(challengeAccountId)
    if (!account) throw new Error('Account not found')

    account.status = 'FAILED'
    account.failedAt = new Date()
    account.failReason = reason || 'Admin force fail'
    account.violations.push({
      type: 'ADMIN_FAIL',
      description: account.failReason,
      severity: 'FAIL',
      timestamp: new Date()
    })
    await account.save()
    
    // Send failure email
    try {
      const user = await User.findById(account.userId)
      const challenge = await Challenge.findById(account.challengeId)
      if (user && challenge) {
        await sendTemplateEmail('challenge_failed', user.email, {
          firstName: user.firstName || user.email.split('@')[0],
          challengeName: challenge.name,
          fundSize: `$${challenge.fundSize.toLocaleString()}`,
          accountId: account.accountId,
          failureReason: account.failReason,
          failureDate: account.failedAt.toLocaleDateString(),
          platformName: 'NalmiFX',
          loginUrl: 'http://localhost:5173/login',
          supportEmail: 'support@nalmifx.com',
          year: new Date().getFullYear().toString()
        })
      }
    } catch (emailError) {
      console.error('Failed to send challenge failure email:', emailError)
    }
    return account
  }

  async extendTime(challengeAccountId, days, adminId) {
    const account = await ChallengeAccount.findById(challengeAccountId)
    if (!account) throw new Error('Account not found')

    const newExpiry = new Date(account.expiresAt)
    newExpiry.setDate(newExpiry.getDate() + days)
    account.expiresAt = newExpiry
    
    account.violations.push({
      rule: 'ADMIN_EXTEND_TIME',
      description: `Extended ${days} days by admin ${adminId}`,
      severity: 'WARNING'
    })
    await account.save()
    return account
  }

  async resetChallenge(challengeAccountId, adminId) {
    const account = await ChallengeAccount.findById(challengeAccountId)
      .populate('challengeId')
    if (!account) throw new Error('Account not found')

    const challenge = account.challengeId
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (challenge.rules.challengeExpiryDays || 30))

    account.status = 'ACTIVE'
    account.currentPhase = 1
    account.currentBalance = challenge.fundSize
    account.currentEquity = challenge.fundSize
    account.phaseStartBalance = challenge.fundSize
    account.dayStartEquity = challenge.fundSize
    account.lowestEquityToday = challenge.fundSize
    account.lowestEquityOverall = challenge.fundSize
    account.highestEquity = challenge.fundSize
    account.currentDailyDrawdownPercent = 0
    account.currentOverallDrawdownPercent = 0
    account.maxDailyDrawdownHit = 0
    account.maxOverallDrawdownHit = 0
    account.currentProfitPercent = 0
    account.totalProfitLoss = 0
    account.tradesToday = 0
    account.openTradesCount = 0
    account.totalTrades = 0
    account.tradingDaysCount = 0
    account.warningsCount = 0
    account.failReason = null
    account.failedAt = null
    account.passedAt = null
    account.expiresAt = expiresAt
    account.violations = [{
      rule: 'ADMIN_RESET',
      description: `Challenge reset by admin ${adminId}`,
      severity: 'WARNING'
    }]
    
    await account.save()
    return account
  }

  // Admin: manually assign (create) a funded account for a challenge account.
  // Idempotent — if the challenge already has a funded account it returns the
  // existing one. Marks the source challenge PASSED if it wasn't already.
  async assignFundedAccount(challengeAccountId, adminId) {
    const account = await ChallengeAccount.findById(challengeAccountId)
    if (!account) throw new Error('Challenge account not found')
    if (account.accountType === 'FUNDED') {
      throw new Error('This is already a funded account')
    }

    if (account.status !== 'PASSED') {
      account.status = 'PASSED'
      account.passedAt = account.passedAt || new Date()
      account.violations.push({
        rule: 'ADMIN_ASSIGN_FUNDED',
        description: `Funded account manually assigned by admin ${adminId}`,
        severity: 'WARNING',
        timestamp: new Date()
      })
      await account.save()
    }

    const fundedAccount = await this.createFundedAccount(account)
    return { account, fundedAccount }
  }

  // Admin: delete a funded account. Unlinks it from its source challenge
  // account so that account no longer points at a dead funded record.
  async deleteFundedAccount(fundedAccountId, adminId) {
    const funded = await ChallengeAccount.findById(fundedAccountId)
    if (!funded) throw new Error('Funded account not found')
    if (funded.accountType !== 'FUNDED') {
      throw new Error('This account is not a funded account')
    }

    // Block deletion if it still has open trades — closing first is required
    const openCount = await Trade.countDocuments({ tradingAccountId: funded._id, status: 'OPEN' })
    if (openCount > 0) {
      throw new Error(`Funded account has ${openCount} open trade(s). Close them before deleting.`)
    }

    // Unlink from the source challenge account(s) that reference it
    await ChallengeAccount.updateMany(
      { fundedAccountId: funded._id },
      { $set: { fundedAccountId: null } }
    )

    await funded.deleteOne()
    return { deletedId: fundedAccountId, accountId: funded.accountId }
  }

  // Check and trigger SL/TP for all open challenge trades
  async checkSlTpForAllTrades(prices) {
    const openTrades = await Trade.find({ 
      isChallengeAccount: true, 
      status: 'OPEN' 
    }).lean()

    if (openTrades.length > 0) {
      console.log(`[Challenge SL/TP] Checking ${openTrades.length} open challenge trades`)
    }

    const closedTrades = []

    for (const trade of openTrades) {
      const priceData = prices[trade.symbol]
      if (!priceData) continue

      const bid = priceData.bid
      const ask = priceData.ask || priceData.bid
      const sl = trade.sl || trade.stopLoss
      const tp = trade.tp || trade.takeProfit

      let shouldClose = false
      let closeReason = null

      if (trade.side === 'BUY') {
        if (sl && bid <= sl) { shouldClose = true; closeReason = 'SL' }
        else if (tp && bid >= tp) { shouldClose = true; closeReason = 'TP' }
      } else {
        if (sl && ask >= sl) { shouldClose = true; closeReason = 'SL' }
        else if (tp && ask <= tp) { shouldClose = true; closeReason = 'TP' }
      }

      if (shouldClose) {
        // MT5-style: Close at current market price (with slippage), not exact SL/TP price
        // BUY trades close at bid, SELL trades close at ask
        const closePrice = trade.side === 'BUY' ? bid : ask
        
        console.log(`[Challenge SL/TP] TRIGGERED! Trade ${trade.tradeId}: ${closeReason} | ${trade.side} ${trade.symbol} | SL=${sl || 'none'} TP=${tp || 'none'} | Market fill: ${closePrice} (bid=${bid}, ask=${ask})`)
        
        // Calculate PnL at market fill price
        const pnl = trade.side === 'BUY'
          ? (closePrice - trade.openPrice) * trade.quantity * trade.contractSize
          : (trade.openPrice - closePrice) * trade.quantity * trade.contractSize

        // Atomically claim the close — only flip if still OPEN. Prevents
        // concurrent price ticks from each closing the same trade and applying
        // the P&L to the challenge balance multiple times.
        const closedTrade = await Trade.findOneAndUpdate(
          { _id: trade._id, status: 'OPEN' },
          {
            status: 'CLOSED',
            closePrice,
            closedAt: new Date(),
            realizedPnl: pnl,
            closedBy: closeReason
          },
          { new: true }
        )
        if (!closedTrade) continue // already closed by another tick — skip

        // Update challenge account (runs exactly once per trade). Pass the
        // current price map so a cascading stop-out can force-close remaining
        // open trades at live prices rather than falling back to openPrice.
        await this.onTradeClosed(trade.tradingAccountId, closedTrade, pnl, prices)

        closedTrades.push({ trade: closedTrade, reason: closeReason, pnl })
        console.log(`Challenge trade closed with PnL: $${pnl.toFixed(2)}`)
      }
    }

    return closedTrades
  }

  // Track rule violation and fail account if repeated
  async trackRuleViolation(challengeAccountId, ruleCode, description) {
    const account = await ChallengeAccount.findById(challengeAccountId)
      .populate('challengeId')
    
    if (!account) return null

    // Add violation
    await account.addViolation(ruleCode, description, 'WARNING')
    account.warningsCount += 1

    // Check if max warnings exceeded (fail after 3 warnings of same type)
    const sameTypeViolations = account.violations.filter(v => v.rule === ruleCode)
    
    if (sameTypeViolations.length >= 3) {
      // Fail the account
      account.status = 'FAILED'
      account.failedAt = new Date()
      account.failReason = `Repeated rule violation: ${description}`
      await account.addViolation(ruleCode, `Account failed due to repeated violations (${sameTypeViolations.length} times)`, 'FAIL')
      await account.save()
      
      // Send failure email
      try {
        const user = await User.findById(account.userId)
        const challenge = await Challenge.findById(account.challengeId)
        if (user && challenge) {
          await sendTemplateEmail('challenge_failed', user.email, {
            firstName: user.firstName || user.email.split('@')[0],
            challengeName: challenge.name,
            fundSize: `$${challenge.fundSize.toLocaleString()}`,
            accountId: account.accountId,
            failureReason: account.failReason,
            failureDate: account.failedAt.toLocaleDateString(),
            platformName: 'NalmiFX',
            loginUrl: 'http://localhost:5173/login',
            supportEmail: 'support@nalmifx.com',
            year: new Date().getFullYear().toString()
          })
        }
      } catch (emailError) {
        console.error('Failed to send challenge failure email:', emailError)
      }
      
      return { 
        account, 
        failed: true, 
        reason: `Account failed: Exceeded maximum warnings for ${ruleCode}`,
        violationCount: sameTypeViolations.length
      }
    }

    await account.save()
    return { 
      account, 
      failed: false, 
      warningCount: account.warningsCount,
      sameTypeCount: sameTypeViolations.length,
      remainingWarnings: 3 - sameTypeViolations.length
    }
  }

  // Validate and handle rule violation on trade attempt
  async handleTradeAttemptViolation(challengeAccountId, validationResult) {
    if (validationResult.valid) return validationResult

    const account = await ChallengeAccount.findById(challengeAccountId)
    if (!account) return validationResult

    // Track the violation
    const violationResult = await this.trackRuleViolation(
      challengeAccountId,
      validationResult.code,
      validationResult.error
    )

    if (violationResult && violationResult.failed) {
      return {
        ...validationResult,
        accountFailed: true,
        failReason: violationResult.reason
      }
    }

    return {
      ...validationResult,
      warningCount: violationResult?.warningCount || 0,
      remainingWarnings: violationResult?.remainingWarnings || 3
    }
  }

  // Helper methods
  calculatePotentialLoss(tradeParams) {
    const { side, openPrice, stopLoss, quantity, contractSize = 100000 } = tradeParams
    if (!stopLoss) return 0
    
    const priceDiff = side === 'BUY' 
      ? openPrice - stopLoss 
      : stopLoss - openPrice
    
    return Math.abs(priceDiff * quantity * contractSize)
  }

  calculateMargin(tradeParams, account) {
    const { quantity, openPrice, leverage = 100, contractSize = 100000 } = tradeParams
    return (quantity * openPrice * contractSize) / leverage
  }

  // Get challenge account dashboard data
  async getAccountDashboard(challengeAccountId) {
    const account = await ChallengeAccount.findById(challengeAccountId)
      .populate('challengeId')
      .populate('userId', 'firstName email')
    
    if (!account) return null

    const challenge = account.challengeId
    const rules = challenge.rules

    // Calculate remaining time
    const now = new Date()
    const remainingMs = account.expiresAt - now
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)))

    // Get open trades to calculate real-time floating PnL
    const openTrades = await Trade.find({
      tradingAccountId: challengeAccountId,
      status: 'OPEN'
    })
    
    // Calculate floating PnL from open trades
    let floatingPnl = 0
    openTrades.forEach(trade => {
      floatingPnl += trade.floatingPnl || 0
    })
    
    // Calculate real-time equity
    const realTimeEquity = account.currentBalance + floatingPnl
    
    // Calculate real-time drawdown percentages
    const initialBalance = account.initialBalance || account.phaseStartBalance
    const dayStartEquity = account.dayStartEquity || initialBalance
    
    // Daily DD = (dayStartEquity - currentEquity) / dayStartEquity * 100.
    // Capped at 100% — drawdown can't physically be more than total wipe-out,
    // and a value above that means stale data (the very bug that left CH601682
    // showing 152.83%).
    const dailyLoss = dayStartEquity - realTimeEquity
    const realTimeDailyDD = dailyLoss > 0
      ? Math.min(100, (dailyLoss / dayStartEquity) * 100)
      : 0

    // Overall DD = (initialBalance - lowestEquity) / initialBalance * 100
    const lowestEquity = Math.min(account.lowestEquityOverall || initialBalance, realTimeEquity)
    const overallLoss = initialBalance - lowestEquity
    const realTimeOverallDD = overallLoss > 0
      ? Math.min(100, (overallLoss / initialBalance) * 100)
      : 0

    // "Profit" here is progress toward the *current phase's* profit target,
    // measured from the balance the phase started at (phaseStartBalance) — NOT
    // the account's initial balance. When a phase is cleared the engine resets
    // phaseStartBalance to the equity at that moment (see checkProfitTarget),
    // so a single big trade that just cleared phase 1 must read 0% toward
    // phase 2, not its cumulative gain. Reading initialBalance here made phase
    // 2 falsely display as already complete (e.g. 24.40% / 5%) while the engine
    // — which uses phaseStartBalance — correctly refused to fund.
    // An account at a loss has not progressed toward the target — show 0%, not
    // a negative. (The cumulative dollar P&L is still surfaced via
    // balance.profitLoss below.)
    // Gain is measured from where the current phase started (phaseStartBalance),
    // but expressed as a percentage of the ORIGINAL account size (initialBalance)
    // so every phase's target is a fixed dollar amount — phase 2's 5% is always
    // 5% of $5,000 ($250), not 5% of the carried-forward $6,220. Mirrors
    // ChallengeAccount.updateEquity so display and engine agree.
    const phaseStartBalance = account.phaseStartBalance || initialBalance
    const rawProfit = ((realTimeEquity - phaseStartBalance) / initialBalance) * 100
    const realTimeProfit = Math.max(0, rawProfit)

    // Calculate target progress
    let targetPercent = 0
    if (account.currentPhase === 1) {
      targetPercent = rules.profitTargetPhase1Percent || 8
    } else if (account.currentPhase === 2) {
      targetPercent = rules.profitTargetPhase2Percent || 5
    }
    const targetProgress = targetPercent > 0
      ? Math.min(100, (realTimeProfit / targetPercent) * 100)
      : 0

    return {
      account: {
        _id: account._id,
        accountId: account.accountId,
        accountType: account.accountType,
        status: account.status,
        currentPhase: account.currentPhase,
        totalPhases: account.totalPhases
      },
      balance: {
        initial: account.initialBalance,
        current: account.currentBalance,
        equity: realTimeEquity,
        floatingPnl: floatingPnl,
        profitLoss: account.totalProfitLoss + floatingPnl
      },
      drawdown: {
        dailyUsed: realTimeDailyDD,
        dailyMax: rules.maxDailyDrawdownPercent,
        dailyRemaining: Math.max(0, rules.maxDailyDrawdownPercent - realTimeDailyDD),
        overallUsed: realTimeOverallDD,
        overallMax: rules.maxOverallDrawdownPercent,
        overallRemaining: Math.max(0, rules.maxOverallDrawdownPercent - realTimeOverallDD)
      },
      profit: {
        currentPercent: realTimeProfit,
        targetPercent,
        targetProgress,
        // Target gain for the current phase, in dollars — always a percentage
        // of the ORIGINAL account size (e.g. 5% of $5,000 = $250), never of the
        // carried-forward balance.
        targetAmount: (targetPercent / 100) * initialBalance,
        // Dollars still needed to hit the current phase's target: the fixed
        // target amount minus the gain made since this phase started.
        amountToTarget: Math.max(0, (targetPercent / 100) * initialBalance - (realTimeEquity - phaseStartBalance))
      },
      trades: {
        today: account.tradesToday,
        maxPerDay: rules.maxTradesPerDay,
        openCount: account.openTradesCount,
        maxConcurrent: rules.maxConcurrentTrades,
        total: account.totalTrades,
        tradingDays: account.tradingDaysCount,
        requiredDays: rules.tradingDaysRequired
      },
      rules: {
        stopLossMandatory: rules.stopLossMandatory,
        minHoldTimeSeconds: rules.minTradeHoldTimeSeconds,
        allowedSymbols: rules.allowedSymbols,
        allowedSegments: rules.allowedSegments,
        maxLeverage: rules.maxLeverage || 100,
        minLotSize: rules.minLotSize || 0.01,
        maxLotSize: rules.maxLotSize || 100
      },
      time: {
        expiresAt: account.expiresAt,
        remainingDays,
        createdAt: account.createdAt
      },
      violations: account.violations,
      warningsCount: account.warningsCount,
      challenge: {
        _id: challenge._id,
        name: challenge.name,
        fundSize: challenge.fundSize,
        stepsCount: challenge.stepsCount
      }
    }
  }
}

export default new PropTradingEngine()
