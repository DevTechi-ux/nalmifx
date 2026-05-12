import express from 'express'
import User from '../models/User.js'
import Wallet from '../models/Wallet.js'
import TradingAccount from '../models/TradingAccount.js'
import AccountType from '../models/AccountType.js'
import Trade from '../models/Trade.js'
import Transaction from '../models/Transaction.js'

const router = express.Router()

// POST /api/wallet-transfer/to-trading - Transfer from User Wallet to Trading Account
router.post('/to-trading', async (req, res) => {
  try {
    const { tradingAccountId, amount } = req.body
    const userId = req.userId // From auth middleware

    if (!tradingAccountId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      })
    }

    const transferAmount = parseFloat(amount)
    if (transferAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      })
    }

    // Get trading account with account type
    const tradingAccount = await TradingAccount.findById(tradingAccountId).populate('accountTypeId')
    if (!tradingAccount) {
      return res.status(404).json({
        success: false,
        message: 'Trading account not found'
      })
    }

    // Verify trading account belongs to authenticated user
    if (tradingAccount.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Trading account does not belong to this user'
      })
    }

    // Check if account is active
    if (tradingAccount.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: `Cannot transfer to ${tradingAccount.status} account`
      })
    }

    // Block transfers to demo accounts — they are auto-funded and non-refundable
    if (tradingAccount.isDemo || tradingAccount.accountTypeId?.isDemo) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer funds to a demo account'
      })
    }

    // Check minimum deposit for first deposit to trading account
    if (tradingAccount.balance === 0 && tradingAccount.accountTypeId?.minDeposit) {
      const minDeposit = tradingAccount.accountTypeId.minDeposit
      if (transferAmount < minDeposit) {
        return res.status(400).json({
          success: false,
          message: `Minimum first deposit for ${tradingAccount.accountTypeId.name} account is $${minDeposit}`
        })
      }
    }

    // Atomic deduct from user wallet — only succeeds if sufficient balance
    const userResult = await User.findOneAndUpdate(
      { _id: userId, walletBalance: { $gte: transferAmount } },
      { $inc: { walletBalance: -transferAmount } },
      { new: true }
    )

    if (!userResult) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      })
    }

    // Atomic credit to trading account
    const updatedAccount = await TradingAccount.findByIdAndUpdate(
      tradingAccountId,
      { $inc: { balance: transferAmount } },
      { new: true }
    )

    // Log transaction
    await Transaction.create({
      userId,
      type: 'Transfer_To_Account',
      amount: transferAmount,
      paymentMethod: 'Internal',
      tradingAccountId,
      tradingAccountName: tradingAccount.accountId || `Account ${tradingAccountId.slice(-6)}`,
      status: 'Completed',
      transactionRef: `TRF${Date.now()}`
    })

    res.json({
      success: true,
      message: 'Transfer successful',
      userWalletBalance: userResult.walletBalance,
      tradingAccountBalance: updatedAccount.balance
    })
  } catch (error) {
    console.error('Error transferring to trading account:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// POST /api/wallet-transfer/from-trading - Transfer from Trading Account to User Wallet
router.post('/from-trading', async (req, res) => {
  try {
    const { tradingAccountId, amount } = req.body
    const userId = req.userId // From auth middleware

    if (!tradingAccountId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      })
    }

    const transferAmount = parseFloat(amount)
    if (transferAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      })
    }

    // Get trading account
    const tradingAccount = await TradingAccount.findById(tradingAccountId).populate('accountTypeId')
    if (!tradingAccount) {
      return res.status(404).json({
        success: false,
        message: 'Trading account not found'
      })
    }

    // Verify trading account belongs to authenticated user
    if (tradingAccount.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Trading account does not belong to this user'
      })
    }

    // Check if account is active
    if (tradingAccount.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: `Cannot transfer from ${tradingAccount.status} account`
      })
    }

    // Block withdrawals from demo accounts — demo funds are virtual and non-refundable
    if (tradingAccount.isDemo || tradingAccount.accountTypeId?.isDemo) {
      return res.status(400).json({
        success: false,
        message: 'Cannot withdraw funds from a demo account'
      })
    }

    // Get open trades to calculate free margin
    const openTrades = await Trade.find({
      tradingAccountId,
      status: 'OPEN'
    })

    // Calculate used margin
    const usedMargin = openTrades.reduce((sum, trade) => sum + trade.marginUsed, 0)

    // Calculate floating PnL
    const floatingPnl = openTrades.reduce((sum, trade) => sum + (trade.floatingPnl || 0), 0)

    // Free Margin = Balance - Used Margin
    const freeMargin = tradingAccount.balance - usedMargin

    // Check if withdrawal amount is available in free margin
    const withdrawableAmount = Math.min(freeMargin, tradingAccount.balance)

    if (transferAmount > withdrawableAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient free margin. Maximum withdrawable: ${withdrawableAmount.toFixed(2)}`
      })
    }

    // Atomic deduct from trading account — only succeeds if sufficient balance
    const updatedAccount = await TradingAccount.findOneAndUpdate(
      { _id: tradingAccountId, balance: { $gte: transferAmount } },
      { $inc: { balance: -transferAmount } },
      { new: true }
    )

    if (!updatedAccount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance — concurrent transfer may have occurred'
      })
    }

    // Atomic credit to user wallet
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { walletBalance: transferAmount } },
      { new: true }
    )

    // Log transaction
    await Transaction.create({
      userId,
      type: 'Transfer_From_Account',
      amount: transferAmount,
      paymentMethod: 'Internal',
      tradingAccountId,
      tradingAccountName: tradingAccount.accountId || `Account ${tradingAccountId.slice(-6)}`,
      status: 'Completed',
      transactionRef: `TRF${Date.now()}`
    })

    res.json({
      success: true,
      message: 'Transfer successful',
      userWalletBalance: updatedUser.walletBalance,
      tradingAccountBalance: updatedAccount.balance
    })
  } catch (error) {
    console.error('Error transferring from trading account:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// GET /api/wallet-transfer/balances/:userId - Get all balances for a user
router.get('/balances/:userId', async (req, res) => {
  try {
    const { userId } = req.params

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    const tradingAccounts = await TradingAccount.find({ userId })
      .populate('accountTypeId', 'name')

    const accountBalances = await Promise.all(
      tradingAccounts.map(async (account) => {
        const openTrades = await Trade.find({
          tradingAccountId: account._id,
          status: 'OPEN'
        })

        const usedMargin = openTrades.reduce((sum, trade) => sum + trade.marginUsed, 0)
        const floatingPnl = openTrades.reduce((sum, trade) => sum + (trade.floatingPnl || 0), 0)
        const equity = account.balance + account.credit + floatingPnl
        // Free Margin = Balance - Used Margin (not equity based)
        const freeMargin = account.balance - usedMargin

        return {
          accountId: account._id,
          accountNumber: account.accountId,
          accountType: account.accountTypeId?.name || 'Unknown',
          balance: account.balance,
          credit: account.credit,
          equity,
          usedMargin,
          freeMargin,
          floatingPnl,
          status: account.status,
          openTradesCount: openTrades.length
        }
      })
    )

    res.json({
      success: true,
      userWalletBalance: user.walletBalance,
      tradingAccounts: accountBalances
    })
  } catch (error) {
    console.error('Error fetching balances:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

export default router
