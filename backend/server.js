import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import compression from 'compression'
import dotenv from 'dotenv'
import { createServer } from 'http'
import { Server } from 'socket.io'
import WebSocket from 'ws'
import cron from 'node-cron'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import accountTypesRoutes from './routes/accountTypes.js'
import tradingAccountsRoutes from './routes/tradingAccounts.js'
import walletRoutes from './routes/wallet.js'
import paymentMethodsRoutes from './routes/paymentMethods.js'
import tradeRoutes from './routes/trade.js'
import walletTransferRoutes from './routes/walletTransfer.js'
import adminTradeRoutes from './routes/adminTrade.js'
import copyTradingRoutes from './routes/copyTrading.js'
import ibRoutes from './routes/ibNew.js'
import propTradingRoutes from './routes/propTrading.js'
import chargesRoutes from './routes/charges.js'
import pricesRoutes from './routes/prices.js'
import earningsRoutes from './routes/earnings.js'
import supportRoutes from './routes/support.js'
import kycRoutes from './routes/kyc.js'
import themeRoutes from './routes/theme.js'
import adminManagementRoutes from './routes/adminManagement.js'
import uploadRoutes from './routes/upload.js'
import emailTemplatesRoutes from './routes/emailTemplates.js'
import bonusRoutes from './routes/bonus.js'
import bannerRoutes from './routes/banner.js'
import path from 'path'
import { fileURLToPath } from 'url'
import copyTradingEngine from './services/copyTradingEngine.js'
import tradeEngine from './services/tradeEngine.js'
import propTradingEngine from './services/propTradingEngine.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()
const httpServer = createServer(app)

// Socket.IO for real-time updates
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// Store connected clients
const connectedClients = new Map()
const priceSubscribers = new Set()

// Price cache for real-time streaming
const priceCache = new Map()

// Use Binance for ALL crypto (faster updates than AllTick for crypto)
const BINANCE_CRYPTO_SYMBOLS = {
  'BTCUSD': 'BTCUSDT', 'ETHUSD': 'ETHUSDT', 'BNBUSD': 'BNBUSDT', 'SOLUSD': 'SOLUSDT',
  'XRPUSD': 'XRPUSDT', 'ADAUSD': 'ADAUSDT', 'DOGEUSD': 'DOGEUSDT', 'TRXUSD': 'TRXUSDT',
  'LINKUSD': 'LINKUSDT', 'MATICUSD': 'MATICUSDT', 'DOTUSD': 'DOTUSDT',
  'SHIBUSD': 'SHIBUSDT', 'LTCUSD': 'LTCUSDT', 'BCHUSD': 'BCHUSDT', 'AVAXUSD': 'AVAXUSDT',
  'XLMUSD': 'XLMUSDT', 'UNIUSD': 'UNIUSDT', 'ATOMUSD': 'ATOMUSDT', 'ETCUSD': 'ETCUSDT',
  'FILUSD': 'FILUSDT', 'ICPUSD': 'ICPUSDT', 'VETUSD': 'VETUSDT',
  'NEARUSD': 'NEARUSDT', 'GRTUSD': 'GRTUSDT', 'AAVEUSD': 'AAVEUSDT', 'MKRUSD': 'MKRUSDT',
  'ALGOUSD': 'ALGOUSDT', 'FTMUSD': 'FTMUSDT', 'SANDUSD': 'SANDUSDT', 'MANAUSD': 'MANAUSDT',
  'AXSUSD': 'AXSUSDT', 'THETAUSD': 'THETAUSDT', 'FLOWUSD': 'FLOWUSDT',
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
  'XTZUSD': 'XTZUSDT', 'CELOUSD': 'CELOUSDT', 'ONEUSD': 'ONEUSDT',
  'HOTUSD': 'HOTUSDT', 'SKLUSD': 'SKLUSDT', 'STORJUSD': 'STORJUSDT', 'YFIUSD': 'YFIUSDT',
  'UMAUSD': 'UMAUSDT', 'BANDUSD': 'BANDUSDT', 'RVNUSD': 'RVNUSDT', 'OXTUSD': 'OXTUSDT',
  'NKNUSD': 'NKNUSDT', 'WOOUSD': 'WOOUSDT', 'JASMYUSD': 'JASMYUSDT',
  'MASKUSD': 'MASKUSDT', 'DENTUSD': 'DENTUSDT', 'CELRUSD': 'CELRUSDT', 'COTIUSD': 'COTIUSDT',
  'IOTXUSD': 'IOTXUSDT', 'KLAYUSD': 'KLAYUSDT', 'OGNUSD': 'OGNUSDT',
  'RLCUSD': 'RLCUSDT', 'STMXUSD': 'STMXUSDT', 'SUNUSD': 'SUNUSDT', 'SXPUSD': 'SXPUSDT',
  'AUDIOUSD': 'AUDIOUSDT', 'BONKUSD': 'BONKUSDT', 'FLOKIUSD': 'FLOKIUSDT', 'ORDIUSD': 'ORDIUSDT',
  '1INCHUSD': '1INCHUSDT', 'HBARUSD': 'HBARUSDT', 'TONUSD': 'TONUSDT'
}
// AllTick API config
const ALLTICK_API_TOKEN = process.env.ALLTICK_API_TOKEN || '1b2b3ad1b5c8c28b9d956652ecb4111d-c-app'
const ALLTICK_WS_URL = `wss://quote.alltick.co/quote-b-ws-api?token=${ALLTICK_API_TOKEN}`

