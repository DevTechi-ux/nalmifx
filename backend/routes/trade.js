import express from 'express'
import Trade from '../models/Trade.js'
import TradingAccount from '../models/TradingAccount.js'
import ChallengeAccount from '../models/ChallengeAccount.js'
import Charges from '../models/Charges.js'
import tradeEngine from '../services/tradeEngine.js'
import propTradingEngine from '../services/propTradingEngine.js'
import copyTradingEngine from '../services/copyTradingEngine.js'
import ibEngine from '../services/ibEngineNew.js'
import MasterTrader from '../models/MasterTrader.js'
import { getFreshPrice } from '../services/priceService.js'

const router = express.Router()

// POST /api/trade/open - Open a new trade
router.post('/open', async (req, res) => {
  try {
    const {
      tradingAccountId,
      symbol,
      segment,
      side,
      orderType,
      quantity,
      leverage,
      sl,
      tp,
      pendingPrice
    } = req.body

    // Use authenticated userId from middleware — never trust client-supplied userId
    const userId = req.userId

    // Validate required fields
    if (!tradingAccountId || !symbol || !side || !orderType || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      })
    }

    // Fetch server-side prices from priceCache — never trust client-supplied prices
    const priceCache = req.app.get('priceCache')
    const serverPrice = priceCache?.get(symbol)

    if (!serverPrice || !serverPrice.bid || !serverPrice.ask || serverPrice.bid <= 0 || serverPrice.ask <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Market is closed or no price data available. Please try again when market is open.',
        code: 'MARKET_CLOSED'
      })
    }

    const bid = serverPrice.bid
    const ask = serverPrice.ask

    // Validate side
    if (!['BUY', 'SELL'].includes(side)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid side. Must be BUY or SELL' 
      })
    }

    // Validate order type
    const validOrderTypes = ['MARKET', 'BUY_LIMIT', 'BUY_STOP', 'SELL_LIMIT', 'SELL_STOP']
    if (!validOrderTypes.includes(orderType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order type'
      })
    }

    // For pending orders, require a valid pendingPrice and validate it makes sense vs. current market
    let parsedPendingPrice = null
    if (orderType !== 'MARKET') {
      parsedPendingPrice = parseFloat(pendingPrice)
      if (!parsedPendingPrice || isNaN(parsedPendingPrice) || parsedPendingPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Entry price is required for pending orders'
        })
      }

      // Validate entry price direction against current market
      // BUY_LIMIT: below current ask (waiting for price to drop)
      // BUY_STOP: above current ask (waiting for price to rise)
      // SELL_LIMIT: above current bid (waiting for price to rise)
      // SELL_STOP: below current bid (waiting for price to drop)
      if (orderType === 'BUY_LIMIT' && parsedPendingPrice >= ask) {
        return res.status(400).json({
          success: false,
          message: `BUY LIMIT entry price (${parsedPendingPrice}) must be below current ask (${ask})`
        })
      }
      if (orderType === 'BUY_STOP' && parsedPendingPrice <= ask) {
        return res.status(400).json({
          success: false,
          message: `BUY STOP entry price (${parsedPendingPrice}) must be above current ask (${ask})`
        })
      }
      if (orderType === 'SELL_LIMIT' && parsedPendingPrice <= bid) {
        return res.status(400).json({
          success: false,
          message: `SELL LIMIT entry price (${parsedPendingPrice}) must be above current bid (${bid})`
        })
      }
      if (orderType === 'SELL_STOP' && parsedPendingPrice >= bid) {
        return res.status(400).json({
          success: false,
          message: `SELL STOP entry price (${parsedPendingPrice}) must be below current bid (${bid})`
        })
      }
    }

    // Check if this is a challenge account first
    const challengeAccount = await ChallengeAccount.findById(tradingAccountId).populate('challengeId')
    
    if (challengeAccount) {
      // This is a challenge account - use prop trading engine
      const tradeParams = {
        symbol,
        segment: segment || 'Forex',
        side,
        orderType,
        quantity: parseFloat(quantity),
        bid: parseFloat(bid),
        ask: parseFloat(ask),
        sl: sl ? parseFloat(sl) : null,
        tp: tp ? parseFloat(tp) : null,
        pendingPrice: parsedPendingPrice
      }

      // Validate trade against challenge rules
      const validation = await propTradingEngine.validateTradeOpen(tradingAccountId, tradeParams)
      if (!validation.valid) {
        // Track violation and check if account should be failed
        const violationResult = await propTradingEngine.handleTradeAttemptViolation(tradingAccountId, validation)
        
        return res.status(400).json({
          success: false,
          message: violationResult.error,
          code: violationResult.code,
          uiAction: violationResult.uiAction,
          accountFailed: violationResult.accountFailed || false,
          failReason: violationResult.failReason || null,
          warningCount: violationResult.warningCount || 0,
          remainingWarnings: violationResult.remainingWarnings || 3
        })
      }

      // Open trade for challenge account
      const trade = await propTradingEngine.openChallengeTrade(
        userId,
        tradingAccountId,
        tradeParams
      )

      return res.json({
        success: true,
        message: 'Challenge trade opened successfully',
        trade,
        isChallengeAccount: true
      })
    }

    // Regular trading account - use standard trade engine
    const trade = await tradeEngine.openTrade(
      userId,
      tradingAccountId,
      symbol,
      segment || 'Forex',
      side,
      orderType,
      parseFloat(quantity),
      parseFloat(bid),
      parseFloat(ask),
      sl ? parseFloat(sl) : null,
      tp ? parseFloat(tp) : null,
      leverage,
      priceCache, // For cross-currency margin conversion (e.g. EURJPY → USD)
      parsedPendingPrice
    )

    // Respond immediately — the user's trade is already persisted. Copy-trade
    // propagation to followers runs in the background so it doesn't add latency
    // to the order placement (matters most for the native app, which awaits).
    res.json({
      success: true,
      message: 'Trade opened successfully',
      trade
    })

    // ---- Background: copy this trade to followers if the account is a master ----
    ;(async () => {
      try {
        const master = await MasterTrader.findOne({ tradingAccountId, status: 'ACTIVE' })
        if (master) {
          trade.bid = bid
          trade.ask = ask
          const copyResults = await copyTradingEngine.copyTradeToFollowers(trade, master._id)
          console.log(`Copied trade to ${copyResults.filter(r => r.status === 'SUCCESS').length} followers`)
        }
      } catch (copyError) {
        console.error('Error copying trade to followers:', copyError)
      }
    })()
  } catch (error) {
    console.error('Error opening trade:', error)
    res.status(400).json({ 
      success: false, 
      message: error.message 
    })
  }
})

