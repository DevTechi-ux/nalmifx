import dotenv from 'dotenv'
dotenv.config()
import express from 'express'

const router = express.Router()

// ============================================================
// INFOWAY.IO API CONFIGURATION
// Documentation: https://docs.infoway.io/en-docs/rest-api/market-data
// ============================================================

const INFOWAY_API_KEY = process.env.INFOWAY_API_KEY || 'your_infoway_api_key_here'

// Infoway.io HTTP API endpoints
const INFOWAY_HTTP_CRYPTO = 'https://data.infoway.io/crypto/batch_depth'
const INFOWAY_HTTP_COMMON = 'https://data.infoway.io/common/batch_depth'

// Infoway.io symbol mapping (internal -> Infoway code)
// Crypto symbols use USDT suffix, Forex/Metals/Commodities use standard codes
const INFOWAY_SYMBOL_MAP = {
  // ========== FOREX MAJORS (7) ==========
  'EURUSD': 'EURUSD', 'GBPUSD': 'GBPUSD', 'USDJPY': 'USDJPY', 'USDCHF': 'USDCHF',
  'AUDUSD': 'AUDUSD', 'NZDUSD': 'NZDUSD', 'USDCAD': 'USDCAD',
  
  // ========== FOREX CROSSES (21) ==========
  'EURGBP': 'EURGBP', 'EURJPY': 'EURJPY', 'GBPJPY': 'GBPJPY', 'EURCHF': 'EURCHF',
  'EURAUD': 'EURAUD', 'EURCAD': 'EURCAD', 'GBPAUD': 'GBPAUD', 'GBPCAD': 'GBPCAD',
  'AUDCAD': 'AUDCAD', 'AUDJPY': 'AUDJPY', 'CADJPY': 'CADJPY', 'CHFJPY': 'CHFJPY',
  'NZDJPY': 'NZDJPY', 'AUDNZD': 'AUDNZD', 'CADCHF': 'CADCHF', 'GBPCHF': 'GBPCHF',
  'GBPNZD': 'GBPNZD', 'EURNZD': 'EURNZD', 'NZDCAD': 'NZDCAD', 'NZDCHF': 'NZDCHF',
  'AUDCHF': 'AUDCHF',
  
  // ========== FOREX SUPPORTED BY INFOWAY.IO (12) ==========
  // Only pairs actually supported by Infoway.io API
  'USDSGD': 'USDSGD', 'EURSGD': 'EURSGD', 'GBPSGD': 'GBPSGD', 'AUDSGD': 'AUDSGD',
  'SGDJPY': 'SGDJPY', 'USDHKD': 'USDHKD', 'USDCNH': 'USDCNH', 'USDRUB': 'USDRUB',
  'USDTHB': 'USDTHB', 'USDTWD': 'USDTWD', 'HKDJPY': 'HKDJPY', 'SGDCHF': 'SGDCHF',
  
  // ========== METALS (4) ==========
  'XAUUSD': 'XAUUSD', 'XAGUSD': 'XAGUSD', 'XPTUSD': 'XPTUSD', 'XPDUSD': 'XPDUSD',
  
  // ========== COMMODITIES (6) - Using Infoway.io symbol codes ==========
  'USOIL': 'USOIL', 'UKOIL': 'UKOIL', 'NGAS': 'NGAS', 
  'COPPER': 'XCUUSD', 'ALUMINUM': 'XALUSD', 'NICKEL': 'XNIUSD',
  
  // ========== CRYPTO (100+ coins) ==========
  'BTCUSD': 'BTCUSDT', 'ETHUSD': 'ETHUSDT', 'BNBUSD': 'BNBUSDT', 'SOLUSD': 'SOLUSDT',
  'XRPUSD': 'XRPUSDT', 'ADAUSD': 'ADAUSDT', 'DOGEUSD': 'DOGEUSDT', 'TRXUSD': 'TRXUSDT',
  'LINKUSD': 'LINKUSDT', 'MATICUSD': 'MATICUSDT', 'DOTUSD': 'DOTUSDT',
  'SHIBUSD': 'SHIBUSDT', 'LTCUSD': 'LTCUSDT', 'BCHUSD': 'BCHUSDT', 'AVAXUSD': 'AVAXUSDT',
  'XLMUSD': 'XLMUSDT', 'UNIUSD': 'UNIUSDT', 'ATOMUSD': 'ATOMUSDT', 'ETCUSD': 'ETCUSDT',
  'FILUSD': 'FILUSDT', 'ICPUSD': 'ICPUSDT', 'VETUSD': 'VETUSDT',
  'NEARUSD': 'NEARUSDT', 'GRTUSD': 'GRTUSDT', 'AAVEUSD': 'AAVEUSDT', 'MKRUSD': 'MKRUSDT',
  'ALGOUSD': 'ALGOUSDT', 'FTMUSD': 'FTMUSDT', 'SANDUSD': 'SANDUSDT', 'MANAUSD': 'MANAUSDT',
  'AXSUSD': 'AXSUSDT', 'THETAUSD': 'THETAUSDT', 'XMRUSD': 'XMRUSDT', 'FLOWUSD': 'FLOWUSDT',
  'SNXUSD': 'SNXUSDT', 'EOSUSD': 'EOSUSDT', 'CHZUSD': 'CHZUSDT', 'ENJUSD': 'ENJUSDT',
  'ZILUSD': 'ZILUSDT', 'BATUSD': 'BATUSDT', 'CRVUSD': 'CRVUSDT', 'COMPUSD': 'COMPUSDT',
  'SUSHIUSD': 'SUSHIUSDT', 'ZRXUSD': 'ZRXUSDT', 'LRCUSD': 'LRCUSDT', 'ANKRUSD': 'ANKRUSDT',
  'GALAUSD': 'GALAUSDT', 'APEUSD': 'APEUSDT', 'WAVESUSD': 'WAVESUSDT', 'ZECUSD': 'ZECUSDT',
  'PEPEUSD': 'PEPEUSDT', 'ARBUSD': 'ARBUSDT', 'OPUSD': 'OPUSDT', 'SUIUSD': 'SUIUSDT',
  'APTUSD': 'APTUSDT', 'INJUSD': 'INJUSDT', 'LDOUSD': 'LDOUSDT', 'IMXUSD': 'IMXUSDT',
  'RUNEUSD': 'RUNEUSDT', 'KAVAUSD': 'KAVAUSDT', 'KSMUSD': 'KSMUSDT', 'NEOUSD': 'NEOUSDT',
  'QNTUSD': 'QNTUSDT', 'FETUSD': 'FETUSDT', 'RNDRUSD': 'RNDRUSDT', 'OCEANUSD': 'OCEANUSDT',
  'WLDUSD': 'WLDUSDT', 'SEIUSD': 'SEIUSDT', 'TIAUSD': 'TIAUSDT', 'BLURUSD': 'BLURUSDT',
  'ROSEUSD': 'ROSEUSDT', 'MINAUSD': 'MINAUSDT', 'GMXUSD': 'GMXUSDT', 'DYDXUSD': 'DYDXUSDT',
  'STXUSD': 'STXUSDT', 'CFXUSD': 'CFXUSDT', 'ACHUSD': 'ACHUSDT', 'DASHUSD': 'DASHUSDT',
  'XTZUSD': 'XTZUSDT', 'IOTUSD': 'IOTAUSDT', 'CELOUSD': 'CELOUSDT', 'ONEUSD': 'ONEUSDT',
  'HOTUSD': 'HOTUSDT', 'SKLUSD': 'SKLUSDT', 'STORJUSD': 'STORJUSDT', 'YFIUSD': 'YFIUSDT',
  'UMAUSD': 'UMAUSDT', 'BANDUSD': 'BANDUSDT', 'RVNUSD': 'RVNUSDT', 'OXTUSD': 'OXTUSDT',
  'NKNUSD': 'NKNUSDT', 'WOOUSD': 'WOOUSDT', 'JASMYUSD': 'JASMYUSDT',
  'MASKUSD': 'MASKUSDT', 'DENTUSD': 'DENTUSDT', 'CELRUSD': 'CELRUSDT', 'COTIUSD': 'COTIUSDT',
  'IOTXUSD': 'IOTXUSDT', 'KLAYUSD': 'KLAYUSDT', 'OGNUSD': 'OGNUSDT',
  'RLCUSD': 'RLCUSDT', 'STMXUSD': 'STMXUSDT', 'SUNUSD': 'SUNUSDT', 'SXPUSD': 'SXPUSDT',
  'AUDIOUSD': 'AUDIOUSDT', 'BONKUSD': 'BONKUSDT', 'FLOKIUSD': 'FLOKIUSDT', 'ORDIUSD': 'ORDIUSDT',
  '1INCHUSD': '1INCHUSDT', 'HBARUSD': 'HBARUSDT', 'TONUSD': 'TONUSDT'
}