// AllTick symbol mapping (internal -> AllTick code) - ~120 symbols
const ALLTICK_SYMBOL_MAP = {
  // Forex Majors (7)
  'EURUSD': 'EURUSD', 'GBPUSD': 'GBPUSD', 'USDJPY': 'USDJPY', 'USDCHF': 'USDCHF',
  'AUDUSD': 'AUDUSD', 'NZDUSD': 'NZDUSD', 'USDCAD': 'USDCAD',
  // Forex Crosses (21)
  'EURGBP': 'EURGBP', 'EURJPY': 'EURJPY', 'GBPJPY': 'GBPJPY', 'EURCHF': 'EURCHF',
  'EURAUD': 'EURAUD', 'EURCAD': 'EURCAD', 'GBPAUD': 'GBPAUD', 'GBPCAD': 'GBPCAD',
  'AUDCAD': 'AUDCAD', 'AUDJPY': 'AUDJPY', 'CADJPY': 'CADJPY', 'CHFJPY': 'CHFJPY',
  'NZDJPY': 'NZDJPY', 'AUDNZD': 'AUDNZD', 'CADCHF': 'CADCHF', 'GBPCHF': 'GBPCHF',
  'GBPNZD': 'GBPNZD', 'EURNZD': 'EURNZD', 'NZDCAD': 'NZDCAD', 'NZDCHF': 'NZDCHF',
  'AUDCHF': 'AUDCHF',
  // Forex Exotics (30+)
  'USDSGD': 'USDSGD', 'EURSGD': 'EURSGD', 'GBPSGD': 'GBPSGD', 'AUDSGD': 'AUDSGD',
  'SGDJPY': 'SGDJPY', 'USDHKD': 'USDHKD', 'USDZAR': 'USDZAR', 'EURZAR': 'EURZAR',
  'GBPZAR': 'GBPZAR', 'ZARJPY': 'ZARJPY', 'USDTRY': 'USDTRY', 'EURTRY': 'EURTRY',
  'TRYJPY': 'TRYJPY', 'USDMXN': 'USDMXN', 'EURMXN': 'EURMXN', 'MXNJPY': 'MXNJPY',
  'USDPLN': 'USDPLN', 'EURPLN': 'EURPLN', 'GBPPLN': 'GBPPLN', 'USDSEK': 'USDSEK',
  'EURSEK': 'EURSEK', 'GBPSEK': 'GBPSEK', 'SEKJPY': 'SEKJPY', 'USDNOK': 'USDNOK',
  'EURNOK': 'EURNOK', 'GBPNOK': 'GBPNOK', 'NOKJPY': 'NOKJPY', 'USDDKK': 'USDDKK',
  'EURDKK': 'EURDKK', 'DKKJPY': 'DKKJPY', 'USDCNH': 'USDCNH', 'CNHJPY': 'CNHJPY',
  'USDHUF': 'USDHUF', 'EURHUF': 'EURHUF', 'USDCZK': 'USDCZK', 'EURCZK': 'EURCZK',
  // Metals (4)
  'XAUUSD': 'GOLD', 'XAGUSD': 'Silver', 'XPTUSD': 'Platinum', 'XPDUSD': 'Palladium',
  // Commodities (6)
  'USOIL': 'USOIL', 'UKOIL': 'UKOIL', 'NGAS': 'NGAS', 'COPPER': 'COPPER',
  'ALUMINUM': 'Aluminum', 'NICKEL': 'Nickel',
  // Crypto (126 coins to reach 200 total)
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
  // More crypto coins
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
  'NKNUSD': 'NKNUSDT', 'WOOUSD': 'WOOUSDT', 'AABORUSD': 'AGIXUSDT', 'JASMYUSD': 'JASMYUSDT',
  'MASKUSD': 'MASKUSDT', 'DENTUSD': 'DENTUSDT', 'CELRUSD': 'CELRUSDT', 'COTIUSD': 'COTIUSDT',
  'CTSIUSD': 'CTSIUSDT', 'IOTXUSD': 'IOTXUSDT', 'KLAYUSD': 'KLAYUSDT', 'OGNUSD': 'OGNUSDT',
  'RLCUSD': 'RLCUSDT', 'STMXUSD': 'STMXUSDT', 'SUNUSD': 'SUNUSDT', 'SXPUSD': 'SXPUSDT',
  'WINUSD': 'WINUSDT', 'AKROUSD': 'AKROUSDT', 'AUDIOUSD': 'AUDIOUSDT', 'BELUSD': 'BELUSDT',
  'BONKUSD': 'BONKUSDT', 'FLOKIUSD': 'FLOKIUSDT', 'JTUSD': 'JTOUSDT', 'ORDIUSD': 'ORDIUSDT',
  'PENDUSD': 'PENDLEUSDT', 'RADUSD': 'RADUSDT', 'RDNTUSD': 'RDNTUSDT', 'RPLUSD': 'RPLUSDT',
  'SSVUSD': 'SSVUSDT', 'TUSDUSD': 'TUSDT', 'WAXUSD': 'WAXPUSDT', 'XECUSD': 'XECUSDT',
  'ZENUSD': 'ZENUSDT', 'ZILUSD': 'ZILUSDT', '1INCHUSD': '1INCHUSDT', 'HBARUSD': 'HBARUSDT',
  'TONUSD': 'TONUSDT', 'EGLDUSDUSD': 'EGLDUSDT'
}

