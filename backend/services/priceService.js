// Shared price fetching utilities

const ALLTICK_API_TOKEN = process.env.ALLTICK_API_TOKEN || ''
const ALLTICK_FOREX_API = 'https://quote.alltick.co/quote-b-api/depth-tick'

const ALLTICK_MAP = {
  'XAUUSD': 'GOLD',
  'XAGUSD': 'Silver',
  'BTCUSD': 'BTCUSDT',
  'ETHUSD': 'ETHUSDT'
}

// Fetch a single symbol's price from AllTick API.
// Returns { bid, ask } or null if unavailable.
export async function getFreshPrice(symbol) {
  try {
    const alltickCode = ALLTICK_MAP[symbol] || symbol
    const query = {
      trace: `fresh-${Date.now()}`,
      data: { symbol_list: [{ code: alltickCode }] }
    }
    const encodedQuery = encodeURIComponent(JSON.stringify(query))
    const url = `${ALLTICK_FOREX_API}?token=${ALLTICK_API_TOKEN}&query=${encodedQuery}`

    const response = await fetch(url)
    if (!response.ok) return null

    const data = await response.json()
    if (data.ret !== 200 || !data.data?.tick_list?.[0]) return null

    const tick = data.data.tick_list[0]
    const bid = tick.bids?.[0]?.price ? parseFloat(tick.bids[0].price) : null
    const ask = tick.asks?.[0]?.price ? parseFloat(tick.asks[0].price) : null

    if (bid && ask) return { bid, ask }
    if (bid) return { bid, ask: bid }
    return null
  } catch {
    return null
  }
}

// Supplement a prices object with AllTick prices for any missing symbols.
// Only fetches symbols in `neededSymbols` that are absent from `prices`.
export async function fillMissingPrices(prices, neededSymbols) {
  const missing = neededSymbols.filter(s => !prices[s] || !prices[s].bid)
  if (missing.length === 0) return prices

  const filled = { ...prices }
  await Promise.all(
    missing.map(async (symbol) => {
      const p = await getFreshPrice(symbol)
      if (p) {
        filled[symbol] = p
        console.log(`[PriceService] AllTick fallback for ${symbol}: bid=${p.bid} ask=${p.ask}`)
      } else {
        console.warn(`[PriceService] No price available for ${symbol} — SL/TP check skipped`)
      }
    })
  )
  return filled
}
