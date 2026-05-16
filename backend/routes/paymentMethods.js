import express from 'express'
import mongoose from 'mongoose'
import PaymentMethod from '../models/PaymentMethod.js'
import Currency from '../models/Currency.js'
import UserBankAccount from '../models/UserBankAccount.js'
import Transaction from '../models/Transaction.js'
import { getScopedUserIds } from '../middleware/auth.js'

const router = express.Router()

// GET /api/payment-methods - Get all active payment methods (for users)
router.get('/', async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find({ isActive: true })
    res.json({ paymentMethods })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment methods', error: error.message })
  }
})

// GET /api/payment-methods/all - Get all payment methods (for admin)
router.get('/all', async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find()
    res.json({ paymentMethods })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment methods', error: error.message })
  }
})

// POST /api/payment-methods - Create payment method (admin)
router.post('/', async (req, res) => {
  try {
    const { type, bankName, accountNumber, accountHolderName, ifscCode, upiId, qrCodeImage,
            cashPickupLocation, cashDropLocation, cashInstructions,
            usdtWalletAddress, usdtWalletQr, usdtNetwork,
            perTransactionLimit, dailyLimit } = req.body
    const paymentMethod = new PaymentMethod({
      type,
      bankName,
      accountNumber,
      accountHolderName,
      ifscCode,
      upiId,
      qrCodeImage,
      cashPickupLocation,
      cashDropLocation,
      cashInstructions,
      usdtWalletAddress,
      usdtWalletQr,
      usdtNetwork,
      perTransactionLimit: Number(perTransactionLimit) || 0,
      dailyLimit: Number(dailyLimit) || 0
    })
    await paymentMethod.save()
    res.status(201).json({ message: 'Payment method created', paymentMethod })
  } catch (error) {
    res.status(500).json({ message: 'Error creating payment method', error: error.message })
  }
})

// GET /api/payment-methods/usage - Each method's per-tx limit and the user's
// remaining capacity for today. The frontend uses this to disable methods
// whose daily cap is exhausted and to validate the entered amount.
router.get('/usage', async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ message: 'Unauthorized' })
    const methods = await PaymentMethod.find({ isActive: true })

    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)

    const usageAgg = await Transaction.aggregate([
      { $match: {
        userId: typeof req.userId === 'string' ? new mongoose.Types.ObjectId(req.userId) : req.userId,
        type: 'Deposit',
        status: { $in: ['Pending', 'Approved', 'Completed'] },
        createdAt: { $gte: start, $lt: end }
      } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$amount' } } }
    ])
    const usageByType = Object.fromEntries(usageAgg.map(u => [u._id, u.total || 0]))

    const usage = methods.map(m => {
      const usedToday = usageByType[m.type] || 0
      const dailyRemaining = m.dailyLimit > 0 ? Math.max(0, m.dailyLimit - usedToday) : null
      return {
        _id: m._id,
        type: m.type,
        perTransactionLimit: m.perTransactionLimit || 0,
        dailyLimit: m.dailyLimit || 0,
        usedToday,
        dailyRemaining,
        exhausted: dailyRemaining === 0
      }
    })

    res.json({ usage })
  } catch (error) {
    console.error('Error computing payment usage:', error)
    res.status(500).json({ message: 'Error fetching usage', error: error.message })
  }
})

// PUT /api/payment-methods/:id - Update payment method (admin)
router.put('/:id', async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
    if (!paymentMethod) {
      return res.status(404).json({ message: 'Payment method not found' })
    }
    res.json({ message: 'Payment method updated', paymentMethod })
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment method', error: error.message })
  }
})

// DELETE /api/payment-methods/:id - Delete payment method (admin)
router.delete('/:id', async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findByIdAndDelete(req.params.id)
    if (!paymentMethod) {
      return res.status(404).json({ message: 'Payment method not found' })
    }
    res.json({ message: 'Payment method deleted' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting payment method', error: error.message })
  }
})

// ==================== CURRENCY ROUTES ====================

// GET /api/payment-methods/currencies - Get all currencies (for admin)
router.get('/currencies', async (req, res) => {
  try {
    const currencies = await Currency.find().sort({ currency: 1 })
    res.json({ currencies })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching currencies', error: error.message })
  }
})

// GET /api/payment-methods/currencies/active - Get active currencies (for users)
router.get('/currencies/active', async (req, res) => {
  try {
    const currencies = await Currency.find({ isActive: true }).sort({ currency: 1 })
    res.json({ currencies })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching currencies', error: error.message })
  }
})

// POST /api/payment-methods/currencies - Create currency (admin)
router.post('/currencies', async (req, res) => {
  try {
    const { currency, symbol, rateToUSD, markup, isActive } = req.body
    
    // Check if currency already exists
    const existing = await Currency.findOne({ currency: currency.toUpperCase() })
    if (existing) {
      return res.status(400).json({ message: 'Currency already exists' })
    }
    
    const newCurrency = new Currency({
      currency: currency.toUpperCase(),
      symbol,
      rateToUSD,
      markup: markup || 0,
      isActive: isActive !== false
    })
    await newCurrency.save()
    res.status(201).json({ message: 'Currency created', currency: newCurrency })
  } catch (error) {
    res.status(500).json({ message: 'Error creating currency', error: error.message })
  }
})

