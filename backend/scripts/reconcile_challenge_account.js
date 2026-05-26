// Reconcile a corrupt challenge / funded account by REWINDING it to the
// moment the daily drawdown should have failed it.
//
// What the script does:
//   1. Walks the account's CLOSED trades in chronological order (closedAt).
//   2. Replays each trade's realizedPnl onto the initial balance.
//   3. After each trade, recomputes the daily drawdown %.
//   4. STOPS at the first trade where daily DD ≥ rules.maxDailyDrawdownPercent.
//      (Falls back to overallDD if no daily limit is configured.)
//   5. Sets currentBalance = currentEquity = initialBalance + P&L up to and
//      INCLUDING that trade — NOT zero. The trade that caused the breach
//      counts; what was traded afterwards is rolled back.
//   6. Sets status = FAILED, with the breach trade quoted in failReason.
//   7. DELETES every trade that closed AFTER the breach trade — those trades
//      were taken on a paper-failed account and should not appear in history.
//   8. Force-closes any still-open trades at openPrice (zero raw P&L) so the
//      account is in a clean terminal state.
//
// Usage:
//   DRY-RUN  : node backend/scripts/reconcile_challenge_account.js CH601682
//   APPLY    : node backend/scripts/reconcile_challenge_account.js CH601682 --apply

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import ChallengeAccount from '../models/ChallengeAccount.js'
import Challenge from '../models/Challenge.js'
import Trade from '../models/Trade.js'

// Load backend/.env regardless of the cwd the script is invoked from. The
// rest of the backend uses MONGODB_URI exclusively.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is missing — expected in backend/.env')
  process.exit(1)
}

const [, , accountIdArg, ...flags] = process.argv
const APPLY = flags.includes('--apply')

if (!accountIdArg) {
  console.error('Usage: node reconcile_challenge_account.js <accountId> [--apply]')
  process.exit(1)
}