// Reverse mapping (AllTick code -> internal symbol)
const ALLTICK_REVERSE_MAP = Object.fromEntries(
  Object.entries(ALLTICK_SYMBOL_MAP).map(([k, v]) => [v, k])
)

// All symbols to subscribe via AllTick WebSocket (78 total)
const ALLTICK_WS_SYMBOLS = Object.keys(ALLTICK_SYMBOL_MAP)

// AllTick WebSocket connection
let allTickWs = null
let allTickReconnectTimer = null
let allTickHeartbeatTimer = null

function connectAllTickWebSocket() {
  if (allTickWs && allTickWs.readyState === WebSocket.OPEN) return
  
  console.log('Connecting to AllTick WebSocket...')
  allTickWs = new WebSocket(ALLTICK_WS_URL)
  
  allTickWs.on('open', () => {
    console.log('AllTick WebSocket connected!')
    
    // Subscribe to ALL symbols (forex, metals, commodities, crypto) - 78 total
    const symbolList = ALLTICK_WS_SYMBOLS.map(s => ({
      code: ALLTICK_SYMBOL_MAP[s] || s,
      depth_level: 1
    }))
    
    const subscribeMsg = {
      cmd_id: 22002,
      seq_id: Date.now(),
      trace: `sub-${Date.now()}`,
      data: { symbol_list: symbolList }
    }
    
    allTickWs.send(JSON.stringify(subscribeMsg))
    console.log(`Subscribed to ${symbolList.length} AllTick symbols (forex, metals, commodities, crypto)`)
    
    // Start heartbeat every 10 seconds
    if (allTickHeartbeatTimer) clearInterval(allTickHeartbeatTimer)
    allTickHeartbeatTimer = setInterval(() => {
      if (allTickWs && allTickWs.readyState === WebSocket.OPEN) {
        allTickWs.send(JSON.stringify({ cmd_id: 22000, seq_id: Date.now(), trace: 'heartbeat' }))
      }
    }, 10000)
  })
  
  allTickWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      
      // Log subscription response
      if (msg.cmd_id === 22002) {
        console.log('AllTick subscription response:', msg.ret === 200 ? 'SUCCESS' : `FAILED (${msg.msg || msg.ret})`)
      }
      
      // Handle price push (cmd_id 22999)
      if (msg.cmd_id === 22999 && msg.data) {
        const code = msg.data.code
        const internalSymbol = ALLTICK_REVERSE_MAP[code] || code
        
        const bid = msg.data.bids?.[0]?.price ? parseFloat(msg.data.bids[0].price) : null
        const ask = msg.data.asks?.[0]?.price ? parseFloat(msg.data.asks[0].price) : null
        
        if (bid && ask) {
          const price = { bid, ask, time: Date.now() }
          priceCache.set(internalSymbol, price)
          
          // Broadcast to subscribers
          if (priceSubscribers.size > 0) {
            io.to('prices').emit('priceUpdate', { symbol: internalSymbol, price })
          }
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  })
  
  allTickWs.on('error', (err) => {
    console.error('AllTick WebSocket error:', err.message)
  })
  
  allTickWs.on('close', () => {
    console.log('AllTick WebSocket disconnected, reconnecting in 5s...')
    if (allTickHeartbeatTimer) clearInterval(allTickHeartbeatTimer)
    if (allTickReconnectTimer) clearTimeout(allTickReconnectTimer)
    allTickReconnectTimer = setTimeout(connectAllTickWebSocket, 5000)
  })
}

