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

// ============================================================
// INFOWAY.IO API CONFIGURATION
// Documentation: https://docs.infoway.io/en-docs/rest-api/websocket
// ============================================================

const INFOWAY_API_KEY = process.env.INFOWAY_API_KEY || 'your_infoway_api_key_here'

// Infoway.io WebSocket URLs by business type
const INFOWAY_WS_CRYPTO = `wss://data.infoway.io/ws?business=crypto&apikey=${INFOWAY_API_KEY}`
const INFOWAY_WS_COMMON = `wss://data.infoway.io/ws?business=common&apikey=${INFOWAY_API_KEY}`

// Infoway.io HTTP API URLs
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

// Reverse mapping (Infoway code -> internal symbol)
const INFOWAY_REVERSE_MAP = Object.fromEntries(
  Object.entries(INFOWAY_SYMBOL_MAP).map(([k, v]) => [v, k])
)

// Categorize symbols by business type for Infoway WebSocket
const CRYPTO_SYMBOLS = Object.keys(INFOWAY_SYMBOL_MAP).filter(s => 
  INFOWAY_SYMBOL_MAP[s].endsWith('USDT')
)
const COMMON_SYMBOLS = Object.keys(INFOWAY_SYMBOL_MAP).filter(s => 
  !INFOWAY_SYMBOL_MAP[s].endsWith('USDT')
)

// Infoway.io WebSocket connections (separate for crypto and common)
let infowayWsCrypto = null
let infowayWsCommon = null
let infowayReconnectTimerCrypto = null
let infowayReconnectTimerCommon = null
let infowayHeartbeatTimerCrypto = null
let infowayHeartbeatTimerCommon = null

// Connect to Infoway.io Crypto WebSocket
function connectInfowayCryptoWebSocket() {
  if (infowayWsCrypto && infowayWsCrypto.readyState === WebSocket.OPEN) return
  
  console.log('[Infoway] Connecting to Crypto WebSocket...')
  infowayWsCrypto = new WebSocket(INFOWAY_WS_CRYPTO)
  
  infowayWsCrypto.on('open', () => {
    console.log('[Infoway] Crypto WebSocket connected!')
    
    const cryptoCodes = CRYPTO_SYMBOLS.map(s => INFOWAY_SYMBOL_MAP[s]).join(',')
    
    // Subscribe to Latest Trade (protocol 10000) for tick-by-tick data
    const tradeSubscribeMsg = {
      code: 10000,
      trace: `crypto-trade-${Date.now()}`,
      data: { codes: cryptoCodes }
    }
    infowayWsCrypto.send(JSON.stringify(tradeSubscribeMsg))
    console.log(`[Infoway] Subscribed to ${CRYPTO_SYMBOLS.length} crypto tick-by-tick trades`)
    
    // Also subscribe to depth data (protocol 10003) for order book
    setTimeout(() => {
      const depthSubscribeMsg = {
        code: 10003,
        trace: `crypto-depth-${Date.now()}`,
        data: { codes: cryptoCodes }
      }
      infowayWsCrypto.send(JSON.stringify(depthSubscribeMsg))
      console.log(`[Infoway] Subscribed to ${CRYPTO_SYMBOLS.length} crypto depth data`)
    }, 1000)
    
    // Start heartbeat every 30 seconds (Infoway requirement)
    if (infowayHeartbeatTimerCrypto) clearInterval(infowayHeartbeatTimerCrypto)
    infowayHeartbeatTimerCrypto = setInterval(() => {
      if (infowayWsCrypto && infowayWsCrypto.readyState === WebSocket.OPEN) {
        infowayWsCrypto.send(JSON.stringify({ code: 10010, trace: `ping-${Date.now()}` }))
      }
    }, 30000)
  })
  
  infowayWsCrypto.on('message', (data) => {
    handleInfowayMessage(data, 'crypto')
  })
  
  infowayWsCrypto.on('error', (err) => {
    console.error('[Infoway] Crypto WebSocket error:', err.message)
  })
  
  infowayWsCrypto.on('close', () => {
    console.log('[Infoway] Crypto WebSocket disconnected, reconnecting in 5s...')
    if (infowayHeartbeatTimerCrypto) clearInterval(infowayHeartbeatTimerCrypto)
    if (infowayReconnectTimerCrypto) clearTimeout(infowayReconnectTimerCrypto)
    infowayReconnectTimerCrypto = setTimeout(connectInfowayCryptoWebSocket, 5000)
  })
}