async function main () {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`\n[Reconcile] Mode: ${APPLY ? 'APPLY (will write)' : 'DRY-RUN'}`)
  console.log(`[Reconcile] Target accountId: ${accountIdArg}\n`)

  const account = await ChallengeAccount.findOne({ accountId: accountIdArg }).populate('challengeId')
  if (!account) {
    console.error(`Account "${accountIdArg}" not found.`)
    process.exit(2)
  }

  console.log('--- BEFORE ---')
  console.log({
    accountId: account.accountId,
    accountType: account.accountType,
    status: account.status,
    initialBalance: account.initialBalance,
    currentBalance: account.currentBalance,
    currentEquity: account.currentEquity,
    openTradesCount: account.openTradesCount,
    currentDailyDD: account.currentDailyDrawdownPercent,
    currentOverallDD: account.currentOverallDrawdownPercent,
    failReason: account.failReason
  })

  const rules = account.challengeId?.rules || {}
  const maxDailyDD = rules.maxDailyDrawdownPercent
  const maxOverallDD = rules.maxOverallDrawdownPercent
  const initialBalance = account.initialBalance

  // Replay closed trades in chronological order
  const closedTrades = await Trade.find({
    tradingAccountId: account._id,
    status: 'CLOSED'
  }).sort({ closedAt: 1, openedAt: 1, _id: 1 })

  const openTrades = await Trade.find({ tradingAccountId: account._id, status: 'OPEN' })

  // Daily DD groups by trading day — we track the highest balance seen so far
  // on the day, and DD = (dayHigh - currentBalance) / dayHigh.
  let runningBalance = initialBalance
  let breachTrade = null
  let breachIndex = -1
  let breachReason = null
  let dayKey = null
  let dayStartBalance = initialBalance
  let dayHighBalance = initialBalance

  const ledger = []

  for (let i = 0; i < closedTrades.length; i += 1) {
    const t = closedTrades[i]
    const closedAt = t.closedAt || t.openedAt || account.createdAt
    const tDayKey = new Date(closedAt).toDateString()

    // First trade, or new trading day → reset day anchors
    if (dayKey === null || tDayKey !== dayKey) {
      dayKey = tDayKey
      dayStartBalance = runningBalance
      dayHighBalance = runningBalance
    }

    const pnl = Number(t.realizedPnl) || 0
    runningBalance += pnl
    if (runningBalance > dayHighBalance) dayHighBalance = runningBalance

    const dailyDD = dayHighBalance > 0
      ? Math.max(0, ((dayHighBalance - runningBalance) / dayHighBalance) * 100)
      : 0
    const overallDD = initialBalance > 0
      ? Math.max(0, ((initialBalance - runningBalance) / initialBalance) * 100)
      : 0

    ledger.push({
      idx: i,
      tradeId: t.tradeId,
      symbol: t.symbol,
      side: t.side,
      closedAt: closedAt,
      pnl: pnl.toFixed(2),
      runningBalance: runningBalance.toFixed(2),
      dailyDD: dailyDD.toFixed(2) + '%',
      overallDD: overallDD.toFixed(2) + '%'
    })

    if (maxDailyDD != null && dailyDD >= maxDailyDD) {
      breachTrade = t
      breachIndex = i
      breachReason = `Daily drawdown limit (${maxDailyDD}%) exceeded — reconciled at trade ${t.tradeId}`
      break
    }
    if (maxOverallDD != null && overallDD >= maxOverallDD) {
      breachTrade = t
      breachIndex = i
      breachReason = `Overall drawdown limit (${maxOverallDD}%) exceeded — reconciled at trade ${t.tradeId}`
      break
    }
  }

  console.log('\n--- TRADE REPLAY (chronological) ---')
  console.table(ledger)

  if (!breachTrade) {
    console.log('\n[Reconcile] No drawdown breach found while replaying closed trades.')
    console.log('Nothing to do — the account state on disk should be fine. Aborting without changes.')
    await mongoose.disconnect()
    return
  }

  const tradesToDelete = closedTrades.slice(breachIndex + 1)

  console.log('\n--- PLAN ---')
  console.log({
    breachAtTradeId: breachTrade.tradeId,
    breachAtIndex: breachIndex,
    breachReason,
    reconciledBalance: runningBalance.toFixed(2),
    reconciledEquity: runningBalance.toFixed(2),
    setStatus: 'FAILED',
    deleteClosedTradesAfterBreach: tradesToDelete.length,
    forceCloseRemainingOpens: openTrades.length
  })

  if (tradesToDelete.length > 0) {
    console.log('\nTrades that will be DELETED (closed after the breach):')
    console.table(tradesToDelete.map(t => ({
      tradeId: t.tradeId,
      symbol: t.symbol,
      side: t.side,
      closedAt: t.closedAt,
      realizedPnl: t.realizedPnl
    })))
  }

  if (!APPLY) {
    console.log('\nDRY-RUN complete. Re-run with --apply to write changes.\n')
    await mongoose.disconnect()
    return
  }

  // ---- APPLY ----

  // 1. Delete trades that closed after the breach
  if (tradesToDelete.length > 0) {
    const ids = tradesToDelete.map(t => t._id)
    const del = await Trade.deleteMany({ _id: { $in: ids } })
    console.log(`[Reconcile] Deleted ${del.deletedCount} closed trade(s) after the breach.`)
  }

  // 2. Force-close any still-open trades at openPrice (zero raw P&L)
  let closedOpens = 0
  for (const t of openTrades) {
    const r = await Trade.findOneAndUpdate(
      { _id: t._id, status: 'OPEN' },
      {
        status: 'CLOSED',
        closePrice: t.openPrice,
        closedAt: new Date(),
        closedBy: 'STOP_OUT',
        realizedPnl: 0
      },
      { new: true }
    )
    if (r) closedOpens += 1
  }
  if (closedOpens > 0) {
    console.log(`[Reconcile] Force-closed ${closedOpens} open trade(s) at openPrice (zero P&L).`)
  }

  // 3. Recompute drawdown % at the breach point so the dashboard shows the
  //    breach numbers, not 153% / 152% nonsense.
  const finalDailyDD = dayHighBalance > 0
    ? Math.min(100, Math.max(0, ((dayHighBalance - runningBalance) / dayHighBalance) * 100))
    : 0
  const finalOverallDD = initialBalance > 0
    ? Math.min(100, Math.max(0, ((initialBalance - runningBalance) / initialBalance) * 100))
    : 0

  // 4. Patch the account
  account.currentBalance = runningBalance
  account.currentEquity = runningBalance
  account.openTradesCount = 0
  account.currentDailyDrawdownPercent = finalDailyDD
  account.currentOverallDrawdownPercent = finalOverallDD
  account.maxDailyDrawdownHit = Math.max(account.maxDailyDrawdownHit || 0, finalDailyDD)
  account.maxOverallDrawdownHit = Math.max(account.maxOverallDrawdownHit || 0, finalOverallDD)
  account.lowestEquityToday = Math.min(account.lowestEquityToday ?? runningBalance, runningBalance)
  account.lowestEquityOverall = Math.min(account.lowestEquityOverall ?? runningBalance, runningBalance)
  account.totalProfitLoss = runningBalance - initialBalance

  if (account.status !== 'FAILED') {
    account.status = 'FAILED'
    account.failedAt = breachTrade.closedAt || new Date()
    account.failReason = breachReason
    account.violations.push({
      rule: 'ADMIN_RECONCILE',
      description: breachReason,
      severity: 'FAIL',
      tradeId: breachTrade._id,
      timestamp: new Date()
    })
  }

  await account.save()
  console.log('[Reconcile] Account document updated.')

  const fresh = await ChallengeAccount.findById(account._id)
  console.log('\n--- AFTER ---')
  console.log({
    accountId: fresh.accountId,
    status: fresh.status,
    currentBalance: fresh.currentBalance,
    currentEquity: fresh.currentEquity,
    openTradesCount: fresh.openTradesCount,
    currentDailyDD: fresh.currentDailyDrawdownPercent,
    currentOverallDD: fresh.currentOverallDrawdownPercent,
    failReason: fresh.failReason
  })

  await mongoose.disconnect()
}

main().catch(err => {
  console.error('[Reconcile] FAILED:', err)
  process.exit(1)
})
