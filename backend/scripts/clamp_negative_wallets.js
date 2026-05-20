// One-off cleanup: find any Wallet docs with balance < 0, clamp to 0,
// and record an audit Transaction so the adjustment is traceable.
//
// Run with: node scripts/clamp_negative_wallets.js
//
// Use --dry-run to print without writing:
//   node scripts/clamp_negative_wallets.js --dry-run

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Wallet from '../models/Wallet.js'
import Transaction from '../models/Transaction.js'

dotenv.config()

const dryRun = process.argv.includes('--dry-run')

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`Connected. Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE (writes will be made)'}`)

  // Use the native driver to bypass the new schema validator — we need to
  // read the bad rows in order to fix them.
  const wallets = await mongoose.connection.db
    .collection('wallets')
    .find({ balance: { $lt: 0 } })
    .toArray()

  if (wallets.length === 0) {
    console.log('No wallets with negative balance found.')
    await mongoose.disconnect()
    return
  }

  console.log(`Found ${wallets.length} wallet(s) with negative balance:`)
  for (const w of wallets) {
    console.log(`  userId=${w.userId} balance=${w.balance} _id=${w._id}`)
  }

  if (dryRun) {
    console.log('Dry run — no changes made.')
    await mongoose.disconnect()
    return
  }

  for (const w of wallets) {
    const restored = -w.balance // amount we need to add to bring it to zero

    // Update via native driver to avoid pre-save validator (which would reject
    // the read of the existing negative doc on an instance save).
    await mongoose.connection.db.collection('wallets').updateOne(
      { _id: w._id },
      { $set: { balance: 0 } }
    )

    // Audit transaction so finance has a trail
    await Transaction.create({
      userId: w.userId,
      walletId: w._id,
      type: 'Admin_Credit',
      amount: restored,
      paymentMethod: 'System',
      description: `Auto-clamp: corrected negative wallet balance (${w.balance.toFixed(2)} -> 0.00)`,
      status: 'Completed'
    })

    console.log(`Clamped wallet ${w._id} (user ${w.userId}): ${w.balance} -> 0  (+${restored.toFixed(2)} audit credit)`)
  }

  await mongoose.disconnect()
  console.log('Done.')
}

run().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
