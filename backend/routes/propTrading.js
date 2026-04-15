import express from 'express'
import Challenge from '../models/Challenge.js'
import ChallengeAccount from '../models/ChallengeAccount.js'
import PropSettings from '../models/PropSettings.js'
import Wallet from '../models/Wallet.js'
import Transaction from '../models/Transaction.js'
import propTradingEngine from '../services/propTradingEngine.js'
import { authUser, authAdmin, getScopedUserIds } from '../middleware/auth.js'

const router = express.Router()

// ==================== PUBLIC ROUTES ====================

// GET /api/prop/status - Check if challenge mode is enabled
router.get('/status', async (req, res) => {
  try {
    const settings = await PropSettings.getSettings()
    res.json({
      success: true,
      enabled: settings.challengeModeEnabled,
      displayName: settings.displayName,
      description: settings.description
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/prop/challenges - Get available challenges
router.get('/challenges', async (req, res) => {
  try {
    const settings = await PropSettings.getSettings()
    if (!settings.challengeModeEnabled) {
      return res.json({ success: true, challenges: [], enabled: false })
    }

    const challenges = await Challenge.find({ isActive: true })
      .sort({ sortOrder: 1, fundSize: 1 })

    res.json({ success: true, challenges, enabled: true })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/prop/challenge/:id - Get single challenge details
router.get('/challenge/:id', async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id)
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' })
    }
    res.json({ success: true, challenge })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== USER ROUTES ====================

// POST /api/prop/buy - Buy a challenge
router.post('/buy', authUser, async (req, res) => {
  try {
    const { userId, challengeId } = req.body

    if (!userId || !challengeId) {
      return res.status(400).json({ success: false, message: 'User ID and Challenge ID required' })
    }

    const settings = await PropSettings.getSettings()
    if (!settings.challengeModeEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'Challenge mode is currently disabled',
        code: 'CHALLENGE_MODE_DISABLED'
      })
    }

    // Get the challenge to check the fee
    const challenge = await Challenge.findById(challengeId)
    if (!challenge || !challenge.isActive) {
      return res.status(404).json({ success: false, message: 'Challenge not found or inactive' })
    }

    const challengeFee = challenge.challengeFee || 0

    // Get user's wallet
    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0 })
      await wallet.save()
    }

    // Check if user has enough balance
    if (wallet.balance < challengeFee) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient balance. Required: $${challengeFee}, Available: $${wallet.balance}`,
        code: 'INSUFFICIENT_BALANCE'
      })
    }

    // Deduct challenge fee from wallet
    wallet.balance -= challengeFee
    await wallet.save()

    // Create transaction record for challenge purchase
    const transaction = new Transaction({
      userId,
      walletId: wallet._id,
      type: 'Challenge_Purchase',
      amount: challengeFee,
      status: 'Approved',
      paymentMethod: 'Wallet',
      description: `Challenge Purchase: ${challenge.name} ($${challenge.fundSize.toLocaleString()} Fund)`,
      processedAt: new Date()
    })
    await transaction.save()

    // Create the challenge account
    const account = await propTradingEngine.createChallengeAccount(userId, challengeId, transaction._id)
    
    // Update transaction with challenge account reference
    transaction.challengeAccountId = account._id
    await transaction.save()

    console.log(`Challenge purchased: ${challenge.name} for $${challengeFee} by user ${userId}`)
    
    res.json({
      success: true,
      message: 'Challenge account created successfully',
      account: {
        _id: account._id,
        accountId: account.accountId,
        status: account.status,
        initialBalance: account.initialBalance,
        expiresAt: account.expiresAt
      },
      transaction: {
        _id: transaction._id,
        amount: challengeFee,
        newBalance: wallet.balance
      }
    })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// GET /api/prop/my-accounts/:userId - Get user's challenge accounts
router.get('/my-accounts/:userId', authUser, async (req, res) => {
  try {
    const { userId } = req.params
    const { status } = req.query
    const Trade = (await import('../models/Trade.js')).default

    let query = { userId }
    if (status) query.status = status

    const accounts = await ChallengeAccount.find(query)
      .populate('challengeId')
      .sort({ createdAt: -1 })

    // Fetch live prices from Binance for crypto and use cached prices
    let livePrices = {}
    try {
      const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/bookTicker')
      const binanceData = await binanceRes.json()
      binanceData.forEach(ticker => {
        // Map Binance symbols to our format
        const symbol = ticker.symbol.replace('USDT', 'USD')
        livePrices[symbol] = {
          bid: parseFloat(ticker.bidPrice),
          ask: parseFloat(ticker.askPrice)
        }
      })
    } catch (e) {
      console.log('Could not fetch live prices for challenge accounts')
    }

    // Calculate real-time values for each account based on open trades
    const accountsWithRealTimeData = await Promise.all(accounts.map(async (account) => {
      const accountObj = account.toObject()
      
      // Get open trades for this account
      const openTrades = await Trade.find({
        tradingAccountId: account._id,
        status: 'OPEN'
      })
      
      // Calculate floating PnL using live prices
      let floatingPnl = 0
      openTrades.forEach(trade => {
        const priceData = livePrices[trade.symbol]
        if (priceData) {
          const currentPrice = trade.side === 'BUY' ? priceData.bid : priceData.ask
          const contractSize = trade.contractSize || 100000
          if (trade.side === 'BUY') {
            floatingPnl += (currentPrice - trade.openPrice) * trade.quantity * contractSize
          } else {
            floatingPnl += (trade.openPrice - currentPrice) * trade.quantity * contractSize
          }
          floatingPnl -= (trade.commission || 0) + (trade.swap || 0)
        } else {
          // Fallback to stored PnL if no live price
          floatingPnl += trade.currentPnl || trade.floatingPnl || 0
        }
      })
      
      // Calculate real-time equity
      const realTimeEquity = account.currentBalance + floatingPnl
      
      // Calculate real-time drawdown and profit percentages
      const initialBalance = account.initialBalance || account.phaseStartBalance || 5000
      const dayStartEquity = account.dayStartEquity || initialBalance
      
      // Daily DD = (dayStartEquity - currentEquity) / dayStartEquity * 100
      const dailyLoss = dayStartEquity - realTimeEquity
      const realTimeDailyDD = dailyLoss > 0 ? (dailyLoss / dayStartEquity) * 100 : 0
      
      // Overall DD = (initialBalance - lowestEquity) / initialBalance * 100
      const lowestEquity = Math.min(account.lowestEquityOverall || initialBalance, realTimeEquity)
      const overallLoss = initialBalance - lowestEquity
      const realTimeOverallDD = overallLoss > 0 ? (overallLoss / initialBalance) * 100 : 0
      
      // Profit = (currentEquity - initialBalance) / initialBalance * 100
      const realTimeProfit = ((realTimeEquity - initialBalance) / initialBalance) * 100
      
      return {
        ...accountObj,
        currentEquity: realTimeEquity,
        currentDailyDrawdownPercent: Math.round(realTimeDailyDD * 100) / 100,
        currentOverallDrawdownPercent: Math.round(realTimeOverallDD * 100) / 100,
        currentProfitPercent: Math.round(realTimeProfit * 100) / 100,
        floatingPnl: Math.round(floatingPnl * 100) / 100
      }
    }))

    res.json({ success: true, accounts: accountsWithRealTimeData })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/prop/account/:accountId - Get challenge account dashboard
router.get('/account/:accountId', authUser, async (req, res) => {
  try {
    const { accountId } = req.params
    const dashboard = await propTradingEngine.getAccountDashboard(accountId)
    
    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }

    res.json({ success: true, ...dashboard })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/prop/validate-trade - Validate trade before opening
router.post('/validate-trade', authUser, async (req, res) => {
  try {
    const { challengeAccountId, tradeParams } = req.body

    const result = await propTradingEngine.validateTradeOpen(challengeAccountId, tradeParams)
    
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.error,
        code: result.code,
        uiAction: result.uiAction,
        details: result
      })
    }

    res.json({ success: true, message: 'Trade validated' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/prop/validate-close - Validate trade close (for min hold time)
router.post('/validate-close', authUser, async (req, res) => {
  try {
    const { challengeAccountId, tradeId } = req.body

    const result = await propTradingEngine.validateTradeClose(challengeAccountId, tradeId)
    
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.error,
        code: result.code,
        uiAction: result.uiAction,
        remainingSeconds: result.remainingSeconds,
        canCloseAt: result.canCloseAt
      })
    }

    res.json({ success: true, message: 'Close validated' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/prop/update-equity - Update real-time equity
router.post('/update-equity', authUser, async (req, res) => {
  try {
    const { challengeAccountId, newEquity } = req.body

    const result = await propTradingEngine.updateRealTimeEquity(challengeAccountId, newEquity)
    
    if (!result) {
      return res.status(404).json({ success: false, message: 'Account not found or not active' })
    }

    if (result.breached) {
      return res.json({
        success: true,
        breached: true,
        reason: result.reason,
        code: result.code,
        account: result.account
      })
    }

    res.json({
      success: true,
      breached: false,
      dailyDrawdown: result.dailyDrawdown,
      overallDrawdown: result.overallDrawdown,
      profitPercent: result.profitPercent
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/prop/withdraw-profit - Withdraw profit from funded account
router.post('/withdraw-profit', authUser, async (req, res) => {
  try {
    const { userId, challengeAccountId, amount } = req.body

    if (!userId || !challengeAccountId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'User ID, account ID, and a positive amount are required' })
    }

    const account = await ChallengeAccount.findById(challengeAccountId)
      .populate('challengeId')
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }

    if (account.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not your account' })
    }

    if (account.accountType !== 'FUNDED' || account.status !== 'FUNDED') {
      return res.status(400).json({ success: false, message: 'Only active funded accounts can withdraw profit' })
    }

    // Check withdrawal frequency
    const challenge = account.challengeId
    const withdrawalFrequencyDays = challenge.fundedSettings?.withdrawalFrequencyDays || 14
    if (account.lastWithdrawalDate) {
      const daysSinceLastWithdrawal = (Date.now() - new Date(account.lastWithdrawalDate).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceLastWithdrawal < withdrawalFrequencyDays) {
        const nextDate = new Date(account.lastWithdrawalDate)
        nextDate.setDate(nextDate.getDate() + withdrawalFrequencyDays)
        return res.status(400).json({
          success: false,
          message: `You can withdraw once every ${withdrawalFrequencyDays} days. Next withdrawal available on ${nextDate.toLocaleDateString()}`
        })
      }
    }

    // Calculate available profit (equity - initial balance)
    const profit = account.currentBalance - account.initialBalance
    if (profit <= 0) {
      return res.status(400).json({ success: false, message: 'No profit available to withdraw' })
    }

    // Apply profit split (user gets profitSplitPercent, platform keeps rest)
    const userShare = (account.profitSplitPercent / 100) * profit
    if (amount > userShare) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawable amount is $${userShare.toFixed(2)} (${account.profitSplitPercent}% of $${profit.toFixed(2)} profit)`
      })
    }

    // Deduct from funded account balance (full profit amount, not just user share)
    // The amount the user requests is their share, so the total deducted = amount / (profitSplitPercent / 100)
    const totalDeduction = amount / (account.profitSplitPercent / 100)
    account.currentBalance -= totalDeduction
    account.currentEquity -= totalDeduction
    account.totalWithdrawn += amount
    account.lastWithdrawalDate = new Date()
    await account.save()

    // Credit user's wallet
    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0 })
    }
    wallet.balance += amount
    await wallet.save()

    // Create transaction record
    const transaction = new Transaction({
      userId,
      walletId: wallet._id,
      type: 'Funded_Profit_Withdrawal',
      amount,
      status: 'Approved',
      paymentMethod: 'Funded Account',
      description: `Profit withdrawal from funded account ${account.accountId} (${account.profitSplitPercent}% of $${profit.toFixed(2)} profit)`,
      processedAt: new Date()
    })
    await transaction.save()

    res.json({
      success: true,
      message: `$${amount.toFixed(2)} profit withdrawn to your wallet`,
      withdrawnAmount: amount,
      platformFee: totalDeduction - amount,
      newBalance: account.currentBalance,
      walletBalance: wallet.balance
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/prop/funded-info/:accountId - Get funded account withdrawal info
router.get('/funded-info/:accountId', authUser, async (req, res) => {
  try {
    const account = await ChallengeAccount.findById(req.params.accountId)
      .populate('challengeId')
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }

    if (account.accountType !== 'FUNDED') {
      return res.status(400).json({ success: false, message: 'Not a funded account' })
    }

    const challenge = account.challengeId
    const profit = Math.max(0, account.currentBalance - account.initialBalance)
    const userShare = (account.profitSplitPercent / 100) * profit
    const withdrawalFrequencyDays = challenge.fundedSettings?.withdrawalFrequencyDays || 14

    let canWithdraw = profit > 0 && account.status === 'FUNDED'
    let nextWithdrawalDate = null
    if (account.lastWithdrawalDate) {
      nextWithdrawalDate = new Date(account.lastWithdrawalDate)
      nextWithdrawalDate.setDate(nextWithdrawalDate.getDate() + withdrawalFrequencyDays)
      if (new Date() < nextWithdrawalDate) {
        canWithdraw = false
      }
    }

    res.json({
      success: true,
      fundedInfo: {
        accountId: account.accountId,
        initialCapital: account.initialBalance,
        currentBalance: account.currentBalance,
        currentEquity: account.currentEquity,
        totalProfit: profit,
        profitSplitPercent: account.profitSplitPercent,
        withdrawableAmount: userShare,
        totalWithdrawn: account.totalWithdrawn || 0,
        canWithdraw,
        nextWithdrawalDate: nextWithdrawalDate?.toISOString() || null,
        withdrawalFrequencyDays,
        rules: {
          maxDailyDrawdownPercent: challenge.rules?.maxDailyDrawdownPercent || 5,
          maxOverallDrawdownPercent: challenge.rules?.maxOverallDrawdownPercent || 10
        }
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== ADMIN ROUTES ====================

// GET /api/prop/admin/settings - Get prop settings
router.get('/admin/settings', authAdmin, async (req, res) => {
  try {
    const settings = await PropSettings.getSettings()
    res.json({ success: true, settings })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/prop/admin/settings - Update prop settings
router.put('/admin/settings', authAdmin, async (req, res) => {
  try {
    const { challengeModeEnabled, displayName, description, termsAndConditions, adminId } = req.body
    
    const settings = await PropSettings.updateSettings({
      challengeModeEnabled,
      displayName,
      description,
      termsAndConditions
    }, adminId)

    res.json({ success: true, message: 'Settings updated', settings })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/prop/admin/challenges - Create new challenge
router.post('/admin/challenges', authAdmin, async (req, res) => {
  try {
    const challengeData = req.body
    const challenge = await Challenge.create(challengeData)
    res.json({ success: true, message: 'Challenge created', challenge })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// GET /api/prop/admin/challenges - Get all challenges (admin)
router.get('/admin/challenges', authAdmin, async (req, res) => {
  try {
    const challenges = await Challenge.find().sort({ sortOrder: 1, fundSize: 1 })
    res.json({ success: true, challenges })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/prop/admin/challenges/:id - Update challenge
router.put('/admin/challenges/:id', authAdmin, async (req, res) => {
  try {
    const challenge = await Challenge.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    )
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' })
    }
    res.json({ success: true, message: 'Challenge updated', challenge })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// DELETE /api/prop/admin/challenges/:id - Delete challenge
router.delete('/admin/challenges/:id', authAdmin, async (req, res) => {
  try {
    const accountsCount = await ChallengeAccount.countDocuments({ challengeId: req.params.id })
    if (accountsCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete. ${accountsCount} accounts are using this challenge.` 
      })
    }

    await Challenge.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Challenge deleted' })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// GET /api/prop/admin/accounts - Get all challenge accounts (scoped)
router.get('/admin/accounts', authAdmin, async (req, res) => {
  try {
    const { status, challengeId, limit = 50, offset = 0 } = req.query

    let query = {}
    if (status) query.status = status
    if (challengeId) query.challengeId = challengeId

    const userIds = await getScopedUserIds(req)
    if (userIds !== null) query.userId = { $in: userIds }

    const accounts = await ChallengeAccount.find(query)
      .populate('userId', 'firstName email')
      .populate('challengeId', 'name fundSize stepsCount')
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))

    const total = await ChallengeAccount.countDocuments(query)

    res.json({ success: true, accounts, total })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Helper: assert a challenge account belongs to the calling admin's scope
async function assertChallengeAccountInScope(req, res, accountId) {
  if (req.admin && req.admin.role === 'SUPER_ADMIN') return true
  const account = await ChallengeAccount.findById(accountId).select('userId')
  if (!account) {
    res.status(404).json({ success: false, message: 'Account not found' })
    return false
  }
  const userIds = await getScopedUserIds(req)
  const allowed = (userIds || []).some(id => id.toString() === account.userId.toString())
  if (!allowed) {
    res.status(403).json({ success: false, message: 'Access denied: account not in your branch' })
    return false
  }
  return true
}

// GET /api/prop/admin/account/:id - Get single account details (scoped)
router.get('/admin/account/:id', authAdmin, async (req, res) => {
  try {
    if (!(await assertChallengeAccountInScope(req, res, req.params.id))) return
    const dashboard = await propTradingEngine.getAccountDashboard(req.params.id)
    if (!dashboard) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }
    res.json({ success: true, ...dashboard })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/prop/admin/force-pass/:id - Force pass a challenge
router.post('/admin/force-pass/:id', authAdmin, async (req, res) => {
  try {
    if (!(await assertChallengeAccountInScope(req, res, req.params.id))) return
    const { adminId } = req.body
    const result = await propTradingEngine.forcePass(req.params.id, adminId)
    res.json({ 
      success: true, 
      message: 'Challenge force passed',
      account: result.account,
      fundedAccount: result.fundedAccount
    })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// POST /api/prop/admin/force-fail/:id - Force fail a challenge
router.post('/admin/force-fail/:id', authAdmin, async (req, res) => {
  try {
    if (!(await assertChallengeAccountInScope(req, res, req.params.id))) return
    const { adminId, reason } = req.body
    const account = await propTradingEngine.forceFail(req.params.id, adminId, reason)
    res.json({ success: true, message: 'Challenge force failed', account })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// POST /api/prop/admin/extend-time/:id - Extend challenge time
router.post('/admin/extend-time/:id', authAdmin, async (req, res) => {
  try {
    if (!(await assertChallengeAccountInScope(req, res, req.params.id))) return
    const { adminId, days } = req.body
    if (!days || days <= 0) {
      return res.status(400).json({ success: false, message: 'Days must be positive' })
    }
    const account = await propTradingEngine.extendTime(req.params.id, days, adminId)
    res.json({ success: true, message: `Extended by ${days} days`, account })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// POST /api/prop/admin/reset/:id - Reset challenge
router.post('/admin/reset/:id', authAdmin, async (req, res) => {
  try {
    if (!(await assertChallengeAccountInScope(req, res, req.params.id))) return
    const { adminId } = req.body
    const account = await propTradingEngine.resetChallenge(req.params.id, adminId)
    res.json({ success: true, message: 'Challenge reset', account })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

// GET /api/prop/admin/dashboard - Admin dashboard stats (scoped)
router.get('/admin/dashboard', authAdmin, async (req, res) => {
  try {
    const userIds = await getScopedUserIds(req)
    const accountScope = userIds !== null ? { userId: { $in: userIds } } : {}

    const totalChallenges = await Challenge.countDocuments({ isActive: true })
    const totalAccounts = await ChallengeAccount.countDocuments(accountScope)
    const activeAccounts = await ChallengeAccount.countDocuments({ ...accountScope, status: 'ACTIVE' })
    const passedAccounts = await ChallengeAccount.countDocuments({ ...accountScope, status: 'PASSED' })
    const failedAccounts = await ChallengeAccount.countDocuments({ ...accountScope, status: 'FAILED' })
    const fundedAccounts = await ChallengeAccount.countDocuments({ ...accountScope, status: 'FUNDED' })

    const settings = await PropSettings.getSettings()

    res.json({
      success: true,
      stats: {
        challengeModeEnabled: settings.challengeModeEnabled,
        totalChallenges,
        totalAccounts,
        activeAccounts,
        passedAccounts,
        failedAccounts,
        fundedAccounts
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// GET /api/prop/account-trades/:id - Get trades for a challenge account
router.get('/account-trades/:id', authAdmin, async (req, res) => {
  try {
    const Trade = (await import('../models/Trade.js')).default
    const trades = await Trade.find({ tradingAccountId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100)
    res.json({ success: true, trades })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/prop/admin/mark-notified - Mark all passed challenges as admin-notified
router.put('/admin/mark-notified', authAdmin, async (req, res) => {
  try {
    await ChallengeAccount.updateMany(
      { status: 'PASSED', adminNotified: false },
      { $set: { adminNotified: true } }
    )
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
