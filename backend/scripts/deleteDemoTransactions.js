import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Transaction from '../models/Transaction.js'
import TradingAccount from '../models/TradingAccount.js'

dotenv.config()

// Usage:
//   node scripts/deleteDemoTransactions.js           (dry-run, prints what would be deleted)
//   node scripts/deleteDemoTransactions.js --confirm (actually deletes)

async function run() {
  const confirm = process.argv.includes('--confirm')
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to:', process.env.MONGODB_URI)
  console.log(confirm ? 'MODE: DELETE' : 'MODE: DRY-RUN (pass --confirm to delete)')

  const demoAccountIds = await TradingAccount.find({ isDemo: true }).distinct('_id')

  const filter = {
    $or: [
      { type: { $in: ['Demo_Credit', 'Demo_Reset'] } },
      { tradingAccountId: { $in: demoAccountIds } }
    ]
  }

  const count = await Transaction.countDocuments(filter)
  console.log(`Matching transactions: ${count}`)

  if (!confirm) {
    console.log('Dry-run complete. Re-run with --confirm to delete.')
  } else {
    const result = await Transaction.deleteMany(filter)
    console.log(`Deleted: ${result.deletedCount}`)
  }

  await mongoose.disconnect()
}

run().catch(err => { console.error(err); process.exit(1) })