// PUT /api/payment-methods/currencies/:id - Update currency (admin)
router.put('/currencies/:id', async (req, res) => {
  try {
    const currency = await Currency.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
    if (!currency) {
      return res.status(404).json({ message: 'Currency not found' })
    }
    res.json({ message: 'Currency updated', currency })
  } catch (error) {
    res.status(500).json({ message: 'Error updating currency', error: error.message })
  }
})

// DELETE /api/payment-methods/currencies/:id - Delete currency (admin)
router.delete('/currencies/:id', async (req, res) => {
  try {
    const currency = await Currency.findByIdAndDelete(req.params.id)
    if (!currency) {
      return res.status(404).json({ message: 'Currency not found' })
    }
    res.json({ message: 'Currency deleted' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting currency', error: error.message })
  }
})

// GET /api/payment-methods/currencies/live-rates - Fetch and update all live rates
router.get('/currencies/live-rates', async (req, res) => {
  try {
    // Fetch live rates from free API
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    const data = await response.json()
    
    if (!data.rates) {
      return res.status(500).json({ success: false, message: 'Failed to fetch exchange rates' })
    }

    // Update all existing currencies with live rates
    const currencies = await Currency.find()
    let updatedCount = 0

    for (const currency of currencies) {
      if (data.rates[currency.currency]) {
        currency.rateToUSD = data.rates[currency.currency]
        await currency.save()
        updatedCount++
      }
    }

    res.json({ 
      success: true, 
      message: `Updated ${updatedCount} currencies`,
      rates: data.rates,
      updatedCount
    })
  } catch (error) {
    console.error('Error fetching live rates:', error)
    res.status(500).json({ success: false, message: 'Error fetching live rates', error: error.message })
  }
})

// PUT /api/payment-methods/currencies/update-rate/:code - Update single currency rate
router.put('/currencies/update-rate/:code', async (req, res) => {
  try {
    const currencyCode = req.params.code.toUpperCase()
    
    // Fetch live rate
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    const data = await response.json()
    
    if (!data.rates || !data.rates[currencyCode]) {
      return res.status(404).json({ success: false, message: `Rate for ${currencyCode} not found` })
    }

    const newRate = data.rates[currencyCode]
    
    // Update currency in database
    const currency = await Currency.findOne({ currency: currencyCode })
    if (!currency) {
      return res.status(404).json({ success: false, message: 'Currency not found in database' })
    }

    currency.rateToUSD = newRate
    await currency.save()

    res.json({ 
      success: true, 
      message: `${currencyCode} rate updated`,
      rate: newRate,
      currency
    })
  } catch (error) {
    console.error('Error updating rate:', error)
    res.status(500).json({ success: false, message: 'Error updating rate', error: error.message })
  }
})

// POST /api/payment-methods/currencies/add-all - Add all common currencies with live rates
router.post('/currencies/add-all', async (req, res) => {
  try {
    const { currencies } = req.body
    
    if (!currencies || !Array.isArray(currencies)) {
      return res.status(400).json({ success: false, message: 'Currencies array required' })
    }

    // Fetch live rates
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    const data = await response.json()
    
    if (!data.rates) {
      return res.status(500).json({ success: false, message: 'Failed to fetch exchange rates' })
    }

    let addedCount = 0
    let skippedCount = 0

    for (const curr of currencies) {
      // Check if already exists
      const existing = await Currency.findOne({ currency: curr.currency })
      if (existing) {
        // Update rate if exists
        if (data.rates[curr.currency]) {
          existing.rateToUSD = data.rates[curr.currency]
          await existing.save()
        }
        skippedCount++
        continue
      }

      // Get live rate
      const liveRate = data.rates[curr.currency] || 1

      // Create new currency
      await Currency.create({
        currency: curr.currency,
        symbol: curr.symbol,
        rateToUSD: liveRate,
        markup: 0,
        isActive: true
      })
      addedCount++
    }

    res.json({ 
      success: true, 
      message: `Added ${addedCount} currencies, updated ${skippedCount} existing`,
      addedCount,
      skippedCount
    })
  } catch (error) {
    console.error('Error adding currencies:', error)
    res.status(500).json({ success: false, message: 'Error adding currencies', error: error.message })
  }
})

// ==================== USER BANK ACCOUNT ROUTES ====================

// GET /api/payment-methods/user-banks/:userId - Get user's bank accounts
router.get('/user-banks/:userId', async (req, res) => {
  try {
    const accounts = await UserBankAccount.find({ userId: req.params.userId }).sort({ createdAt: -1 })
    res.json({ accounts })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bank accounts', error: error.message })
  }
})

// GET /api/payment-methods/user-banks/:userId/approved - Get user's approved bank accounts (for withdrawal)
router.get('/user-banks/:userId/approved', async (req, res) => {
  try {
    const accounts = await UserBankAccount.find({ 
      userId: req.params.userId, 
      status: 'Approved',
      isActive: true 
    }).sort({ createdAt: -1 })
    res.json({ accounts })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bank accounts', error: error.message })
  }
})

// POST /api/payment-methods/user-banks - Submit bank account for approval
router.post('/user-banks', async (req, res) => {
  try {
    const { userId, type, bankName, accountNumber, accountHolderName, ifscCode, branchName, upiId,
            cashFullName, cashContactNumber, cashLocationType, cashLocation,
            verificationQuestion, verificationAnswer,
            idDocumentType, idDocumentImage,
            usdtWalletAddress, usdtWalletQr, usdtNetwork, usdtCurrencyPair } = req.body

    if (!userId || !type) {
      return res.status(400).json({ message: 'User ID and type are required' })
    }

    // Check for duplicate based on type
    let duplicateQuery = { userId, type, status: { $ne: 'Rejected' } }
    if (type === 'Bank Transfer') duplicateQuery.accountNumber = accountNumber
    else if (type === 'UPI') duplicateQuery.upiId = upiId
    else if (type === 'USDT') duplicateQuery.usdtWalletAddress = usdtWalletAddress
    // Cash can have multiple submissions (different locations)

    if (type !== 'Cash') {
      const existing = await UserBankAccount.findOne(duplicateQuery)
      if (existing) {
        return res.status(400).json({ message: 'This account is already submitted or approved' })
      }
    }

    const account = new UserBankAccount({
      userId,
      type,
      bankName,
      accountNumber,
      accountHolderName,
      ifscCode,
      branchName,
      upiId,
      cashFullName,
      cashContactNumber,
      cashLocationType,
      cashLocation,
      verificationQuestion,
      verificationAnswer,
      idDocumentType,
      idDocumentImage,
      usdtWalletAddress,
      usdtWalletQr,
      usdtNetwork,
      usdtCurrencyPair,
      status: 'Pending'
    })

    await account.save()
    res.status(201).json({
      success: true,
      message: type === 'Cash' ? 'Cash withdrawal request submitted for approval' :
               type === 'USDT' ? 'USDT wallet submitted for approval' :
               'Bank account submitted for approval',
      account
    })
  } catch (error) {
    res.status(500).json({ message: 'Error submitting bank account', error: error.message })
  }
})

// DELETE /api/payment-methods/user-banks/:id - Delete user bank account
router.delete('/user-banks/:id', async (req, res) => {
  try {
    const account = await UserBankAccount.findByIdAndDelete(req.params.id)
    if (!account) {
      return res.status(404).json({ message: 'Bank account not found' })
    }
    res.json({ success: true, message: 'Bank account deleted' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting bank account', error: error.message })
  }
})

// ==================== ADMIN BANK REQUEST ROUTES ====================

// GET /api/payment-methods/admin/bank-requests - Get all pending bank requests (scoped)
router.get('/admin/bank-requests', async (req, res) => {
  try {
    const { status } = req.query
    const query = status ? { status } : {}

    // Scope to sub-admin's users
    const userIds = await getScopedUserIds(req)
    if (userIds !== null) query.userId = { $in: userIds }

    const requests = await UserBankAccount.find(query)
      .populate('userId', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
    
    res.json({ requests })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bank requests', error: error.message })
  }
})

// GET /api/payment-methods/admin/bank-requests/stats - Get bank request stats
router.get('/admin/bank-requests/stats', async (req, res) => {
  try {
    const pending = await UserBankAccount.countDocuments({ status: 'Pending' })
    const approved = await UserBankAccount.countDocuments({ status: 'Approved' })
    const rejected = await UserBankAccount.countDocuments({ status: 'Rejected' })
    
    res.json({ stats: { pending, approved, rejected, total: pending + approved + rejected } })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message })
  }
})

// PUT /api/payment-methods/admin/bank-requests/:id/approve - Approve bank request
router.put('/admin/bank-requests/:id/approve', async (req, res) => {
  try {
    const account = await UserBankAccount.findById(req.params.id)
    if (!account) {
      return res.status(404).json({ message: 'Bank request not found' })
    }

    account.status = 'Approved'
    account.isActive = true
    account.approvedAt = new Date()
    await account.save()

    res.json({ success: true, message: 'Bank account approved', account })
  } catch (error) {
    res.status(500).json({ message: 'Error approving bank request', error: error.message })
  }
})

// PUT /api/payment-methods/admin/bank-requests/:id/reject - Reject bank request
router.put('/admin/bank-requests/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body
    const account = await UserBankAccount.findById(req.params.id)
    if (!account) {
      return res.status(404).json({ message: 'Bank request not found' })
    }

    account.status = 'Rejected'
    account.isActive = false
    account.rejectedAt = new Date()
    account.rejectionReason = reason || 'Rejected by admin'
    await account.save()

    res.json({ success: true, message: 'Bank account rejected', account })
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting bank request', error: error.message })
  }
})

export default router