// ALL forex/metals/commodities symbols to fetch via HTTP fallback
const FOREX_ALL_SYMBOLS = [
  // Majors
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'NZDUSD', 'USDCAD',
  // Crosses
  'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'GBPAUD', 'GBPCAD',
  'AUDCAD', 'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY', 'AUDNZD', 'CADCHF', 'GBPCHF',
  'GBPNZD', 'EURNZD', 'NZDCAD', 'NZDCHF', 'AUDCHF',
  // Exotics
  'USDSGD', 'EURSGD', 'GBPSGD', 'AUDSGD', 'SGDJPY', 'USDHKD', 'USDZAR', 'EURZAR',
  'GBPZAR', 'ZARJPY', 'USDTRY', 'EURTRY', 'TRYJPY', 'USDMXN', 'EURMXN', 'MXNJPY',
  'USDPLN', 'EURPLN', 'GBPPLN', 'USDSEK', 'EURSEK', 'GBPSEK', 'SEKJPY', 'USDNOK',
  'EURNOK', 'GBPNOK', 'NOKJPY', 'USDDKK', 'EURDKK', 'DKKJPY', 'USDCNH', 'CNHJPY',
  'USDHUF', 'EURHUF', 'USDCZK', 'EURCZK',
  // Metals & Commodities
  'XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'USOIL', 'UKOIL', 'NGAS', 'COPPER'
]

// Fetch forex prices via AllTick HTTP API as fallback - split into chunks
let lastForexLogTime = 0
async function fetchForexPricesHTTP() {
  const CHUNK_SIZE = 15 // Batch 15 symbols at a time
  const now = Date.now()
  let fetchedCount = 0
  
  for (let i = 0; i < FOREX_ALL_SYMBOLS.length; i += CHUNK_SIZE) {
    try {
      const chunk = FOREX_ALL_SYMBOLS.slice(i, i + CHUNK_SIZE)
      const symbolList = chunk.map(s => ({ code: ALLTICK_SYMBOL_MAP[s] || s }))
      const query = {
        trace: `forex-${Date.now()}-${i}`,
        data: { symbol_list: symbolList }
      }
      const encodedQuery = encodeURIComponent(JSON.stringify(query))
      const url = `https://quote.alltick.co/quote-b-api/depth-tick?token=${ALLTICK_API_TOKEN}&query=${encodedQuery}`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        if (data.ret === 200 && data.data?.tick_list) {
          for (const tick of data.data.tick_list) {
            const internalSymbol = ALLTICK_REVERSE_MAP[tick.code] || tick.code
            const bid = tick.bids?.[0]?.price ? parseFloat(tick.bids[0].price) : null
            const ask = tick.asks?.[0]?.price ? parseFloat(tick.asks[0].price) : null
            if (bid && ask) {
              priceCache.set(internalSymbol, { bid, ask, time: now })
              fetchedCount++
            }
          }
        } else if (data.ret !== 200) {
          console.error(`AllTick HTTP error for chunk ${i}: ${data.msg || data.ret}`)
        }
      }
      // Small delay between chunks
      if (i + CHUNK_SIZE < FOREX_ALL_SYMBOLS.length) {
        await new Promise(r => setTimeout(r, 200))
      }
    } catch (e) {
      console.error(`AllTick HTTP chunk ${i} error:`, e.message)
    }
  }
  
  // Log every 30 seconds
  if (now - lastForexLogTime > 30000) {
    console.log(`AllTick HTTP: Fetched ${fetchedCount} forex prices, cache has ${priceCache.size} total symbols`)
    lastForexLogTime = now
  }
}