// Popular instruments per category (shown by default - 15 max)
const POPULAR_INSTRUMENTS = {
  Forex: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD', 'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'AUDCAD', 'AUDJPY', 'CADJPY'],
  Metals: ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'],
  Commodities: ['USOIL', 'UKOIL', 'NGAS', 'COPPER', 'ALUMINUM', 'NICKEL'],
  Crypto: ['BTCUSD', 'ETHUSD', 'BNBUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'DOGEUSD', 'DOTUSD', 'MATICUSD', 'LTCUSD', 'AVAXUSD', 'LINKUSD', 'SHIBUSD', 'UNIUSD', 'ATOMUSD']
}

// Reverse mapping (Infoway code -> internal symbol)
const INFOWAY_REVERSE_MAP = Object.fromEntries(
  Object.entries(INFOWAY_SYMBOL_MAP).map(([k, v]) => [v, k])
)

// Categorize symbols
const CRYPTO_SYMBOLS = Object.keys(INFOWAY_SYMBOL_MAP).filter(s => 
  INFOWAY_SYMBOL_MAP[s].endsWith('USDT')
)
const COMMON_SYMBOLS = Object.keys(INFOWAY_SYMBOL_MAP).filter(s => 
  !INFOWAY_SYMBOL_MAP[s].endsWith('USDT')
)