// Connect to Infoway.io Common (Forex/Commodities) WebSocket
function connectInfowayCommonWebSocket() {
  if (infowayWsCommon && infowayWsCommon.readyState === WebSocket.OPEN) return
  
  console.log('[Infoway] Connecting to Common (Forex/Commodities) WebSocket...')
  infowayWsCommon = new WebSocket(INFOWAY_WS_COMMON)
  
  infowayWsCommon.on('open', () => {
    console.log('[Infoway] Common WebSocket connected!')
    
    const commonCodes = COMMON_SYMBOLS.map(s => INFOWAY_SYMBOL_MAP[s]).join(',')
    
    // Subscribe to Latest Trade (protocol 10000) for tick-by-tick forex/commodities data
    const tradeSubscribeMsg = {
      code: 10000,
      trace: `common-trade-${Date.now()}`,
      data: { codes: commonCodes }
    }
    infowayWsCommon.send(JSON.stringify(tradeSubscribeMsg))
    console.log(`[Infoway] Subscribed to ${COMMON_SYMBOLS.length} forex/commodities tick-by-tick trades`)
    
    // Also subscribe to depth data (protocol 10003) for order book
    setTimeout(() => {
      const depthSubscribeMsg = {
        code: 10003,
        trace: `common-depth-${Date.now()}`,
        data: { codes: commonCodes }
      }
      infowayWsCommon.send(JSON.stringify(depthSubscribeMsg))
      console.log(`[Infoway] Subscribed to ${COMMON_SYMBOLS.length} forex/commodities depth data`)
    }, 1000)
    
    // Start heartbeat every 30 seconds
    if (infowayHeartbeatTimerCommon) clearInterval(infowayHeartbeatTimerCommon)
    infowayHeartbeatTimerCommon = setInterval(() => {
      if (infowayWsCommon && infowayWsCommon.readyState === WebSocket.OPEN) {
        infowayWsCommon.send(JSON.stringify({ code: 10010, trace: `ping-${Date.now()}` }))
      }
    }, 30000)
  })
  
  infowayWsCommon.on('message', (data) => {
    handleInfowayMessage(data, 'common')
  })
  
  infowayWsCommon.on('error', (err) => {
    console.error('[Infoway] Common WebSocket error:', err.message)
  })
  
  infowayWsCommon.on('close', () => {
    console.log('[Infoway] Common WebSocket disconnected, reconnecting in 5s...')
    if (infowayHeartbeatTimerCommon) clearInterval(infowayHeartbeatTimerCommon)
    if (infowayReconnectTimerCommon) clearTimeout(infowayReconnectTimerCommon)
    infowayReconnectTimerCommon = setTimeout(connectInfowayCommonWebSocket, 5000)
  })
}

