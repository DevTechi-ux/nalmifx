import Instrument from '../models/Instrument.js'

// In-memory cache of admin-managed instruments. Refreshed on TTL expiry or
// whenever the admin mutates the collection (invalidateInstrumentCache).
let cache = null
let cacheLoadedAt = 0
const TTL_MS = 60 * 1000 // 60s safety refresh

async function load() {
  const docs = await Instrument.find({ isActive: true }).lean()
  const map = {}
  const bySegment = { Forex: [], Crypto: [], Commodities: [], Indices: [], Metals: [] }
  for (const d of docs) {
    map[d.symbol] = d
    if (bySegment[d.segment]) bySegment[d.segment].push(d.symbol)
  }
  cache = { map, bySegment, list: docs }
  cacheLoadedAt = Date.now()
  return cache
}

export async function getInstrumentRegistry() {
  if (!cache || Date.now() - cacheLoadedAt > TTL_MS) {
    try { await load() } catch (e) { console.error('Failed loading instruments:', e.message) }
  }
  return cache || { map: {}, bySegment: { Forex: [], Crypto: [], Commodities: [], Indices: [], Metals: [] }, list: [] }
}

export function invalidateInstrumentCache() {
  cache = null
  cacheLoadedAt = 0
}

// Returns { symbol → infowayCode } merging DB-managed instruments on top of
// the legacy hardcoded map. DB wins on collision so admins can override.
export async function getInfowaySymbolMap(legacyMap) {
  const reg = await getInstrumentRegistry()
  const merged = { ...legacyMap }
  for (const [symbol, doc] of Object.entries(reg.map)) {
    if (doc.infowayCode) merged[symbol] = doc.infowayCode
  }
  return merged
}

// Returns symbols for a given segment, merging hardcoded + DB symbols.
export async function getSegmentSymbols(segment, legacySymbols) {
  const reg = await getInstrumentRegistry()
  const dbSyms = reg.bySegment[segment] || []
  return Array.from(new Set([...(legacySymbols || []), ...dbSyms]))
}
