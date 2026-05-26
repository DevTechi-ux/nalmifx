// Reconcile a corrupt challenge / funded account by replaying every closed
// trade in chronological order. The replay is phase-aware:
//
//   • After each trade, check (in this order):
//       1. Equity-zero  → status = FAILED, stop
//       2. Daily DD breach    → status = FAILED, stop
//       3. Overall DD breach  → status = FAILED, stop
//       4. Profit target hit  → advance currentPhase and reset phaseStartBalance
//                              (or if it was the final phase, status = PASSED, stop)
//
//   • On FAILED: delete every trade closed AFTER the breach trade — those
//     were taken on a paper-failed account and shouldn't sit in history.
//     Balance is clamped at 0; equity / drawdown fields are recomputed
//     from the replay so the dashboard stops showing 191% / 152% etc.
//
//   • On PASSED: keep all trades, set status = PASSED. Use the existing
//     admin "assign funded" action to spawn the funded account.
//
//   • If replay finishes with no outcome (still ACTIVE): only write the
//     phase-progression state if the replay shows phases that the live
//     account never advanced to.
//
// Usage:
//   DRY-RUN  : node backend/scripts/reconcile_challenge_account.js CH196289
//   APPLY    : node backend/scripts/reconcile_challenge_account.js CH196289 --apply

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import ChallengeAccount from '../models/ChallengeAccount.js'
import Challenge from '../models/Challenge.js'
import Trade from '../models/Trade.js'