// Background price streaming - Binance polling + AllTick WebSocket
async function streamPrices() {
  if (priceSubscribers.size === 0) return
  
  const now = Date.now()
  const updatedPrices = {}
  
  // Binance - fast refresh for crypto (every call)
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/bookTicker')
    if (response.ok) {
      const tickers = await response.json()
      const tickerMap = {}
      tickers.forEach(t => { tickerMap[t.symbol] = t })
      
      Object.keys(BINANCE_CRYPTO_SYMBOLS).forEach(symbol => {
        const ticker = tickerMap[BINANCE_CRYPTO_SYMBOLS[symbol]]
        if (ticker) {
          const price = { bid: parseFloat(ticker.bidPrice), ask: parseFloat(ticker.askPrice), time: now }
          priceCache.set(symbol, price)
          updatedPrices[symbol] = price
        }
      })
    }
  } catch (e) {}
  
  // AllTick prices come via WebSocket (connectAllTickWebSocket)
  // Just broadcast the full cache periodically
  io.to('prices').emit('priceStream', {
    prices: Object.fromEntries(priceCache),
    updated: updatedPrices,
    timestamp: now
  })
}

// Forex HTTP fallback - poll every 3 seconds for all forex pairs
setInterval(fetchForexPricesHTTP, 3000)

// Fetch forex prices immediately on startup
fetchForexPricesHTTP().then(() => {
  console.log(`Initial forex prices loaded: ${priceCache.size} symbols in cache`)
})

// Start price streaming interval (500ms for Binance crypto)
setInterval(streamPrices, 500)

// Background stop-out check every 5 seconds
// This ensures trades are closed even if user closes browser
setInterval(async () => {
  try {
    if (priceCache.size === 0) return // No prices yet
    
    // Convert priceCache to object format expected by tradeEngine
    const currentPrices = {}
    priceCache.forEach((data, symbol) => {
      currentPrices[symbol] = { bid: data.bid, ask: data.ask }
    })
    
    const result = await tradeEngine.checkAllAccountsStopOut(currentPrices)
    if (result.stopOuts && result.stopOuts.length > 0) {
      console.log(`[STOP-OUT] ${result.stopOuts.length} accounts stopped out`)
    }
  } catch (error) {
    // Silent fail - don't spam logs
  }
}, 5000)

// Background SL/TP check every 2 seconds
// This ensures SL/TP triggers even if user closes the app
setInterval(async () => {
  try {
    if (priceCache.size === 0) return // No prices yet
    
    // Convert priceCache to object format expected by tradeEngine
    const currentPrices = {}
    priceCache.forEach((data, symbol) => {
      currentPrices[symbol] = { bid: data.bid, ask: data.ask }
    })
    
    // Check SL/TP for regular trades
    const closedRegularTrades = await tradeEngine.checkSlTpForAllTrades(currentPrices)
    
    // Check SL/TP for challenge trades
    const closedChallengeTrades = await propTradingEngine.checkSlTpForAllTrades(currentPrices)
    
    const allClosed = [...closedRegularTrades, ...closedChallengeTrades]
    if (allClosed.length > 0) {
      console.log(`[SL/TP AUTO] ${allClosed.length} trades closed by SL/TP`)
      allClosed.forEach(ct => {
        console.log(`[SL/TP AUTO] ${ct.trade?.symbol || 'Unknown'} closed by ${ct.trigger || ct.reason} - PnL: ${ct.pnl?.toFixed(2) || 0}`)
      })
    }
  } catch (error) {
    // Silent fail - don't spam logs
  }
}, 1000)