// POST /api/trade/close - Close a trade
router.post('/close', async (req, res) => {
  try {
    const { tradeId } = req.body

    if (!tradeId) {
      return res.status(400).json({
        success: false,
        message: 'Trade ID is required'
      })
    }

    // Get trade first to check ownership and get symbol for price lookup
    const tradeToClose = await Trade.findById(tradeId)

    if (!tradeToClose) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found'
      })
    }

    // Verify the trade belongs to the authenticated user
    if (tradeToClose.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to close this trade' })
    }

    // Fetch server-side prices — never trust client-supplied prices
    const priceCache = req.app.get('priceCache')
    const serverPrice = priceCache?.get(tradeToClose.symbol)

    if (!serverPrice || !serverPrice.bid || !serverPrice.ask || serverPrice.bid <= 0 || serverPrice.ask <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Market is closed or no price data available. Cannot close trade.',
        code: 'MARKET_CLOSED'
      })
    }

    const bid = serverPrice.bid
    const ask = serverPrice.ask

    // Check if this is a challenge account trade
    const challengeAccount = await ChallengeAccount.findById(tradeToClose.tradingAccountId)
    
    if (challengeAccount) {
      // Atomically claim the close — flip OPEN→CLOSED in one operation.
      // Only the first caller wins; any duplicate/concurrent close request
      // (double-click, retry, racing SL/TP tick) gets null and bails, so the
      // P&L is applied to the challenge balance EXACTLY once.
      const claimed = await Trade.findOneAndUpdate(
        { _id: tradeToClose._id, status: 'OPEN' },
        { status: 'CLOSED', closedAt: new Date(), closeReason: 'USER' },
        { new: true }
      )
      if (!claimed) {
        return res.status(400).json({ success: false, message: 'Trade is not open' })
      }

      // Close trade for challenge account
      const closePrice = claimed.side === 'BUY' ? parseFloat(bid) : parseFloat(ask)
      const usdConversionRate = tradeEngine.getUsdConversionRate(claimed.symbol, priceCache)
      const rawPnl = claimed.side === 'BUY'
        ? (closePrice - claimed.openPrice) * claimed.quantity * claimed.contractSize * usdConversionRate
        : (claimed.openPrice - closePrice) * claimed.quantity * claimed.contractSize * usdConversionRate

      // Get charges for commission on close
      const charges = await Charges.getChargesForTrade(
        claimed.userId,
        claimed.symbol,
        claimed.segment,
        null
      )

      // Calculate commission on close if enabled
      let closeCommission = 0
      if (charges.commissionOnClose && charges.commissionValue > 0) {
        if (charges.commissionType === 'FIXED') {
          closeCommission = charges.commissionValue
        } else if (charges.commissionType === 'PER_LOT') {
          closeCommission = claimed.quantity * charges.commissionValue
        } else if (charges.commissionType === 'PERCENTAGE') {
          const tradeValue = claimed.quantity * claimed.contractSize * closePrice
          closeCommission = tradeValue * (charges.commissionValue / 100)
        }
      }

      // Calculate final PnL (subtract swap and close commission)
      const pnl = rawPnl - (claimed.swap || 0) - closeCommission

      // Persist close price + realized PnL on the trade we already claimed
      claimed.closePrice = closePrice
      claimed.realizedPnl = pnl
      await claimed.save()

      // Update challenge account (runs exactly once thanks to the atomic claim)
      await propTradingEngine.onTradeClosed(challengeAccount._id, claimed, pnl)

      return res.json({
        success: true,
        message: 'Challenge trade closed successfully',
        trade: claimed,
        realizedPnl: pnl,
        isChallengeAccount: true
      })
    }
    
    // Regular trading account - use standard trade engine
    const result = await tradeEngine.closeTrade(
      tradeId,
      parseFloat(bid),
      parseFloat(ask),
      'USER',
      null,
      priceCache
    )

    // Respond as soon as the trade is closed + balance updated. The user
    // doesn't need to wait for copy-trade propagation or IB commission
    // distribution — those run in the background below. This keeps close
    // latency low (especially for the native app, which awaits the response).
    res.json({
      success: true,
      message: 'Trade closed successfully',
      trade: result.trade,
      realizedPnl: result.realizedPnl
    })

    // ---- Background post-close side-effects (do not block the response) ----
    const closeAccountId = tradeToClose.tradingAccountId
    const closeSide = tradeToClose.side
    ;(async () => {
      // Close follower trades if this was a master trade
      try {
        const master = await MasterTrader.findOne({ tradingAccountId: closeAccountId, status: 'ACTIVE' })
        if (master) {
          const closePrice = closeSide === 'BUY' ? bid : ask
          const copyResults = await copyTradingEngine.closeFollowerTrades(tradeId, closePrice, bid, ask)
          console.log(`[CopyTrade] Closed ${copyResults.length} follower trades for master trade ${tradeId}`)
        }
      } catch (copyError) {
        console.error('[CopyTrade] Error closing follower trades:', copyError)
      }

      // Distribute IB commission for the closed trade
      try {
        const ibResult = await ibEngine.processTradeCommission(result.trade)
        if (ibResult.processed) {
          console.log(`IB commission processed for trade ${result.trade._id}: ${ibResult.commissions?.length || 0} IBs credited`)
        }
      } catch (ibError) {
        console.error('Error processing IB commission:', ibError)
      }
    })()
  } catch (error) {
    console.error('Error closing trade:', error)
    res.status(400).json({ 
      success: false, 
      message: error.message 
    })
  }
})