// Load backend/.env regardless of the cwd the script is invoked from.
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
    currentPhase: `${account.currentPhase}/${account.totalPhases}`,
    initialBalance: account.initialBalance,
    currentBalance: account.currentBalance,
    currentEquity: account.currentEquity,
    phaseStartBalance: account.phaseStartBalance,
    openTradesCount: account.openTradesCount,
    currentDailyDD: account.currentDailyDrawdownPercent,
    currentOverallDD: account.currentOverallDrawdownPercent,
    failReason: account.failReason
  })

  const rules = account.challengeId?.rules || {}
  const maxDailyDD = rules.maxDailyDrawdownPercent
  const maxOverallDD = rules.maxOverallDrawdownPercent
  const phase1Target = rules.profitTargetPhase1Percent || 8
  const phase2Target = rules.profitTargetPhase2Percent || 5
  const initialBalance = account.initialBalance
  const totalPhases = account.totalPhases || 1

  console.log('\n--- RULES ---')
  console.log({
    totalPhases,
    phase1Target: phase1Target + '%',
    phase2Target: phase2Target + '%',
    maxDailyDD: (maxDailyDD ?? 'unset') + '%',
    maxOverallDD: (maxOverallDD ?? 'unset') + '%'
  })

  const closedTrades = await Trade.find({
    tradingAccountId: account._id,
    status: 'CLOSED'
  }).sort({ closedAt: 1, openedAt: 1, _id: 1 })

  const openTrades = await Trade.find({ tradingAccountId: account._id, status: 'OPEN' })

  // ---- Replay state ----
  let runningBalance = initialBalance
  let lowestOverall = initialBalance
  let highestOverall = initialBalance
  let currentPhase = 1
  let phaseStartBalance = initialBalance
  let dayKey = null
  let dayStartBalance = initialBalance
  let dayHighBalance = initialBalance
  let dayLowBalance = initialBalance

  // Outcome
  let outcome = null // 'FAILED' | 'PASSED' | null
  let outcomeTrade = null
  let outcomeIndex = -1
  let outcomeReason = null
  let outcomeDayStart = null
  let outcomeDayLow = null
  let outcomeDayHigh = null

  const phaseProgression = []
  const ledger = []

  for (let i = 0; i < closedTrades.length; i += 1) {
    const t = closedTrades[i]
    const closedAt = t.closedAt || t.openedAt || account.createdAt
    const tDayKey = new Date(closedAt).toDateString()

    if (dayKey === null || tDayKey !== dayKey) {
      dayKey = tDayKey
      dayStartBalance = runningBalance
      dayHighBalance = runningBalance
      dayLowBalance = runningBalance
    }

    const pnl = Number(t.realizedPnl) || 0
    runningBalance += pnl
    if (runningBalance > dayHighBalance) dayHighBalance = runningBalance
    if (runningBalance < dayLowBalance) dayLowBalance = runningBalance
    if (runningBalance < lowestOverall) lowestOverall = runningBalance
    if (runningBalance > highestOverall) highestOverall = runningBalance

    const dailyDD = dayHighBalance > 0
      ? Math.max(0, ((dayHighBalance - runningBalance) / dayHighBalance) * 100)
      : 0
    const overallDD = initialBalance > 0
      ? Math.max(0, ((initialBalance - runningBalance) / initialBalance) * 100)
      : 0
    const profitPct = phaseStartBalance > 0
      ? ((runningBalance - phaseStartBalance) / phaseStartBalance) * 100
      : 0

    ledger.push({
      idx: i,
      phase: currentPhase,
      tradeId: t.tradeId,
      symbol: t.symbol,
      side: t.side,
      pnl: pnl.toFixed(2),
      runningBalance: runningBalance.toFixed(2),
      profitPct: profitPct.toFixed(2) + '%',
      dailyDD: dailyDD.toFixed(2) + '%',
      overallDD: overallDD.toFixed(2) + '%'
    })

    // ---- 1. Equity-zero stop-out ----
    if (runningBalance <= 0) {
      outcome = 'FAILED'
      outcomeTrade = t
      outcomeIndex = i
      outcomeReason = 'Equity reached zero (stop-out)'
      outcomeDayStart = dayStartBalance
      outcomeDayLow = dayLowBalance
      outcomeDayHigh = dayHighBalance
      break
    }

    // ---- 2. Daily DD breach ----
    if (maxDailyDD != null && dailyDD >= maxDailyDD) {
      outcome = 'FAILED'
      outcomeTrade = t
      outcomeIndex = i
      outcomeReason = `Daily drawdown limit (${maxDailyDD}%) exceeded`
      outcomeDayStart = dayStartBalance
      outcomeDayLow = dayLowBalance
      outcomeDayHigh = dayHighBalance
      break
    }

    // ---- 3. Overall DD breach ----
    if (maxOverallDD != null && overallDD >= maxOverallDD) {
      outcome = 'FAILED'
      outcomeTrade = t
      outcomeIndex = i
      outcomeReason = `Overall drawdown limit (${maxOverallDD}%) exceeded`
      outcomeDayStart = dayStartBalance
      outcomeDayLow = dayLowBalance
      outcomeDayHigh = dayHighBalance
      break
    }

    // ---- 4. Profit target ----
    const targetPct = currentPhase === 1 ? phase1Target : phase2Target
    if (profitPct >= targetPct) {
      phaseProgression.push({
        phase: currentPhase,
        atTrade: t.tradeId,
        atTime: closedAt,
        balance: runningBalance.toFixed(2),
        profitPct: profitPct.toFixed(2) + '%',
        targetPct: targetPct + '%'
      })

      if (currentPhase < totalPhases) {
        // Advance to next phase
        currentPhase += 1
        phaseStartBalance = runningBalance
      } else {
        // Final phase cleared → PASSED
        outcome = 'PASSED'
        outcomeTrade = t
        outcomeIndex = i
        outcomeReason = `Phase ${currentPhase} target (${targetPct}%) hit — challenge passed`
        outcomeDayStart = dayStartBalance
        outcomeDayLow = dayLowBalance
        outcomeDayHigh = dayHighBalance
        break
      }
    }
  }

  console.log('\n--- PHASE PROGRESSION DURING REPLAY ---')
  if (phaseProgression.length > 0) {
    console.table(phaseProgression)
  } else {
    console.log('(no phase advanced during replay)')
  }

  console.log('\n--- TRADE REPLAY ---')
  console.table(ledger)

  // Nothing to change if the replay ended without a terminal outcome AND no
  // phase advanced — the account state on disk is consistent.
  if (!outcome && phaseProgression.length === 0) {
    console.log('\n[Reconcile] No breach, no phase change. Nothing to do.')
    await mongoose.disconnect()
    return
  }

  const tradesToDelete = outcomeIndex >= 0 ? closedTrades.slice(outcomeIndex + 1) : []
  const finalBalance = Math.max(0, runningBalance)

  console.log('\n--- PLAN ---')
  console.log({
    outcome: outcome || 'ACTIVE (only phase advancement)',
    breachAtTradeId: outcomeTrade?.tradeId || null,
    reason: outcomeReason,
    reconciledBalance: finalBalance.toFixed(2),
    reconciledPhase: `${currentPhase}/${totalPhases}`,
    reconciledPhaseStartBalance: phaseStartBalance.toFixed(2),
    setStatus: outcome || account.status,
    deleteTradesAfterOutcome: tradesToDelete.length,
    forceCloseRemainingOpens: outcome === 'FAILED' ? openTrades.length : 0
  })

  if (tradesToDelete.length > 0) {
    console.log('\nTrades that will be DELETED (closed after the outcome):')
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

  // 1. Delete trades after the outcome (only when FAILED)
  if (outcome === 'FAILED' && tradesToDelete.length > 0) {
    const ids = tradesToDelete.map(t => t._id)
    const del = await Trade.deleteMany({ _id: { $in: ids } })
    console.log(`[Reconcile] Deleted ${del.deletedCount} closed trade(s) after the breach.`)
  }

  // 2. Force-close any still-open trades (only when FAILED — passing accounts
  //    keep their opens alive for the funded handoff)
  let closedOpens = 0
  if (outcome === 'FAILED') {
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
  }

  // 3. Recount trades after deletions / closes
  const totalTradesNow = await Trade.countDocuments({ tradingAccountId: account._id })
  const openTradesNow = await Trade.countDocuments({ tradingAccountId: account._id, status: 'OPEN' })

  const refDay = new Date((outcomeTrade?.closedAt) || account.createdAt)
  const dayStartMs = new Date(refDay.getFullYear(), refDay.getMonth(), refDay.getDate())
  const dayEndMs = new Date(dayStartMs.getTime() + 24 * 60 * 60 * 1000)
  const tradesOnRefDay = await Trade.countDocuments({
    tradingAccountId: account._id,
    $or: [
      { closedAt: { $gte: dayStartMs, $lt: dayEndMs } },
      { openedAt: { $gte: dayStartMs, $lt: dayEndMs } }
    ]
  })

  // 4. Recompute drawdown % at the outcome point
  const finalDailyDD = (outcomeDayHigh || dayHighBalance) > 0
    ? Math.min(100, Math.max(0, (((outcomeDayHigh || dayHighBalance) - finalBalance) / (outcomeDayHigh || dayHighBalance)) * 100))
    : 0
  const finalOverallDD = initialBalance > 0
    ? Math.min(100, Math.max(0, ((initialBalance - finalBalance) / initialBalance) * 100))
    : 0

  // 5. Patch the account
  account.currentBalance = finalBalance
  account.currentEquity = finalBalance
  account.currentPhase = currentPhase
  account.phaseStartBalance = phaseStartBalance
  account.openTradesCount = openTradesNow
  account.currentDailyDrawdownPercent = finalDailyDD
  account.currentOverallDrawdownPercent = finalOverallDD
  account.maxDailyDrawdownHit = Math.max(account.maxDailyDrawdownHit || 0, finalDailyDD)
  account.maxOverallDrawdownHit = Math.max(account.maxOverallDrawdownHit || 0, finalOverallDD)
  account.lowestEquityToday = Math.max(0, outcomeDayLow != null ? outcomeDayLow : finalBalance)
  account.lowestEquityOverall = Math.max(0, lowestOverall)
  account.dayStartEquity = outcomeDayStart != null ? outcomeDayStart : initialBalance
  account.highestEquity = Math.max(initialBalance, highestOverall)
  account.totalProfitLoss = finalBalance - initialBalance
  // Profit % is for "target progress" — never negative, zeroed on FAILED.
  if (outcome === 'PASSED') {
    account.currentProfitPercent = Math.max(0, ((finalBalance - phaseStartBalance) / phaseStartBalance) * 100)
  } else if (outcome === 'FAILED') {
    account.currentProfitPercent = 0
  } else {
    account.currentProfitPercent = Math.max(0, ((finalBalance - phaseStartBalance) / phaseStartBalance) * 100)
  }
  account.totalTrades = totalTradesNow
  account.tradesToday = tradesOnRefDay

  if (outcome === 'FAILED') {
    if (account.status !== 'FAILED') {
      account.status = 'FAILED'
      account.failedAt = outcomeTrade.closedAt || new Date()
      account.failReason = outcomeReason
      account.violations.push({
        rule: 'ADMIN_RECONCILE',
        description: outcomeReason,
        severity: 'FAIL',
        tradeId: outcomeTrade._id,
        timestamp: new Date()
      })
    }
  } else if (outcome === 'PASSED') {
    if (account.status !== 'PASSED' && account.status !== 'FUNDED') {
      account.status = 'PASSED'
      account.passedAt = outcomeTrade.closedAt || new Date()
      account.violations.push({
        rule: 'ADMIN_RECONCILE',
        description: outcomeReason,
        severity: 'WARNING',
        tradeId: outcomeTrade._id,
        timestamp: new Date()
      })
    }
  }
  // If outcome is null (no breach, no pass) but phaseProgression is non-empty,
  // we've already written the advanced currentPhase + phaseStartBalance above.

  await account.save()
  console.log('[Reconcile] Account document updated.')
  console.log(`[Reconcile] Counts → totalTrades=${totalTradesNow}, tradesToday=${tradesOnRefDay}, openTradesCount=${openTradesNow}`)

  const fresh = await ChallengeAccount.findById(account._id)
  console.log('\n--- AFTER ---')
  console.log({
    accountId: fresh.accountId,
    status: fresh.status,
    currentPhase: `${fresh.currentPhase}/${fresh.totalPhases}`,
    currentBalance: fresh.currentBalance,
    currentEquity: fresh.currentEquity,
    phaseStartBalance: fresh.phaseStartBalance,
    openTradesCount: fresh.openTradesCount,
    totalTrades: fresh.totalTrades,
    tradesToday: fresh.tradesToday,
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
