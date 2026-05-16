import mongoose from 'mongoose'

const instrumentSchema = new mongoose.Schema({
  // Platform symbol the user sees (e.g. BTCUSD, EURUSD).
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  // Display name (e.g. "Bitcoin", "EUR/USD").
  name: {
    type: String,
    required: true,
    trim: true
  },
  segment: {
    type: String,
    enum: ['Forex', 'Crypto', 'Commodities', 'Indices', 'Metals'],
    required: true
  },
  // Upstream price-feed code (Infoway.io). Required for live prices to stream;
  // without it the symbol exists in DB but orders will be rejected by prices.js.
  infowayCode: {
    type: String,
    required: true,
    trim: true
  },
  baseCurrency: { type: String, default: '' },
  quoteCurrency: { type: String, default: 'USD' },
  contractSize: { type: Number, default: 100000 },
  pipSize: { type: Number, default: 0.0001 },
  pipValue: { type: Number, default: 10 },
  digits: { type: Number, default: 5 },
  minLotSize: { type: Number, default: 0.01 },
  maxLotSize: { type: Number, default: 100 },
  lotStep: { type: Number, default: 0.01 },
  tradingViewSymbol: { type: String, default: '' },
  popular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true })

export default mongoose.model('Instrument', instrumentSchema)
