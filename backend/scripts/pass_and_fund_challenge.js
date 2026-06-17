// One-off remediation: force a challenge account to PASSED and create + link
// its FUNDED account, using the engine's own forcePass (so all schema defaults
// are applied and the funded account is generated/linked exactly as the normal
// flow would). Use this for accounts that hit their profit target but stayed
// ACTIVE because of the totalPhases=0 ("instant fund") creation bug.
//
// Run with:   node scripts/pass_and_fund_challenge.js CH140960
// Dry run:    node scripts/pass_and_fund_challenge.js CH140960 --dry-run
//
// The funded account is created at the challenge's fundSize (the standard
// funded starting balance), mirroring createFundedAccount.

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import ChallengeAccount from '../models/ChallengeAccount.js'
import Challenge from '../models/Challenge.js'
import propTradingEngine from '../services/propTradingEngine.js'

dotenv.config()

const accountId = process.argv.find(a => /^CH\d+$/i.test(a))
const dryRun = process.argv.includes('--dry-run')

const run = async () => {
  if (!accountId) {
    console.error('Usage: node scripts/pass_and_fund_challenge.js <CHxxxxxx> [--dry-run]')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`Connected. Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`)

  const account = await ChallengeAccount.findOne({ accountId: accountId.toUpperCase() })
  if (!account) {
    console.error(`Account ${accountId} not found`)
    process.exit(1)
  }

  const challenge = await Challenge.findById(account.challengeId)
  console.log('--- Account before ---')
  console.log({
    accountId: account.accountId,
    status: account.status,
    accountType: account.accountType,
    currentPhase: account.currentPhase,
    totalPhases: account.totalPhases,
    currentProfitPercent: account.currentProfitPercent,
    currentBalance: account.currentBalance,
    fundedAccountId: account.fundedAccountId || null,
    challengeStepsCount: challenge?.stepsCount,
    challengeFundSize: challenge?.fundSize
  })

  if (account.fundedAccountId) {
    console.log(`Account already has a funded account (${account.fundedAccountId}). Nothing to do.`)
    process.exit(0)
  }
  if (account.status === 'FUNDED' || account.accountType === 'FUNDED') {
    console.log('Account is already FUNDED. Nothing to do.')
    process.exit(0)
  }

  if (dryRun) {
    console.log(`\nDRY RUN: would mark ${account.accountId} PASSED and create a FUNDED account at $${challenge?.fundSize}.`)
    process.exit(0)
  }

  const result = await propTradingEngine.forcePass(account._id, 'manual-remediation')
  console.log('\n--- Done ---')
  console.log(`Challenge account ${account.accountId} -> PASSED`)
  console.log(`Funded account created: ${result.fundedAccount.accountId} (status FUNDED, balance $${result.fundedAccount.currentBalance})`)
  process.exit(0)
}

run().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