// Connect AllTick WebSocket on startup
connectAllTickWebSocket()

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Subscribe to real-time price stream
  socket.on('subscribePrices', () => {
    socket.join('prices')
    priceSubscribers.add(socket.id)
    // Send current prices immediately
    socket.emit('priceStream', {
      prices: Object.fromEntries(priceCache),
      updated: {},
      timestamp: Date.now()
    })
    console.log(`Socket ${socket.id} subscribed to price stream`)
  })

  // Unsubscribe from price stream
  socket.on('unsubscribePrices', () => {
    socket.leave('prices')
    priceSubscribers.delete(socket.id)
  })

  // Subscribe to account updates
  socket.on('subscribe', (data) => {
    const { tradingAccountId } = data
    if (tradingAccountId) {
      socket.join(`account:${tradingAccountId}`)
      connectedClients.set(socket.id, tradingAccountId)
      console.log(`Socket ${socket.id} subscribed to account ${tradingAccountId}`)
    }
  })

  // Unsubscribe from account updates
  socket.on('unsubscribe', (data) => {
    const { tradingAccountId } = data
    if (tradingAccountId) {
      socket.leave(`account:${tradingAccountId}`)
      connectedClients.delete(socket.id)
    }
  })

  // Handle price updates from client (for PnL calculation)
  socket.on('priceUpdate', async (data) => {
    const { tradingAccountId, prices } = data
    if (tradingAccountId && prices) {
      // Broadcast updated account summary to all subscribers
      io.to(`account:${tradingAccountId}`).emit('accountUpdate', {
        tradingAccountId,
        prices,
        timestamp: Date.now()
      })
    }
  })

  socket.on('disconnect', () => {
    connectedClients.delete(socket.id)
    priceSubscribers.delete(socket.id)
    console.log('Client disconnected:', socket.id)
  })
})

// Make io accessible to routes
app.set('io', io)

// Middleware
app.use(compression()) // Enable gzip compression for faster API responses
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/account-types', accountTypesRoutes)
app.use('/api/trading-accounts', tradingAccountsRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/payment-methods', paymentMethodsRoutes)
app.use('/api/trade', tradeRoutes)
app.use('/api/wallet-transfer', walletTransferRoutes)
app.use('/api/admin/trade', adminTradeRoutes)
app.use('/api/copy', copyTradingRoutes)
app.use('/api/ib', ibRoutes)
app.use('/api/prop', propTradingRoutes)
app.use('/api/charges', chargesRoutes)
app.use('/api/prices', pricesRoutes)
app.use('/api/earnings', earningsRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/kyc', kycRoutes)
app.use('/api/theme', themeRoutes)
app.use('/api/admin-mgmt', adminManagementRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/email-templates', emailTemplatesRoutes)
app.use('/api/bonus', bonusRoutes)
app.use('/api/banners', bannerRoutes)

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Serve APK download
app.get('/downloads/nalmifx.apk', (req, res) => {
  // APK stored in backend/apk folder
  const apkPath = path.join(__dirname, 'apk', 'nalmifx.apk')
  res.download(apkPath, 'NalmiFX.apk', (err) => {
    if (err) {
      console.error('APK download error:', err)
      res.status(404).json({ error: 'APK not found' })
    }
  })
})

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'NalmiFX API is running' })
})

const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  
  // Schedule daily commission calculation for copy trading
  // Runs at 11:59 PM every day (end of trading day)
  cron.schedule('59 23 * * *', async () => {
    console.log('[CRON] Running daily copy trade commission calculation...')
    try {
      const results = await copyTradingEngine.calculateDailyCommission()
      console.log(`[CRON] Daily commission calculated: ${results.length} commission records processed`)
    } catch (error) {
      console.error('[CRON] Error calculating daily commission:', error)
    }
  }, {
    timezone: 'UTC'
  })
  console.log('[CRON] Daily commission calculation scheduled for 23:59 UTC')
  
  // Schedule daily swap application for all open trades
  // Runs at 10:00 PM UTC (5:00 PM EST - forex rollover time)
  cron.schedule('0 22 * * *', async () => {
    console.log('[CRON] Applying daily swap to all open trades...')
    try {
      await tradeEngine.applySwap()
      console.log('[CRON] Swap applied successfully')
    } catch (error) {
      console.error('[CRON] Error applying swap:', error)
    }
  }, {
    timezone: 'UTC'
  })
  console.log('[CRON] Daily swap application scheduled for 22:00 UTC')
})
