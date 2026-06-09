// Default profit-target percentages for prop-firm challenge phases.
//
// These are the fallbacks used when a challenge's `rules` don't specify a
// target. They MUST stay identical everywhere a phase target is read —
// the funding gate (propTradingEngine.checkProfitTarget), the real-time
// status, and the my-accounts card all compare/display against these. If
// they drift, the UI can show a target the engine doesn't actually enforce.
export const DEFAULT_PROFIT_TARGET_PHASE1_PERCENT = 8
export const DEFAULT_PROFIT_TARGET_PHASE2_PERCENT = 5

// Resolve the profit-target % for a given phase from a challenge's rules,
// falling back to the shared defaults above. `phase` is 1-based. Phase 1 uses
// the phase-1 target; phase 2 and any higher phase use the phase-2 target
// (higher phases are rare/defensive). Phase 0 / invalid phases have no target
// to chase (funded accounts), so they return 0.
export function resolvePhaseTargetPercent(rules = {}, phase) {
  if (phase === 1) {
    return rules.profitTargetPhase1Percent || DEFAULT_PROFIT_TARGET_PHASE1_PERCENT
  }
  if (phase >= 2) {
    return rules.profitTargetPhase2Percent || DEFAULT_PROFIT_TARGET_PHASE2_PERCENT
  }
  return 0
}