// Handle incoming Infoway WebSocket messages
function handleInfowayMessage(data, type) {
  try {
    const msg = JSON.parse(data.toString())
    
    // Handle subscription response (protocol 10004)
    if (msg.code === 10004) {
      console.log(`[Infoway] ${type} subscription response:`, msg.msg === 'ok' ? 'SUCCESS' : `FAILED (${msg.msg})`)
    }
    
    // Handle Latest Trade push data (protocol 10001) - TICK-BY-TICK DATA
    if (msg.code === 10001 && msg.data) {
      const infowaySymbol = msg.data.s
      const internalSymbol = INFOWAY_REVERSE_MAP[infowaySymbol] || infowaySymbol
      
      // Latest trade data: p = price, v = volume, t = timestamp
      const tradePrice = msg.data.p ? parseFloat(msg.data.p) : null
      
      if (tradePrice && tradePrice > 0) {
        // Get existing price data to preserve bid/ask spread
        const existingPrice = priceCache.get(internalSymbol) || {}
        const spread = existingPrice.ask && existingPrice.bid 
          ? (existingPrice.ask - existingPrice.bid) / 2 
          : tradePrice * 0.0001 // Default small spread
        
        const price = { 
          bid: tradePrice - spread, 
          ask: tradePrice + spread, 
          last: tradePrice,
          volume: msg.data.v ? parseFloat(msg.data.v) : 0,
          time: msg.data.t || Date.now() 
        }
        priceCache.set(internalSymbol, price)
        
        // Broadcast tick-by-tick update to subscribers
        if (priceSubscribers.size > 0) {
          io.to('prices').emit('priceUpdate', { symbol: internalSymbol, price })
        }
      }
    }
    
    // Handle depth push data (protocol 10005) - ORDER BOOK DATA
    if (msg.code === 10005 && msg.data) {
      const infowaySymbol = msg.data.s
      const internalSymbol = INFOWAY_REVERSE_MAP[infowaySymbol] || infowaySymbol
      
      // Extract bid and ask from depth data
      // b = buy orders (bids): b[0] = prices array, b[1] = volumes array
      // a = sell orders (asks): a[0] = prices array, a[1] = volumes array
      const bidPrice = msg.data.b?.[0]?.[0] ? parseFloat(msg.data.b[0][0]) : null
      const askPrice = msg.data.a?.[0]?.[0] ? parseFloat(msg.data.a[0][0]) : null
      
      if (bidPrice && askPrice) {
        const existingPrice = priceCache.get(internalSymbol) || {}
        const price = { 
          bid: bidPrice, 
          ask: askPrice, 
          last: existingPrice.last || (bidPrice + askPrice) / 2,
          time: msg.data.t || Date.now() 
        }
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
}

// Connect both Infoway WebSockets
function connectInfowayWebSockets() {
  connectInfowayCryptoWebSocket()
  connectInfowayCommonWebSocket()
}

// Fetch prices via Infoway.io HTTP API as fallback
let lastInfowayLogTime = 0

async function fetchInfowayPricesHTTP() {
  const now = Date.now()
  let fetchedCount = 0
  
  try {
    // Fetch forex/commodities prices (common business)
    const commonCodes = COMMON_SYMBOLS.map(s => INFOWAY_SYMBOL_MAP[s]).join(',')
    const commonUrl = `${INFOWAY_HTTP_COMMON}/${commonCodes}`
    
    const commonResponse = await fetch(commonUrl, {
      headers: { 'apiKey': INFOWAY_API_KEY }
    })
    
    if (commonResponse.ok) {
      const data = await commonResponse.json()
      if (data.ret === 200 && data.data) {
        for (const item of data.data) {
          const internalSymbol = INFOWAY_REVERSE_MAP[item.s] || item.s
          const bidPrice = item.b?.[0]?.[0] ? parseFloat(item.b[0][0]) : null
          const askPrice = item.a?.[0]?.[0] ? parseFloat(item.a[0][0]) : null
          if (bidPrice && askPrice) {
            priceCache.set(internalSymbol, { bid: bidPrice, ask: askPrice, time: now })
            fetchedCount++
          }
        }
      }
    }
  } catch (e) {
    console.error('[Infoway] HTTP common error:', e.message)
  }
  
  try {
    // Fetch crypto prices (crypto business)
    const cryptoCodes = CRYPTO_SYMBOLS.map(s => INFOWAY_SYMBOL_MAP[s]).join(',')
    const cryptoUrl = `${INFOWAY_HTTP_CRYPTO}/${cryptoCodes}`
    
    const cryptoResponse = await fetch(cryptoUrl, {
      headers: { 'apiKey': INFOWAY_API_KEY }
    })
    
    if (cryptoResponse.ok) {
      const data = await cryptoResponse.json()
      if (data.ret === 200 && data.data) {
        for (const item of data.data) {
          const internalSymbol = INFOWAY_REVERSE_MAP[item.s] || item.s
          const bidPrice = item.b?.[0]?.[0] ? parseFloat(item.b[0][0]) : null
          const askPrice = item.a?.[0]?.[0] ? parseFloat(item.a[0][0]) : null
          if (bidPrice && askPrice) {
            priceCache.set(internalSymbol, { bid: bidPrice, ask: askPrice, time: now })
            fetchedCount++
          }
        }
      }
    }
  } catch (e) {
    console.error('[Infoway] HTTP crypto error:', e.message)
  }
  
  // Log every 30 seconds
  if (now - lastInfowayLogTime > 30000) {
    console.log(`[Infoway] HTTP: Fetched ${fetchedCount} prices, cache has ${priceCache.size} total symbols`)
    lastInfowayLogTime = now
  }
}

// Background price streaming - broadcasts cached prices to all subscribers
async function streamPrices() {
  if (priceSubscribers.size === 0) return
  
  const now = Date.now()
  
  // Infoway prices come via WebSocket (connectInfowayWebSockets)
  // Just broadcast the full cache periodically
  io.to('prices').emit('priceStream', {
    prices: Object.fromEntries(priceCache),
    updated: {},
    timestamp: now
  })
}

// HTTP fallback - poll every 5 seconds for all symbols
setInterval(fetchInfowayPricesHTTP, 5000)

// Fetch prices immediately on startup
fetchInfowayPricesHTTP().then(() => {
  console.log(`[Infoway] Initial prices loaded: ${priceCache.size} symbols in cache`)
})

// Start price streaming interval (10ms for near real-time updates)
setInterval(streamPrices, 10)

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

// Connect Infoway.io WebSockets on startup
connectInfowayWebSockets()

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