// PUT /api/trade/modify - Modify trade SL/TP
router.put('/modify', async (req, res) => {
  try {
    const { tradeId, sl, tp } = req.body

    if (!tradeId) {
      return res.status(400).json({
        success: false,
        message: 'Trade ID is required'
      })
    }

    // First check if trade exists and belongs to user
    const existingTrade = await Trade.findById(tradeId)
    if (!existingTrade) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found'
      })
    }

    if (existingTrade.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this trade' })
    }

    // Fetch server-side prices for SL/TP validation
    const priceCache = req.app.get('priceCache')
    const serverPrice = priceCache?.get(existingTrade.symbol)
    const currentBid = serverPrice?.bid || null
    const currentAsk = serverPrice?.ask || null

    // Parse values and handle NaN
    const parsedSl = sl !== undefined && sl !== null && sl !== '' ? parseFloat(sl) : null
    const parsedTp = tp !== undefined && tp !== null && tp !== '' ? parseFloat(tp) : null

    const trade = await tradeEngine.modifyTrade(
      tradeId,
      parsedSl !== null && !isNaN(parsedSl) ? parsedSl : null,
      parsedTp !== null && !isNaN(parsedTp) ? parsedTp : null,
      null,
      currentBid,
      currentAsk
    )

    // Mirror SL/TP modification to follower trades
    const master = await MasterTrader.findOne({ 
      tradingAccountId: trade.tradingAccountId, 
      status: 'ACTIVE' 
    })
    
    if (master) {
      try {
        await copyTradingEngine.mirrorSlTpModification(
          tradeId,
          parsedSl,
          parsedTp
        )
        console.log(`Mirrored SL/TP modification to follower trades for ${tradeId}`)
      } catch (copyError) {
        console.error('Error mirroring SL/TP:', copyError)
      }
    }

    res.json({
      success: true,
      message: 'Trade modified successfully',
      trade
    })
  } catch (error) {
    console.error('Error modifying trade:', error)
    res.status(400).json({ 
      success: false, 
      message: error.message 
    })
  }
})

