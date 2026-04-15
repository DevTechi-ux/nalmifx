import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Transaction from '../models/Transaction.js'
import TradingAccount from '../models/TradingAccount.js'

dotenv.config()

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to:', process.env.MONGODB_URI)

  // 1. By type
  const byType = await Transaction.countDocuments({ type: { $in: ['Demo_Credit', 'Demo_Reset'] } })
  console.log(`Demo_Credit + Demo_Reset txns: ${byType}`)

  // 2. By demo trading account linkage (Admin_Credit / Admin_Debit / Transfer / etc on demo accounts)
  const demoAccountIds = await TradingAccount.find({ isDemo: true }).distinct('_id')
  console.log(`Demo trading accounts found: ${demoAccountIds.length}`)

  const byAccount = await Transaction.countDocuments({ tradingAccountId: { $in: demoAccountIds } })
  console.log(`Txns linked to demo accounts (any type): ${byAccount}`)

  // 3. Breakdown by type for demo-account linked txns
  const breakdown = await Transaction.aggregate([
    { $match: { tradingAccountId: { $in: demoAccountIds } } },
    { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    { $sort: { count: -1 } }
  ])
  console.log('Breakdown by type (demo-account linked):')
  console.table(breakdown)

  await mongoose.disconnect()
}

run().catch(err => { console.error(err); process.exit(1) })