// All supported symbols
const INFOWAY_SYMBOLS = Object.keys(INFOWAY_SYMBOL_MAP)

// Fetch single price from Infoway.io API
async function getInfowayPrice(symbol) {
  try {
    const infowayCode = INFOWAY_SYMBOL_MAP[symbol]
    if (!infowayCode) {
      console.error(`No Infoway mapping for symbol: ${symbol}`)
      return null
    }

    // Determine which endpoint to use based on symbol type
    const isCrypto = infowayCode.endsWith('USDT')
    const baseUrl = isCrypto ? INFOWAY_HTTP_CRYPTO : INFOWAY_HTTP_COMMON
    const url = `${baseUrl}/${infowayCode}`
    
    const response = await fetch(url, {
      headers: { 'apiKey': INFOWAY_API_KEY }
    })
    
    if (!response.ok) {
      console.error(`Infoway error for ${symbol}: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    if (data.ret !== 200 || !data.data?.[0]) {
      console.error(`Infoway invalid response for ${symbol}:`, data.msg || 'No data')
      return null
    }
    
    const item = data.data[0]
    // b[0][0] = best bid price, a[0][0] = best ask price
    const bid = item.b?.[0]?.[0] ? parseFloat(item.b[0][0]) : null
    const ask = item.a?.[0]?.[0] ? parseFloat(item.a[0][0]) : null
    
    if (bid && ask) {
      return { bid, ask }
    } else if (bid) {
      return { bid, ask: bid }
    }
    return null
  } catch (e) {
    console.error(`Infoway error for ${symbol}:`, e.message)
    return null
  }
}

// Fetch multiple prices from Infoway.io API
async function getInfowayBatchPrices(symbols) {
  const prices = {}
  
  try {
    // Filter to only symbols we have mappings for
    const validSymbols = symbols.filter(s => INFOWAY_SYMBOL_MAP[s])
    
    // Separate crypto and common symbols
    const cryptoSymbols = validSymbols.filter(s => INFOWAY_SYMBOL_MAP[s].endsWith('USDT'))
    const commonSymbols = validSymbols.filter(s => !INFOWAY_SYMBOL_MAP[s].endsWith('USDT'))
    
    // Fetch crypto prices
    if (cryptoSymbols.length > 0) {
      try {
        const cryptoCodes = cryptoSymbols.map(s => INFOWAY_SYMBOL_MAP[s]).join(',')
        const url = `${INFOWAY_HTTP_CRYPTO}/${cryptoCodes}`
        
        const response = await fetch(url, {
          headers: { 'apiKey': INFOWAY_API_KEY }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.ret === 200 && data.data) {
            for (const item of data.data) {
              const internalSymbol = INFOWAY_REVERSE_MAP[item.s]
              if (!internalSymbol) continue
              
              const bid = item.b?.[0]?.[0] ? parseFloat(item.b[0][0]) : null
              const ask = item.a?.[0]?.[0] ? parseFloat(item.a[0][0]) : null
              
              if (bid && ask) {
                prices[internalSymbol] = { bid, ask }
              } else if (bid) {
                prices[internalSymbol] = { bid, ask: bid }
              }
            }
          }
        }
      } catch (e) {
        console.error('Infoway crypto batch error:', e.message)
      }
    }
    
    // Fetch common (forex/metals/commodities) prices
    if (commonSymbols.length > 0) {
      try {
        const commonCodes = commonSymbols.map(s => INFOWAY_SYMBOL_MAP[s]).join(',')
        const url = `${INFOWAY_HTTP_COMMON}/${commonCodes}`
        
        const response = await fetch(url, {
          headers: { 'apiKey': INFOWAY_API_KEY }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.ret === 200 && data.data) {
            for (const item of data.data) {
              const internalSymbol = INFOWAY_REVERSE_MAP[item.s]
              if (!internalSymbol) continue
              
              const bid = item.b?.[0]?.[0] ? parseFloat(item.b[0][0]) : null
              const ask = item.a?.[0]?.[0] ? parseFloat(item.a[0][0]) : null
              
              if (bid && ask) {
                prices[internalSymbol] = { bid, ask }
              } else if (bid) {
                prices[internalSymbol] = { bid, ask: bid }
              }
            }
          }
        }
      } catch (e) {
        console.error('Infoway common batch error:', e.message)
      }
    }
    
    return prices
  } catch (e) {
    console.error('Infoway batch error:', e.message)
    return prices
  }
}

// Helper function to categorize symbols
function categorizeSymbol(symbol) {
  if (!symbol) return 'Forex'
  const s = symbol.toUpperCase()
  if (s.includes('XAU') || s.includes('XAG') || s.includes('XPT') || s.includes('XPD')) {
    return 'Metals'
  }
  if (s.includes('OIL') || s.includes('BRENT') || s.includes('WTI') || s === 'NGAS' || s === 'COPPER' || s === 'ALUMINUM' || s === 'NICKEL') {
    return 'Commodities'
  }
  if (CRYPTO_SYMBOLS.includes(symbol)) {
    return 'Crypto'
  }
  return 'Forex'
}

// Helper function to get crypto names
function getCryptoName(symbol) {
  const names = {
    'BTCUSD': 'Bitcoin',
    'ETHUSD': 'Ethereum',
    'BNBUSD': 'BNB',
    'SOLUSD': 'Solana',
    'XRPUSD': 'XRP',
    'ADAUSD': 'Cardano',
    'DOGEUSD': 'Dogecoin',
    'DOTUSD': 'Polkadot',
    'MATICUSD': 'Polygon',
    'LTCUSD': 'Litecoin',
    'AVAXUSD': 'Avalanche',
    'LINKUSD': 'Chainlink'
  }
  return names[symbol] || symbol
}

// Default instruments fallback
function getDefaultInstruments() {
  return [
    { symbol: 'EURUSD', name: 'EUR/USD', category: 'Forex', digits: 5 },
    { symbol: 'GBPUSD', name: 'GBP/USD', category: 'Forex', digits: 5 },
    { symbol: 'USDJPY', name: 'USD/JPY', category: 'Forex', digits: 3 },
    { symbol: 'USDCHF', name: 'USD/CHF', category: 'Forex', digits: 5 },
    { symbol: 'AUDUSD', name: 'AUD/USD', category: 'Forex', digits: 5 },
    { symbol: 'NZDUSD', name: 'NZD/USD', category: 'Forex', digits: 5 },
    { symbol: 'USDCAD', name: 'USD/CAD', category: 'Forex', digits: 5 },
    { symbol: 'EURGBP', name: 'EUR/GBP', category: 'Forex', digits: 5 },
    { symbol: 'EURJPY', name: 'EUR/JPY', category: 'Forex', digits: 3 },
    { symbol: 'GBPJPY', name: 'GBP/JPY', category: 'Forex', digits: 3 },
    { symbol: 'XAUUSD', name: 'Gold', category: 'Metals', digits: 2 },
    { symbol: 'XAGUSD', name: 'Silver', category: 'Metals', digits: 3 },
    { symbol: 'BTCUSD', name: 'Bitcoin', category: 'Crypto', digits: 2 },
    { symbol: 'ETHUSD', name: 'Ethereum', category: 'Crypto', digits: 2 },
  ]
}

// GET /api/prices/instruments - Get all available instruments (MUST be before /:symbol)
router.get('/instruments', async (req, res) => {
  try {
    console.log('Returning Infoway.io supported instruments')
    
    const instruments = INFOWAY_SYMBOLS.map(symbol => {
      const category = categorizeSymbol(symbol)
      const isPopular = POPULAR_INSTRUMENTS[category]?.includes(symbol) || false
      return {
        symbol,
        name: getInstrumentName(symbol),
        category,
        digits: getDigits(symbol),
        contractSize: getContractSize(symbol),
        minVolume: 0.01,
        maxVolume: 100,
        volumeStep: 0.01,
        popular: isPopular
      }
    })
    
    console.log('Returning', instruments.length, 'Infoway instruments')
    res.json({ success: true, instruments })
  } catch (error) {
    console.error('Error fetching instruments:', error)
    res.json({ success: true, instruments: getDefaultInstruments() })
  }
})

// Helper to get instrument display name
function getInstrumentName(symbol) {
  const names = {
    // Forex Majors & Crosses
    'EURUSD': 'EUR/USD', 'GBPUSD': 'GBP/USD', 'USDJPY': 'USD/JPY', 'USDCHF': 'USD/CHF',
    'AUDUSD': 'AUD/USD', 'NZDUSD': 'NZD/USD', 'USDCAD': 'USD/CAD', 'EURGBP': 'EUR/GBP',
    'EURJPY': 'EUR/JPY', 'GBPJPY': 'GBP/JPY', 'EURCHF': 'EUR/CHF', 'EURAUD': 'EUR/AUD',
    'EURCAD': 'EUR/CAD', 'GBPAUD': 'GBP/AUD', 'GBPCAD': 'GBP/CAD', 'AUDCAD': 'AUD/CAD',
    'AUDJPY': 'AUD/JPY', 'CADJPY': 'CAD/JPY', 'CHFJPY': 'CHF/JPY', 'NZDJPY': 'NZD/JPY',
    'AUDNZD': 'AUD/NZD', 'CADCHF': 'CAD/CHF', 'GBPCHF': 'GBP/CHF', 'GBPNZD': 'GBP/NZD',
    'EURNZD': 'EUR/NZD', 'NZDCAD': 'NZD/CAD', 'NZDCHF': 'NZD/CHF', 'AUDCHF': 'AUD/CHF',
    'EURSGD': 'EUR/SGD', 'USDSGD': 'USD/SGD', 'GBPSGD': 'GBP/SGD', 'AUDSGD': 'AUD/SGD',
    'SGDJPY': 'SGD/JPY', 'USDHKD': 'USD/HKD', 'USDZAR': 'USD/ZAR', 'EURZAR': 'EUR/ZAR',
    'GBPZAR': 'GBP/ZAR', 'ZARJPY': 'ZAR/JPY', 'USDTRY': 'USD/TRY', 'EURTRY': 'EUR/TRY',
    'TRYJPY': 'TRY/JPY', 'USDMXN': 'USD/MXN', 'EURMXN': 'EUR/MXN', 'MXNJPY': 'MXN/JPY',
    'USDPLN': 'USD/PLN', 'EURPLN': 'EUR/PLN', 'GBPPLN': 'GBP/PLN', 'USDSEK': 'USD/SEK',
    'EURSEK': 'EUR/SEK', 'GBPSEK': 'GBP/SEK', 'SEKJPY': 'SEK/JPY', 'USDNOK': 'USD/NOK',
    'EURNOK': 'EUR/NOK', 'GBPNOK': 'GBP/NOK', 'NOKJPY': 'NOK/JPY', 'USDDKK': 'USD/DKK',
    'EURDKK': 'EUR/DKK', 'DKKJPY': 'DKK/JPY', 'USDCNH': 'USD/CNH', 'CNHJPY': 'CNH/JPY',
    'USDHUF': 'USD/HUF', 'EURHUF': 'EUR/HUF', 'USDCZK': 'USD/CZK', 'EURCZK': 'EUR/CZK',
    // Metals
    'XAUUSD': 'Gold', 'XAGUSD': 'Silver', 'XPTUSD': 'Platinum', 'XPDUSD': 'Palladium',
    // Commodities
    'USOIL': 'US Oil', 'UKOIL': 'UK Oil', 'NGAS': 'Natural Gas', 'COPPER': 'Copper',
    'ALUMINUM': 'Aluminum', 'NICKEL': 'Nickel',
    // Crypto
    'BTCUSD': 'Bitcoin', 'ETHUSD': 'Ethereum', 'BNBUSD': 'BNB', 'SOLUSD': 'Solana',
    'XRPUSD': 'XRP', 'ADAUSD': 'Cardano', 'DOGEUSD': 'Dogecoin', 'TRXUSD': 'TRON',
    'LINKUSD': 'Chainlink', 'MATICUSD': 'Polygon', 'DOTUSD': 'Polkadot',
    'SHIBUSD': 'Shiba Inu', 'LTCUSD': 'Litecoin', 'BCHUSD': 'Bitcoin Cash', 'AVAXUSD': 'Avalanche',
    'XLMUSD': 'Stellar', 'UNIUSD': 'Uniswap', 'ATOMUSD': 'Cosmos', 'ETCUSD': 'Ethereum Classic',
    'FILUSD': 'Filecoin', 'ICPUSD': 'Internet Computer', 'VETUSD': 'VeChain',
    'NEARUSD': 'NEAR Protocol', 'GRTUSD': 'The Graph', 'AAVEUSD': 'Aave', 'MKRUSD': 'Maker',
    'ALGOUSD': 'Algorand', 'FTMUSD': 'Fantom', 'SANDUSD': 'The Sandbox', 'MANAUSD': 'Decentraland',
    'AXSUSD': 'Axie Infinity', 'THETAUSD': 'Theta Network', 'XMRUSD': 'Monero', 'FLOWUSD': 'Flow',
    'SNXUSD': 'Synthetix', 'EOSUSD': 'EOS', 'CHZUSD': 'Chiliz', 'ENJUSD': 'Enjin Coin',
    'ZILUSD': 'Zilliqa', 'BATUSD': 'Basic Attention Token', 'CRVUSD': 'Curve DAO', 'COMPUSD': 'Compound',
    'SUSHIUSD': 'SushiSwap', 'ZRXUSD': '0x', 'LRCUSD': 'Loopring', 'ANKRUSD': 'Ankr',
    'GALAUSD': 'Gala', 'APEUSD': 'ApeCoin', 'WAVESUSD': 'Waves', 'ZECUSD': 'Zcash',
    // More crypto names
    'PEPEUSD': 'Pepe', 'ARBUSD': 'Arbitrum', 'OPUSD': 'Optimism', 'SUIUSD': 'Sui',
    'APTUSD': 'Aptos', 'INJUSD': 'Injective', 'LDOUSD': 'Lido DAO', 'IMXUSD': 'Immutable X',
    'RUNEUSD': 'THORChain', 'KAVAUSD': 'Kava', 'KSMUSD': 'Kusama', 'NEOUSD': 'NEO',
    'QNTUSD': 'Quant', 'FETUSD': 'Fetch.ai', 'RNDRUSD': 'Render', 'OCEANUSD': 'Ocean Protocol',
    'WLDUSD': 'Worldcoin', 'SEIUSD': 'Sei', 'TIAUSD': 'Celestia', 'BLURUSD': 'Blur',
    'ROSEUSD': 'Oasis Network', 'MINAUSD': 'Mina Protocol', 'GMXUSD': 'GMX', 'DYDXUSD': 'dYdX',
    'STXUSD': 'Stacks', 'CFXUSD': 'Conflux', 'ACHUSD': 'Alchemy Pay', 'DASHUSD': 'Dash',
    'XTZUSD': 'Tezos', 'IOTUSD': 'IOTA', 'CELOUSD': 'Celo', 'ONEUSD': 'Harmony',
    'HOTUSD': 'Holo', 'SKLUSD': 'SKALE', 'STORJUSD': 'Storj', 'YFIUSD': 'yearn.finance',
    'UMAUSD': 'UMA', 'BANDUSD': 'Band Protocol', 'RVNUSD': 'Ravencoin', 'OXTUSD': 'Orchid',
    'NKNUSD': 'NKN', 'WOOUSD': 'WOO Network', 'AABORUSD': 'SingularityNET', 'JASMYUSD': 'JasmyCoin',
    'MASKUSD': 'Mask Network', 'DENTUSD': 'Dent', 'CELRUSD': 'Celer Network', 'COTIUSD': 'COTI',
    'CTSIUSD': 'Cartesi', 'IOTXUSD': 'IoTeX', 'KLAYUSD': 'Klaytn', 'OGNUSD': 'Origin Protocol',
    'RLCUSD': 'iExec RLC', 'STMXUSD': 'StormX', 'SUNUSD': 'Sun Token', 'SXPUSD': 'Solar',
    'WINUSD': 'WINkLink', 'AKROUSD': 'Akropolis', 'AUDIOUSD': 'Audius', 'BELUSD': 'Bella Protocol',
    'BONKUSD': 'Bonk', 'FLOKIUSD': 'Floki', 'JTUSD': 'JTO', 'ORDIUSD': 'ORDI',
    'PENDUSD': 'Pendle', 'RADUSD': 'Radicle', 'RDNTUSD': 'Radiant Capital', 'RPLUSD': 'Rocket Pool',
    'SSVUSD': 'ssv.network', 'WAXUSD': 'WAX', 'XECUSD': 'eCash', 'ZENUSD': 'Horizen',
    '1INCHUSD': '1inch', 'HBARUSD': 'Hedera', 'TONUSD': 'Toncoin', 'EGLDUSDUSD': 'MultiversX'
  }
  return names[symbol] || symbol
}

// Helper to get digits for symbol
function getDigits(symbol) {
  if (symbol.includes('JPY')) return 3
  if (symbol === 'XAUUSD') return 2
  if (symbol === 'XAGUSD') return 3
  if (CRYPTO_SYMBOLS.includes(symbol)) return 2
  return 5
}

// Helper to get contract size
function getContractSize(symbol) {
  if (CRYPTO_SYMBOLS.includes(symbol)) return 1
  if (symbol === 'XAUUSD' || symbol === 'XAGUSD') return 100
  return 100000
}

// GET /api/prices/:symbol - Get single symbol price
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params
    
    // Check if symbol is supported
    if (!INFOWAY_SYMBOL_MAP[symbol]) {
      return res.status(404).json({ success: false, message: `Symbol ${symbol} not supported` })
    }
    
    // Use Infoway.io API for all symbols
    const price = await getInfowayPrice(symbol)
    
    if (price) {
      res.json({ success: true, price })
    } else {
      res.status(404).json({ success: false, message: 'Price not available' })
    }
  } catch (error) {
    console.error('Error fetching price:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// Global price cache
const priceCache = new Map()
const CACHE_TTL = 2000 // 2 second cache for real-time updates

// POST /api/prices/batch - Get multiple symbol prices using Infoway.io API
router.post('/batch', async (req, res) => {
  try {
    const { symbols } = req.body
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ success: false, message: 'symbols array required' })
    }
    
    const prices = {}
    const now = Date.now()
    
    // Get prices from cache first
    const missingSymbols = []
    for (const symbol of symbols) {
      const cached = priceCache.get(symbol)
      if (cached && (now - cached.time) < CACHE_TTL) {
        prices[symbol] = cached.price
      } else if (INFOWAY_SYMBOL_MAP[symbol]) {
        missingSymbols.push(symbol)
      }
    }
    
    // Fetch missing prices from Infoway.io API in batch
    if (missingSymbols.length > 0) {
      const batchPrices = await getInfowayBatchPrices(missingSymbols)
      for (const [symbol, price] of Object.entries(batchPrices)) {
        prices[symbol] = price
        priceCache.set(symbol, { price, time: now })
      }
    }
    
    res.json({ success: true, prices })
  } catch (error) {
    console.error('Error fetching batch prices:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
