import express from 'express'
import Instrument from '../models/Instrument.js'
import { invalidateInstrumentCache } from '../services/instrumentRegistry.js'
import {
  INFOWAY_SYMBOL_MAP,
  POPULAR_INSTRUMENTS,
  categorizeSymbol,
  getInstrumentName,
  getDigits,
  getContractSize
} from './prices.js'

const router = express.Router()

function requireAdmin(req, res, next) {
  if (!req.admin) return res.status(403).json({ success: false, message: 'Admin only' })
  next()
}

// Pip defaults by segment. Same logic AdminInstruments.jsx uses client-side
// so seeded rows match what the admin would have entered by hand.
function defaultsForSegment(segment, symbol) {
  if (segment === 'Crypto') return { pipSize: 0.01, pipValue: 1 }
  if (segment === 'Metals') return { pipSize: 0.01, pipValue: 1 }
  if (segment === 'Indices') return { pipSize: 0.1, pipValue: 1 }
  if (segment === 'Commodities') return { pipSize: 0.01, pipValue: 10 }
  // Forex
  return { pipSize: symbol.endsWith('JPY') ? 0.01 : 0.0001, pipValue: 10 }
}

function deriveBaseQuote(symbol, segment) {
  // Crypto / forex pairs are 6 chars in our internal convention (e.g. BTCUSD, EURUSD)
  if (segment === 'Crypto' || segment === 'Forex') {
    if (symbol.length === 6) return { baseCurrency: symbol.slice(0, 3), quoteCurrency: symbol.slice(3) }
  }
  if (segment === 'Metals') return { baseCurrency: symbol.slice(0, 3), quoteCurrency: symbol.slice(3) }
  return { baseCurrency: '', quoteCurrency: 'USD' }
}

// GET /api/instruments — list all (used by admin UI and dropdowns).
router.get('/', async (req, res) => {
  try {
    const { segment, activeOnly } = req.query
    const query = {}
    if (segment) query.segment = segment
    if (activeOnly === 'true') query.isActive = true
    const instruments = await Instrument.find(query).sort({ segment: 1, symbol: 1 })
    res.json({ success: true, instruments })
  } catch (error) {
    console.error('Error fetching instruments:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/instruments — create (admin).
router.post('/', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {}
    if (!body.symbol || !body.name || !body.segment || !body.infowayCode) {
      return res.status(400).json({ success: false, message: 'symbol, name, segment, infowayCode are required' })
    }

    const symbol = String(body.symbol).toUpperCase().trim()
    const existing = await Instrument.findOne({ symbol })
    if (existing) {
      return res.status(409).json({ success: false, message: `Symbol ${symbol} already exists` })
    }

    const instrument = await Instrument.create({
      symbol,
      name: body.name,
      segment: body.segment,
      infowayCode: body.infowayCode,
      baseCurrency: body.baseCurrency || '',
      quoteCurrency: body.quoteCurrency || 'USD',
      contractSize: body.contractSize,
      pipSize: body.pipSize,
      pipValue: body.pipValue,
      digits: body.digits,
      minLotSize: body.minLotSize,
      maxLotSize: body.maxLotSize,
      lotStep: body.lotStep,
      tradingViewSymbol: body.tradingViewSymbol || '',
      popular: !!body.popular,
      isActive: body.isActive !== false
    })

    invalidateInstrumentCache()
    res.status(201).json({ success: true, instrument })
  } catch (error) {
    console.error('Error creating instrument:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// PUT /api/instruments/:id — update (admin).
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const update = { ...req.body }
    if (update.symbol) update.symbol = String(update.symbol).toUpperCase().trim()
    const instrument = await Instrument.findByIdAndUpdate(req.params.id, update, { new: true })
    if (!instrument) return res.status(404).json({ success: false, message: 'Instrument not found' })
    invalidateInstrumentCache()
    res.json({ success: true, instrument })
  } catch (error) {
    console.error('Error updating instrument:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// DELETE /api/instruments/:id — remove (admin).
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const instrument = await Instrument.findByIdAndDelete(req.params.id)
    if (!instrument) return res.status(404).json({ success: false, message: 'Instrument not found' })
    invalidateInstrumentCache()
    res.json({ success: true, message: 'Instrument deleted' })
  } catch (error) {
    console.error('Error deleting instrument:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// POST /api/instruments/seed-from-legacy — one-click import every symbol in the
// hardcoded INFOWAY_SYMBOL_MAP into the Instrument collection. Idempotent: any
// symbol already in the DB is skipped, so it's safe to run multiple times.
router.post('/seed-from-legacy', requireAdmin, async (req, res) => {
  try {
    const existing = await Instrument.find({}).select('symbol').lean()
    const existingSet = new Set(existing.map(d => d.symbol))

    const docs = []
    for (const [symbol, infowayCode] of Object.entries(INFOWAY_SYMBOL_MAP)) {
      if (existingSet.has(symbol)) continue
      const segment = categorizeSymbol(symbol)
      const { pipSize, pipValue } = defaultsForSegment(segment, symbol)
      const { baseCurrency, quoteCurrency } = deriveBaseQuote(symbol, segment)
      const popular = POPULAR_INSTRUMENTS[segment]?.includes(symbol) || false
      docs.push({
        symbol,
        name: getInstrumentName(symbol),
        segment,
        infowayCode,
        baseCurrency,
        quoteCurrency,
        contractSize: getContractSize(symbol),
        pipSize,
        pipValue,
        digits: getDigits(symbol),
        minLotSize: 0.01,
        maxLotSize: 100,
        lotStep: 0.01,
        tradingViewSymbol: '',
        popular,
        isActive: true
      })
    }

    let inserted = 0
    if (docs.length > 0) {
      const result = await Instrument.insertMany(docs, { ordered: false })
      inserted = result.length
    }

    invalidateInstrumentCache()
    res.json({
      success: true,
      inserted,
      skipped: existingSet.size,
      message: `Imported ${inserted} instruments from the hardcoded catalog (skipped ${existingSet.size} already present).`
    })
  } catch (error) {
    console.error('Error seeding instruments:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