// GET /api/trade/open/:tradingAccountId - Get all open trades for an account
router.get('/open/:tradingAccountId', async (req, res) => {
  try {
    const { tradingAccountId } = req.params

    const trades = await Trade.find({ 
      tradingAccountId, 
      status: 'OPEN' 
    }).sort({ openedAt: -1 }).lean()

    res.json({
      success: true,
      trades
    })
  } catch (error) {
    console.error('Error fetching open trades:', error)
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
})

// GET /api/trade/pending/:tradingAccountId - Get all pending orders for an account
router.get('/pending/:tradingAccountId', async (req, res) => {
  try {
    const { tradingAccountId } = req.params

    const trades = await Trade.find({ 
      tradingAccountId, 
      status: 'PENDING' 
    }).sort({ createdAt: -1 }).lean()

    res.json({
      success: true,
      trades
    })
  } catch (error) {
    console.error('Error fetching pending orders:', error)
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
})

// GET /api/trade/history/:tradingAccountId - Get trade history for an account
router.get('/history/:tradingAccountId', async (req, res) => {
  try {
    const { tradingAccountId } = req.params
    const { limit = 50, offset = 0 } = req.query

    const filter = { tradingAccountId, status: 'CLOSED' }

    // Run both queries in parallel + use .lean() for faster serialization
    const [trades, total] = await Promise.all([
      Trade.find(filter)
        .sort({ closedAt: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .lean(),
      Trade.countDocuments(filter)
    ])

    res.json({
      success: true,
      trades,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    console.error('Error fetching trade history:', error)
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
})

// GET /api/trade/summary/:tradingAccountId - Get account summary with real-time values
router.get('/summary/:tradingAccountId', async (req, res) => {
  try {
    const { tradingAccountId } = req.params
    const { prices } = req.query // JSON string of current prices

    // Check for regular trading account first
    let account = await TradingAccount.findById(tradingAccountId)
    let isChallengeAccount = false
    
    // If not found, check for challenge account
    if (!account) {
      const challengeAcc = await ChallengeAccount.findById(tradingAccountId)
      if (challengeAcc) {
        account = {
          balance: challengeAcc.currentBalance,
          credit: 0,
          equity: challengeAcc.currentEquity
        }
        isChallengeAccount = true
      }
    }
    
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: 'Trading account not found' 
      })
    }

    const openTrades = await Trade.find({ 
      tradingAccountId, 
      status: 'OPEN' 
    })

    let currentPrices = {}
    if (prices) {
      try {
        currentPrices = JSON.parse(prices)
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Calculate used margin from open trades
    const usedMargin = openTrades.reduce((sum, t) => sum + (t.marginUsed || 0), 0)
    
    // Calculate floating PnL from current prices with USD conversion for cross pairs
    const summaryPriceCache = req.app.get('priceCache')
    let floatingPnl = 0
    for (const trade of openTrades) {
      const priceData = currentPrices[trade.symbol]
      if (priceData) {
        const currentPrice = trade.side === 'BUY' ? priceData.bid : priceData.ask
        const usdRate = tradeEngine.getUsdConversionRate(trade.symbol, summaryPriceCache)
        const pnl = trade.side === 'BUY'
          ? (currentPrice - trade.openPrice) * trade.quantity * trade.contractSize * usdRate
          : (trade.openPrice - currentPrice) * trade.quantity * trade.contractSize * usdRate
        floatingPnl += pnl
      }
    }

    // Calculate equity and free margin
    const balance = account.balance || 0
    const credit = account.credit || 0
    const equity = balance + credit + floatingPnl
    // Free Margin = Balance - Used Margin (not equity based)
    const freeMargin = balance - usedMargin
    const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0

    res.json({
      success: true,
      summary: {
        balance: Math.round(balance * 100) / 100,
        credit: Math.round(credit * 100) / 100,
        equity: Math.round(equity * 100) / 100,
        usedMargin: Math.round(usedMargin * 100) / 100,
        freeMargin: Math.round(freeMargin * 100) / 100,
        floatingPnl: Math.round(floatingPnl * 100) / 100,
        marginLevel: Math.round(marginLevel * 100) / 100
      },
      openTradesCount: openTrades.length
    })
  } catch (error) {
    console.error('Error fetching account summary:', error)
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
})

// POST /api/trade/check-stopout - Check and execute stop out if needed
router.post('/check-stopout', async (req, res) => {
  try {
    const { tradingAccountId, prices } = req.body

    if (!tradingAccountId) {
      return res.status(400).json({ success: false, message: 'Trading account ID required' })
    }

    let currentPrices = {}
    if (prices) {
      try {
        currentPrices = typeof prices === 'string' ? JSON.parse(prices) : prices
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Check if this is a challenge account
    const challengeAccount = await ChallengeAccount.findById(tradingAccountId)
    if (challengeAccount) {
      // For challenge accounts, check drawdown breach instead of stop out
      // This is handled by propTradingEngine during trade close
      return res.json({ success: true, stopOutTriggered: false, isChallengeAccount: true })
    }

    const result = await tradeEngine.checkStopOut(tradingAccountId, currentPrices)
    
    if (result && result.stopOutTriggered) {
      return res.json({
        success: true,
        stopOutTriggered: true,
        reason: result.reason,
        closedTradesCount: result.closedTrades?.length || 0,
        message: `STOP OUT: All trades closed due to ${result.reason}`
      })
    }

    res.json({ success: true, stopOutTriggered: false })
  } catch (error) {
    console.error('Error checking stop out:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/trade/cancel - Cancel a pending order
router.post('/cancel', async (req, res) => {
  try {
    const { tradeId } = req.body

    if (!tradeId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Trade ID is required' 
      })
    }

    const trade = await Trade.findById(tradeId)
    if (!trade) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found'
      })
    }

    if (trade.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this trade' })
    }

    if (trade.status !== 'PENDING') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only pending orders can be cancelled' 
      })
    }

    trade.status = 'CANCELLED'
    trade.closedAt = new Date()
    trade.closedBy = 'USER'
    await trade.save()

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      trade
    })
  } catch (error) {
    console.error('Error cancelling order:', error)
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
})

// Debug endpoint removed for security — was exposing all open trades without auth

// POST /api/trade/check-sltp - Check and trigger SL/TP for all trades
router.post('/check-sltp', async (req, res) => {
  try {
    const { prices: clientPrices } = req.body

    if (!clientPrices || typeof clientPrices !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Prices object is required'
      })
    }

    // Prefer server-side priceCache (Infoway) over client-supplied prices —
    // server prices are authoritative and match what the background SL/TP job uses.
    const serverPriceCache = req.app.get('priceCache')
    const basePrices = {}
    if (serverPriceCache) {
      serverPriceCache.forEach((data, symbol) => {
        if (data.bid && data.ask) basePrices[symbol] = { bid: data.bid, ask: data.ask }
      })
    }
    // Fall back to client-supplied prices for any symbol not in server cache
    const mergedPrices = { ...clientPrices, ...basePrices }

    // Find all open trades with SL/TP to get their symbols
    const tradesWithSlTp = await Trade.find({
      status: 'OPEN',
      $or: [
        { sl: { $gt: 0 } },
        { stopLoss: { $gt: 0 } },
        { tp: { $gt: 0 } },
        { takeProfit: { $gt: 0 } }
      ]
    }).select('symbol').lean()

    // For symbols with SL/TP trades still missing a price, fetch from AllTick as last resort
    const symbolsNeedingPrices = [...new Set(tradesWithSlTp.map(t => t.symbol))]
    const finalPrices = { ...mergedPrices }
    for (const symbol of symbolsNeedingPrices) {
      if (!finalPrices[symbol] || !finalPrices[symbol].bid) {
        const freshPrice = await getFreshPrice(symbol)
        if (freshPrice) {
          finalPrices[symbol] = freshPrice
          console.log(`[SL/TP Check] AllTick fallback for ${symbol}: bid=${freshPrice.bid}, ask=${freshPrice.ask}`)
        }
      }
    }

    const xauPrice = finalPrices['XAUUSD']
    if (xauPrice) {
      console.log(`[SL/TP Check] XAUUSD bid=${xauPrice.bid}, ask=${xauPrice.ask}`)
    }

    // Check SL/TP for all open challenge trades
    const closedChallengeTrades = await propTradingEngine.checkSlTpForAllTrades(finalPrices)

    // Check SL/TP for all regular trades
    const closedRegularTrades = await tradeEngine.checkSlTpForAllTrades(finalPrices)

    const allClosedTrades = [...closedChallengeTrades, ...closedRegularTrades]

    res.json({
      success: true,
      closedCount: allClosedTrades.length,
      closedTrades: allClosedTrades.map(ct => ({
        tradeId: ct.trade.tradeId,
        symbol: ct.trade.symbol,
        tradingAccountId: (ct.trade.tradingAccountId?._id || ct.trade.tradingAccountId)?.toString(),
        reason: ct.trigger || ct.reason,
        pnl: ct.pnl
      }))
    })
  } catch (error) {
    console.error('Error checking SL/TP:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// POST /api/trade/check-pending - Check and execute pending orders when price is reached
router.post('/check-pending', async (req, res) => {
  try {
    const { prices } = req.body

    if (!prices || typeof prices !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'Prices object is required' 
      })
    }

    // Check pending orders for execution
    const executedTrades = await tradeEngine.checkPendingOrders(prices)

    res.json({
      success: true,
      executedCount: executedTrades.length,
      executedTrades: executedTrades.map(et => ({
        tradeId: et.trade.tradeId,
        symbol: et.trade.symbol,
        side: et.trade.side,
        orderType: et.trade.orderType,
        executionPrice: et.executionPrice,
        executedAt: et.executedAt
      }))
    })
  } catch (error) {
    console.error('Error checking pending orders:', error)
    res.status(500).json({ 
      success: false, 
      message: error.message 
    })
  }
})

export default router
