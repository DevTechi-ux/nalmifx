// Helpers for filtering admin queries by Live vs Demo accounts.
//
// "Demo" = TradingAccount documents with isDemo=true.
// "Live" = everything else — non-demo TradingAccount + ChallengeAccount
//          (challenges are always real money).

import TradingAccount from '../models/TradingAccount.js'
import ChallengeAccount from '../models/ChallengeAccount.js'

// Resolve the list of trading-account _ids that are demo accounts.
// Optionally scope to a specific user.
export async function getDemoTradingAccountIds(userId = null) {
  const q = { isDemo: true }
  if (userId) q.userId = userId
  return await TradingAccount.find(q).distinct('_id')
}

export async function getNonDemoTradingAccountIds(userId = null) {
  const q = { isDemo: { $ne: true } }
  if (userId) q.userId = userId
  return await TradingAccount.find(q).distinct('_id')
}

// Build a Trade-collection mongo filter clause for Live vs Demo.
// Returns an object you can spread into your `find` query, or null
// when accountKind is unset / 'all'.
export async function buildTradeAccountKindFilter(accountKind, userId = null) {
  if (accountKind !== 'live' && accountKind !== 'demo') return null
  const demoIds = await getDemoTradingAccountIds(userId)
  if (accountKind === 'demo') {
    return { accountType: 'TradingAccount', tradingAccountId: { $in: demoIds } }
  }
  // live = challenge trades OR non-demo TradingAccount trades
  return {
    $or: [
      { accountType: 'ChallengeAccount' },
      { accountType: 'TradingAccount', tradingAccountId: { $nin: demoIds } },
      // legacy rows without accountType — treat as TradingAccount
      { accountType: { $exists: false }, tradingAccountId: { $nin: demoIds } }
    ]
  }
}

// Build a Transaction-collection mongo filter for Live vs Demo.
// Transaction rows reference a tradingAccountId for transfer types.
// Non-transfer rows (Deposit, Withdrawal, Admin_*, Challenge_Purchase)
// don't tie to a single trading account — for those we treat all as Live
// (they affect the user's main wallet, which is the live-money store).
export async function buildTransactionAccountKindFilter(accountKind, userId = null) {
  if (accountKind !== 'live' && accountKind !== 'demo') return null
  const demoIds = await getDemoTradingAccountIds(userId)
  if (accountKind === 'demo') {
    // Only transactions that explicitly target a demo trading account
    return { tradingAccountId: { $in: demoIds } }
  }
  // Live = everything except transactions on demo accounts.
  // i.e. tradingAccountId is null/absent OR not in the demo list.
  return {
    $or: [
      { tradingAccountId: { $exists: false } },
      { tradingAccountId: null },
      { tradingAccountId: { $nin: demoIds } }
    ]
  }
}
