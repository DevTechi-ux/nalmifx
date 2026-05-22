import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import adminFetch, { getCurrentAdminUser } from '../utils/adminFetch.js'
import AdminLayout from '../components/AdminLayout'
import LiveDemoToggle from '../components/LiveDemoToggle'
import { 
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  RefreshCw,
  Eye,
  XCircle,
  CheckCircle,
  Clock,
  Plus,
  Edit,
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sliders,
  RotateCcw,
  AlertTriangle
} from 'lucide-react'
import metaApiService from '../services/metaApi'
import binanceApiService from '../services/binanceApi'
import priceStreamService from '../services/priceStream'
import { API_URL } from '../config/api'

const AdminTradeManagement = () => {
  const [searchTerm, setSearchTerm] = useState('')
  // Initialize filterStatus from ?status=… so dashboard cards can deep-link here
  const [searchParams] = useSearchParams()
  const [filterStatus, setFilterStatus] = useState(() => {
    const s = (searchParams.get('status') || 'open').toLowerCase()
    return ['all', 'open', 'closed', 'pending'].includes(s) ? s : 'open'
  })
  // Sync if the URL changes while we're already on the page
  useEffect(() => {
    const s = (searchParams.get('status') || '').toLowerCase()
    if (s && ['all', 'open', 'closed', 'pending'].includes(s)) setFilterStatus(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  const [trades, setTrades] = useState([])
  const [stats, setStats] = useState({ total: 0, open: 0, volume: 0, pnl: 0 })
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [users, setUsers] = useState([])
  const [tradingAccounts, setTradingAccounts] = useState([])
  const [createForm, setCreateForm] = useState({
    userId: '',
    tradingAccountId: '',
    symbol: 'XAUUSD',
    side: 'BUY',
    orderType: 'MARKET',
    quantity: 0.01,
    openPrice: 0,
    stopLoss: '',
    takeProfit: ''
  })
  const [editForm, setEditForm] = useState({
    openPrice: 0,
    closePrice: '',
    quantity: 0,
    stopLoss: '',
    takeProfit: '',
    realizedPnl: 0
  })
  const [marketPrices, setMarketPrices] = useState({})
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [closeFormPrice, setCloseFormPrice] = useState(0)
  const [livePrices, setLivePrices] = useState({})
  
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [accountKind, setAccountKind] = useState('live')
  const [sortBy, setSortBy] = useState('openedAt')
  const [sortDir, setSortDir] = useState('desc')
  const [showSpreadModal, setShowSpreadModal] = useState(false)
  const [spreadInput, setSpreadInput] = useState('')
  const [updatingSpread, setUpdatingSpread] = useState(false)
  const currentAdmin = getCurrentAdminUser()
  const isSuperAdmin = currentAdmin?.role === 'SUPER_ADMIN'
  const [showReopenModal, setShowReopenModal] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [showBulkCloseModal, setShowBulkCloseModal] = useState(false)
  const [bulkCloseSearch, setBulkCloseSearch] = useState('')
  const [bulkCloseUser, setBulkCloseUser] = useState(null)
  const [bulkClosing, setBulkClosing] = useState(false)
  const [bulkCloseResult, setBulkCloseResult] = useState(null)
  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('desc') }
    setCurrentPage(1)
  }

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalTrades, setTotalTrades] = useState(0)
  const tradesPerPage = 20

  useEffect(() => {
    fetchTrades()
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, currentPage, dateFrom, dateTo, accountKind])

  // Fetch live prices for open trades via WebSocket for institutional-grade streaming
  useEffect(() => {
    const unsubscribe = priceStreamService.subscribe('adminTradeManagement', (prices, updated, timestamp) => {
      // Only update if we have valid prices (prevent flickering to zero)
      if (!prices || Object.keys(prices).length === 0) return
      
      // Merge prices to prevent losing existing data
      setLivePrices(prev => {
        const merged = { ...prev }
        Object.entries(prices).forEach(([symbol, price]) => {
          if (price && price.bid) {
            merged[symbol] = price
          }
        })
        return merged
      })
    })
    
    return () => unsubscribe()
  }, [])

  // Fallback: Fetch prices via API if WebSocket prices are empty
  useEffect(() => {
    const fetchPricesForTrades = async () => {
      const openTrades = trades.filter(t => t.status === 'OPEN')
      if (openTrades.length === 0) return
      
      // Get unique symbols from open trades
      const symbols = [...new Set(openTrades.map(t => t.symbol))]
      
      // Check if we already have prices for all symbols
      const missingSymbols = symbols.filter(s => !livePrices[s]?.bid)
      if (missingSymbols.length === 0) return
      
      try {
        const res = await adminFetch(`${API_URL}/prices/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols })
        })
        const data = await res.json()
        if (data.success && data.prices) {
          setLivePrices(prev => {
            const merged = { ...prev }
            Object.entries(data.prices).forEach(([symbol, price]) => {
              if (price && price.bid) {
                merged[symbol] = price
              }
            })
            return merged
          })
        }
      } catch (e) {
        console.error('Error fetching prices:', e)
      }
    }
    
    // Fetch immediately and then every 3 seconds
    fetchPricesForTrades()
    const interval = setInterval(fetchPricesForTrades, 3000)
    return () => clearInterval(interval)
  }, [trades])

  // Calculate floating PnL for open trades - matching user's TradingPage calculation
  const calculateFloatingPnl = (trade) => {
    if (trade.status !== 'OPEN') return trade.realizedPnl || 0
    const prices = livePrices[trade.symbol]
    if (!prices || !prices.bid) return trade._lastPnl || 0
    
    const currentPrice = trade.side === 'BUY' ? prices.bid : prices.ask
    if (!currentPrice || currentPrice <= 0) return trade._lastPnl || 0
    
    // Use actual contract size from trade (same as user sees)
    // XAUUSD = 100, XAGUSD = 5000, Crypto = 1, Forex = 100000
    const contractSize = trade.contractSize || getDefaultContractSize(trade.symbol)
    
    const pnl = trade.side === 'BUY'
      ? (currentPrice - trade.openPrice) * trade.quantity * contractSize
      : (trade.openPrice - currentPrice) * trade.quantity * contractSize
    
    // Subtract commission and swap like user's page does
    const finalPnl = pnl - (trade.commission || 0) - (trade.swap || 0)
    trade._lastPnl = finalPnl
    return finalPnl
  }

  // Get default contract size based on symbol (matches backend tradeEngine)
  const getDefaultContractSize = (symbol) => {
    if (symbol === 'XAUUSD') return 100
    if (symbol === 'XAGUSD') return 5000
    if (['BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD', 'BCHUSD', 'BNBUSD', 'SOLUSD', 'ADAUSD', 'DOGEUSD', 'DOTUSD', 'MATICUSD', 'AVAXUSD', 'LINKUSD'].includes(symbol)) return 1
    return 100000 // Forex default
  }

  const fetchUsers = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin/users`)
      const data = await res.json()
      if (data.users) setUsers(data.users)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchTradingAccounts = async (userId) => {
    try {
      const res = await adminFetch(`${API_URL}/trading-accounts/user/${userId}`)
      const data = await res.json()
      if (data.accounts) setTradingAccounts(data.accounts)
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }

  const fetchMarketPrice = async (symbol, side = null) => {
    setLoadingPrices(true)
    try {
      // Use backend API directly for all symbols - more reliable
      const response = await adminFetch(`${API_URL}/prices/${symbol}`)
      const data = await response.json()
      
      if (data.success && data.price && data.price.bid && data.price.ask) {
        const priceData = data.price
        setMarketPrices(prev => ({ ...prev, [symbol]: priceData }))
        
        // Auto-set price for market orders
        const currentSide = side || createForm.side
        if (createForm.orderType === 'MARKET') {
          const marketPrice = currentSide === 'BUY' ? priceData.ask : priceData.bid
          setCreateForm(prev => ({ ...prev, openPrice: marketPrice }))
        }
        
        console.log(`Fetched ${symbol} price: Bid=${priceData.bid}, Ask=${priceData.ask}`)
      } else {
        console.warn('No price data received for', symbol, data)
        // Try batch endpoint as fallback
        const batchRes = await adminFetch(`${API_URL}/prices/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: [symbol] })
        })
        const batchData = await batchRes.json()
        if (batchData.success && batchData.prices && batchData.prices[symbol]) {
          const priceData = batchData.prices[symbol]
          setMarketPrices(prev => ({ ...prev, [symbol]: priceData }))
          
          const currentSide = side || createForm.side
          if (createForm.orderType === 'MARKET') {
            const marketPrice = currentSide === 'BUY' ? priceData.ask : priceData.bid
            setCreateForm(prev => ({ ...prev, openPrice: marketPrice }))
          }
        }
      }
    } catch (error) {
      console.error('Error fetching price:', error)
    }
    setLoadingPrices(false)
  }

  const handleCreateTrade = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin/trade/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          quantity: parseFloat(createForm.quantity),
          openPrice: parseFloat(createForm.openPrice),
          stopLoss: createForm.stopLoss ? parseFloat(createForm.stopLoss) : null,
          takeProfit: createForm.takeProfit ? parseFloat(createForm.takeProfit) : null
        })
      })
      const data = await res.json()
      if (data.success) {
        alert('Trade created successfully!')
        setShowCreateModal(false)
        fetchTrades()
        setCreateForm({
          userId: '', tradingAccountId: '', symbol: 'XAUUSD', side: 'BUY',
          orderType: 'MARKET', quantity: 0.01, openPrice: 0, stopLoss: '', takeProfit: ''
        })
      } else {
        alert(data.message || 'Failed to create trade')
      }
    } catch (error) {
      alert('Error creating trade')
    }
  }

  // Full edit trade - admin can change any field
  const handleEditTrade = async () => {
    if (!selectedTrade) return
    try {
      const res = await adminFetch(`${API_URL}/admin/trade/edit/${selectedTrade._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openPrice: parseFloat(editForm.openPrice),
          closePrice: editForm.closePrice ? parseFloat(editForm.closePrice) : null,
          quantity: parseFloat(editForm.quantity),
          stopLoss: editForm.stopLoss ? parseFloat(editForm.stopLoss) : null,
          takeProfit: editForm.takeProfit ? parseFloat(editForm.takeProfit) : null,
          realizedPnl: editForm.realizedPnl ? parseFloat(editForm.realizedPnl) : null
        })
      })
      const data = await res.json()
      if (data.success) {
        alert('Trade updated successfully!')
        setShowEditModal(false)
        fetchTrades()
      } else {
        alert(data.message || 'Failed to update trade')
      }
    } catch (error) {
      alert('Error updating trade')
    }
  }

  const handleCloseTrade = async () => {
    if (!selectedTrade) return
    try {
      // Get current market price for the symbol
      const priceData = livePrices[selectedTrade.symbol]
      let marketPrice = null
      if (priceData) {
        // Use bid for BUY trades (selling), ask for SELL trades (buying back)
        marketPrice = selectedTrade.side === 'BUY' ? priceData.bid : priceData.ask
      }

      const res = await adminFetch(`${API_URL}/admin/trade/close/${selectedTrade._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          closePrice: closeFormPrice || null,
          marketPrice: marketPrice 
        })
      })
      const data = await res.json()
      if (data.success) {
        let message = `Trade closed by Admin! P&L: $${data.realizedPnl?.toFixed(2)}`
        if (data.followersClosed > 0) {
          message += ` | ${data.followersClosed} follower trades also closed`
        }
        alert(message)
        setShowCloseModal(false)
        setCloseFormPrice(0)
        fetchTrades()
      } else {
        alert(data.message || 'Failed to close trade')
      }
    } catch (error) {
      alert('Error closing trade')
    }
  }

  const openEditModal = (trade) => {
    setSelectedTrade(trade)
    setEditForm({
      openPrice: trade.openPrice || 0,
      closePrice: trade.closePrice || '',
      quantity: trade.quantity || 0,
      stopLoss: trade.stopLoss || '',
      takeProfit: trade.takeProfit || '',
      realizedPnl: trade.realizedPnl || 0
    })
    setShowEditModal(true)
  }

  const openSpreadModal = (trade) => {
    setSelectedTrade(trade)
    setSpreadInput(String(trade.spread ?? 0))
    setShowSpreadModal(true)
  }

  // Mirror the backend pip factor — used to preview the resulting open price
  const pipFactorFor = (symbol = '') => {
    if (['BTCUSD', 'ETHUSD', 'LTCUSD', 'XRPUSD', 'BCHUSD'].includes(symbol)) return 1
    if (['XAUUSD', 'XAGUSD'].includes(symbol) || symbol.includes('JPY')) return 0.01
    return 0.0001
  }

  const openReopenModal = (trade) => {
    setSelectedTrade(trade)
    setShowReopenModal(true)
  }

  const handleReopenTrade = async () => {
    if (!selectedTrade) return
    setReopening(true)
    try {
      const res = await adminFetch(`${API_URL}/admin/trade/${selectedTrade._id}/reopen`, {
        method: 'PUT'
      })
      const data = await res.json()
      if (data.success) {
        setShowReopenModal(false)
        fetchTrades()
      } else {
        alert(data.message || 'Failed to reopen trade')
      }
    } catch (e) {
      alert('Network error reopening trade')
    }
    setReopening(false)
  }

  const openBulkCloseModal = () => {
    setBulkCloseSearch('')
    setBulkCloseUser(null)
    setBulkCloseResult(null)
    setShowBulkCloseModal(true)
  }

  const handleBulkClose = async () => {
    if (!bulkCloseUser) return
    setBulkClosing(true)
    setBulkCloseResult(null)
    try {
      const res = await adminFetch(`${API_URL}/admin/trade/close-user-trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: bulkCloseUser._id })
      })
      const data = await res.json()
      if (data.success) {
        setBulkCloseResult({
          count: data.count,
          closed: data.closed || [],
          failed: data.failed || []
        })
        fetchTrades()
      } else {
        alert(data.message || 'Failed to close trades')
      }
    } catch (e) {
      alert('Network error closing trades')
    }
    setBulkClosing(false)
  }

  const handleUpdateSpread = async () => {
    if (!selectedTrade) return
    const newSpread = parseFloat(spreadInput)
    if (isNaN(newSpread) || newSpread < 0) {
      alert('Enter a valid spread in pips (≥ 0)')
      return
    }
    setUpdatingSpread(true)
    try {
      const res = await adminFetch(`${API_URL}/admin/trade/${selectedTrade._id}/spread`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spread: newSpread })
      })
      const data = await res.json()
      if (data.success) {
        setShowSpreadModal(false)
        fetchTrades()
      } else {
        alert(data.message || 'Failed to update spread')
      }
    } catch (e) {
      alert('Network error updating spread')
    }
    setUpdatingSpread(false)
  }

  const openCloseModal = async (trade) => {
    setSelectedTrade(trade)
    setShowCloseModal(true)
    // Fetch current market price for closing
    try {
      const cryptoSymbols = ['BTCUSD', 'ETHUSD', 'BTCUSDT', 'ETHUSDT']
      let priceData = null
      if (cryptoSymbols.includes(trade.symbol)) {
        const prices = await binanceApiService.getAllPrices([trade.symbol])
        priceData = prices[trade.symbol]
      } else {
        priceData = await metaApiService.getSymbolPrice(trade.symbol)
      }
      if (priceData) {
        const closePrice = trade.side === 'BUY' ? priceData.bid : priceData.ask
        setCloseFormPrice(closePrice)
      }
    } catch (e) {
      console.error('Error fetching close price:', e)
    }
  }

  // Calculate PnL when admin changes prices
  const calculatePnL = () => {
    if (!selectedTrade || !editForm.closePrice) return
    const contractSize = selectedTrade.contractSize || 100
    const pnl = selectedTrade.side === 'BUY'
      ? (parseFloat(editForm.closePrice) - parseFloat(editForm.openPrice)) * parseFloat(editForm.quantity) * contractSize
      : (parseFloat(editForm.openPrice) - parseFloat(editForm.closePrice)) * parseFloat(editForm.quantity) * contractSize
    setEditForm(prev => ({ ...prev, realizedPnl: Math.round(pnl * 100) / 100 }))
  }

  const fetchTrades = async () => {
    setLoading(true)
    try {
      const offset = (currentPage - 1) * tradesPerPage
      const statusParam = filterStatus !== 'all' ? `&status=${filterStatus.toUpperCase()}` : ''
      const dateFromParam = dateFrom ? `&dateFrom=${dateFrom}` : ''
      const dateToParam = dateTo ? `&dateTo=${dateTo}` : ''
      const kindParam = `&accountKind=${accountKind}`
      const statsParams = new URLSearchParams()
      if (dateFrom) statsParams.set('dateFrom', dateFrom)
      if (dateTo) statsParams.set('dateTo', dateTo)
      statsParams.set('accountKind', accountKind)

      const [tradesRes, statsRes] = await Promise.all([
        adminFetch(`${API_URL}/admin/trade/all?limit=${tradesPerPage}&offset=${offset}${statusParam}${dateFromParam}${dateToParam}${kindParam}`),
        adminFetch(`${API_URL}/admin/trade/stats?${statsParams.toString()}`)
      ])

      const data = await tradesRes.json()
      if (data.trades) {
        setTrades(data.trades)
        setTotalTrades(data.total || data.trades.length)
      }

      const statsData = await statsRes.json()
      if (statsData.success && statsData.stats) {
        setStats(statsData.stats)
      }
    } catch (error) {
      console.error('Error fetching trades:', error)
    }
    setLoading(false)
  }

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'OPEN': return 'bg-green-500/20 text-green-500'
      case 'CLOSED': return 'bg-gray-500/20 text-gray-400'
      case 'PENDING': return 'bg-yellow-500/20 text-yellow-500'
      case 'CANCELLED': return 'bg-red-500/20 text-red-500'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  // Per-trade derivations used by sort + display
  const volumeOf = (t) => (t.quantity || 0) * (t.contractSize || getDefaultContractSize(t.symbol)) * (t.openPrice || 0)
  const pnlPctOf = (t) => {
    const margin = t.marginUsed || 0
    if (margin <= 0) return null
    return (calculateFloatingPnl(t) / margin) * 100
  }
  const sortValue = (t, key) => {
    switch (key) {
      case 'tradeId':   return t.tradeId || ''
      case 'user':      return (t.userId?.firstName || t.userId?.email || '').toLowerCase()
      case 'symbol':    return t.symbol || ''
      case 'side':      return t.side || ''
      case 'quantity':  return t.quantity || 0
      case 'openPrice': return t.openPrice || 0
      case 'closePrice':return t.closePrice || 0
      case 'openedAt':  return new Date(t.openedAt || t.createdAt || 0).getTime()
      case 'closedAt':  return new Date(t.closedAt || 0).getTime()
      case 'pnl':       return calculateFloatingPnl(t)
      case 'pnlPct':    { const p = pnlPctOf(t); return p === null ? -Infinity : p }
      case 'volume':    return volumeOf(t)
      case 'status':    return t.status || ''
      default: return 0
    }
  }

  const filteredTrades = trades
    .filter(trade => {
      const matchesSearch = trade.tradeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trade.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trade.userId?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trade.userId?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })
    .slice()
    .sort((a, b) => {
      const va = sortValue(a, sortBy)
      const vb = sortValue(b, sortBy)
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'OPEN': return <CheckCircle size={14} />
      case 'CLOSED': return <XCircle size={14} />
      case 'PENDING': return <Clock size={14} />
      default: return null
    }
  }

  return (
    <AdminLayout title="Trade Management" subtitle="Monitor and manage all trading activities">
      <div className="flex justify-end mb-4">
        <LiveDemoToggle value={accountKind} onChange={(v) => { setAccountKind(v); setCurrentPage(1) }} />
      </div>

      {/* Stats — clickable: each card sets a relevant filter/sort */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => { setFilterStatus('all'); setSortBy('openedAt'); setSortDir('desc'); setCurrentPage(1) }}
          className={`text-left bg-dark-800 rounded-xl p-5 border transition-colors ${
            filterStatus === 'all' ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-gray-800 hover:border-gray-600'
          }`}
          title="Show all trades"
        >
          <p className="text-gray-500 text-sm mb-1">Total Trades</p>
          <p className="text-white text-2xl font-bold">{stats.total.toLocaleString()}</p>
          <p className="text-gray-600 text-xs mt-1">Click to view all</p>
        </button>
        <button
          onClick={() => { setFilterStatus('open'); setSortBy('pnl'); setSortDir('desc'); setCurrentPage(1) }}
          className={`text-left bg-dark-800 rounded-xl p-5 border transition-colors ${
            filterStatus === 'open' ? 'border-green-500 ring-1 ring-green-500/50' : 'border-gray-800 hover:border-gray-600'
          }`}
          title="Show open positions"
        >
          <p className="text-gray-500 text-sm mb-1">Open Positions</p>
          <p className="text-white text-2xl font-bold">{stats.open}</p>
          <p className="text-gray-600 text-xs mt-1">Click to view open</p>
        </button>
        <button
          onClick={() => { setFilterStatus('all'); setSortBy('volume'); setSortDir('desc'); setCurrentPage(1) }}
          className={`text-left bg-dark-800 rounded-xl p-5 border transition-colors ${
            sortBy === 'volume' ? 'border-purple-500 ring-1 ring-purple-500/50' : 'border-gray-800 hover:border-gray-600'
          }`}
          title="Sort by volume"
        >
          <p className="text-gray-500 text-sm mb-1">Total Volume</p>
          <p className="text-white text-2xl font-bold">${(stats.volume / 1000000).toFixed(2)}M</p>
          <p className="text-gray-600 text-xs mt-1">Click to sort by volume</p>
        </button>
        <button
          onClick={() => { setFilterStatus('closed'); setSortBy('pnl'); setSortDir('desc'); setCurrentPage(1) }}
          className={`text-left bg-dark-800 rounded-xl p-5 border transition-colors ${
            sortBy === 'pnl' && filterStatus === 'closed' ? 'border-yellow-500 ring-1 ring-yellow-500/50' : 'border-gray-800 hover:border-gray-600'
          }`}
          title="Show closed trades sorted by P&L"
        >
          <p className="text-gray-500 text-sm mb-1">Platform P&L</p>
          <p className={`text-2xl font-bold ${stats.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(2)}
          </p>
          <p className="text-gray-600 text-xs mt-1">Click to sort by P&L</p>
        </button>
      </div>

      {/* Trades Table */}
      <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold text-lg">All Trades</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                setShowCreateModal(true)
                fetchMarketPrice('XAUUSD')
              }}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg flex items-center gap-2"
            >
              <Plus size={18} /> Create Trade
            </button>
            <button
              onClick={openBulkCloseModal}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg flex items-center gap-2"
              title="Close all open trades for a specific user"
            >
              <XCircle size={18} /> Close User Trades
            </button>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search trades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 bg-dark-700 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1) }}
              className="bg-dark-700 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-gray-600"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="pending">Pending</option>
            </select>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1) }}
                className="bg-dark-700 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gray-600 text-sm"
                title="From date"
              />
              <span className="text-gray-500 text-sm">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1) }}
                className="bg-dark-700 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gray-600 text-sm"
                title="To date"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1) }}
                  className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"
                  title="Clear date filter"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading trades...</div>
        ) : filteredTrades.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No trades found</div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden p-4 space-y-3">
              {filteredTrades.map((trade) => (
                <div key={trade._id} className="bg-dark-700 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{trade.symbol}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        trade.side === 'BUY' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                      }`}>
                        {trade.side}
                      </span>
                      {trade.closedBy === 'ADMIN' && (
                        <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-500">Admin Close</span>
                      )}
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(trade.status)}`}>
                      {getStatusIcon(trade.status)}
                      {trade.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <p className="text-gray-500">User</p>
                      <p className="text-white truncate">{trade.userId?.firstName || trade.userId?.email}</p>
                      <p className="text-gray-500 text-xs font-mono truncate">ID: {trade.userId?._id || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Lots</p>
                      <p className="text-white">{trade.quantity}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Open Price</p>
                      <p className="text-white">${trade.openPrice?.toFixed(5)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Close Price</p>
                      <p className="text-white">{trade.closePrice ? `$${trade.closePrice.toFixed(5)}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Opened At</p>
                      <p className="text-white text-xs">{trade.openedAt ? new Date(trade.openedAt).toLocaleString() : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Closed At</p>
                      <p className="text-white text-xs">{trade.closedAt ? new Date(trade.closedAt).toLocaleString() : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Live P&L</p>
                      <p className={`font-semibold ${calculateFloatingPnl(trade) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {calculateFloatingPnl(trade) >= 0 ? '+' : ''}${calculateFloatingPnl(trade).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3 border-t border-gray-600">
                    <button
                      onClick={() => openEditModal(trade)}
                      className="flex-1 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-500 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <Edit size={14} /> Edit
                    </button>
                    {isSuperAdmin && trade.status === 'OPEN' && (
                      <button
                        onClick={() => openSpreadModal(trade)}
                        className="flex-1 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-500 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                      >
                        <Sliders size={14} /> Spread
                      </button>
                    )}
                    {trade.status === 'OPEN' && (
                      <button
                        onClick={() => openCloseModal(trade)}
                        className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                      >
                        <XCircle size={14} /> Close
                      </button>
                    )}
                    {isSuperAdmin && trade.status === 'CLOSED' && (
                      <button
                        onClick={() => openReopenModal(trade)}
                        className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                      >
                        <RotateCcw size={14} /> Reopen
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    {[
                      { key: 'tradeId',    label: 'Trade ID' },
                      { key: 'user',       label: 'User' },
                      { key: 'symbol',     label: 'Symbol' },
                      { key: 'side',       label: 'Side' },
                      { key: 'quantity',   label: 'Lots' },
                      { key: 'openPrice',  label: 'Open Price' },
                      { key: 'closePrice', label: 'Close Price' },
                      { key: 'volume',     label: 'Volume' },
                      { key: 'openedAt',   label: 'Opened At' },
                      { key: 'closedAt',   label: 'Closed At' },
                      { key: 'pnl',        label: 'P&L' },
                      { key: 'pnlPct',     label: 'P&L %' },
                      { key: 'status',     label: 'Status' }
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => toggleSort(col.key)}
                        className="text-left text-gray-500 text-sm font-medium py-3 px-4 select-none cursor-pointer hover:text-white"
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortBy === col.key && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                        </span>
                      </th>
                    ))}
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((trade) => (
                    <tr key={trade._id} className="border-b border-gray-800 hover:bg-dark-700/50">
                      <td className="py-4 px-4 text-white font-mono text-sm">{trade.tradeId}</td>
                      <td className="py-4 px-4">
                        <p className="text-white">{trade.userId?.firstName || trade.userId?.email}</p>
                        <p className="text-gray-500 text-xs font-mono">{trade.userId?._id || 'N/A'}</p>
                      </td>
                      <td className="py-4 px-4 text-white font-medium">{trade.symbol}</td>
                      <td className="py-4 px-4">
                        <span className={`flex items-center gap-1 ${trade.side === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                          {trade.side === 'BUY' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {trade.side}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-white">{trade.quantity}</td>
                      <td className="py-4 px-4 text-gray-400">${trade.openPrice?.toFixed(5)}</td>
                      <td className="py-4 px-4 text-gray-400">
                        {trade.closePrice ? `$${trade.closePrice.toFixed(5)}` : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-4 px-4 text-gray-400 text-sm">
                        ${volumeOf(trade).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-4 px-4 text-gray-400 text-xs">
                        {trade.openedAt ? (
                          <>
                            <p>{new Date(trade.openedAt).toLocaleDateString()}</p>
                            <p className="text-gray-500">{new Date(trade.openedAt).toLocaleTimeString()}</p>
                          </>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-gray-400 text-xs">
                        {trade.closedAt ? (
                          <>
                            <p>{new Date(trade.closedAt).toLocaleDateString()}</p>
                            <p className="text-gray-500">{new Date(trade.closedAt).toLocaleTimeString()}</p>
                          </>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className={`py-4 px-4 font-medium ${calculateFloatingPnl(trade) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {calculateFloatingPnl(trade) >= 0 ? '+' : ''}${calculateFloatingPnl(trade).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-sm">
                        {(() => {
                          const pct = pnlPctOf(trade)
                          if (pct === null) return <span className="text-gray-600">—</span>
                          return (
                            <span className={pct >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                            </span>
                          )
                        })()}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs w-fit ${getStatusColor(trade.status)}`}>
                            {getStatusIcon(trade.status)}
                            {trade.status}
                          </span>
                          {trade.closedBy === 'ADMIN' && (
                            <span className="text-xs text-yellow-500">Admin Close</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(trade)}
                            className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors text-gray-400 hover:text-blue-500"
                            title="Edit Trade"
                          >
                            <Edit size={16} />
                          </button>
                          {isSuperAdmin && trade.status === 'OPEN' && (
                            <button
                              onClick={() => openSpreadModal(trade)}
                              className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors text-gray-400 hover:text-purple-500"
                              title="Change Spread (Super Admin)"
                            >
                              <Sliders size={16} />
                            </button>
                          )}
                          {trade.status === 'OPEN' && (
                            <button
                              onClick={() => openCloseModal(trade)}
                              className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-500"
                              title="Close Trade"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                          {isSuperAdmin && trade.status === 'CLOSED' && (
                            <button
                              onClick={() => openReopenModal(trade)}
                              className="p-2 hover:bg-green-500/20 rounded-lg transition-colors text-gray-400 hover:text-green-500"
                              title="Reopen Trade (Super Admin)"
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalTrades > tradesPerPage && (
              <div className="p-4 border-t border-gray-800 flex items-center justify-between">
                <p className="text-gray-400 text-sm">
                  Showing {((currentPage - 1) * tradesPerPage) + 1} - {Math.min(currentPage * tradesPerPage, totalTrades)} of {totalTrades} trades
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-dark-700 hover:bg-dark-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-white px-3">
                    Page {currentPage} of {Math.ceil(totalTrades / tradesPerPage)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalTrades / tradesPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(totalTrades / tradesPerPage)}
                    className="px-3 py-1 bg-dark-700 hover:bg-dark-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Trade Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-bold text-white">Create Trade</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-gray-400 text-sm mb-1">User</label>
                <select
                  value={createForm.userId}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, userId: e.target.value, tradingAccountId: '' })
                    if (e.target.value) fetchTradingAccounts(e.target.value)
                  }}
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                >
                  <option value="">Select User</option>
                  {users.map(u => (
                    <option key={u._id} value={u._id}>{u.firstName} - {u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Trading Account</label>
                <select
                  value={createForm.tradingAccountId}
                  onChange={(e) => setCreateForm({ ...createForm, tradingAccountId: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                >
                  <option value="">Select Account</option>
                  {tradingAccounts.map(a => (
                    <option key={a._id} value={a._id}>{a.accountId} - ${a.balance?.toFixed(2)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Symbol</label>
                  <select
                    value={createForm.symbol}
                    onChange={(e) => {
                      const symbol = e.target.value
                      setCreateForm({ ...createForm, symbol })
                      fetchMarketPrice(symbol)
                    }}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="XAUUSD">XAUUSD</option>
                    <option value="EURUSD">EURUSD</option>
                    <option value="GBPUSD">GBPUSD</option>
                    <option value="BTCUSD">BTCUSD</option>
                    <option value="ETHUSD">ETHUSD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Order Type</label>
                  <select
                    value={createForm.orderType}
                    onChange={(e) => {
                      const orderType = e.target.value
                      setCreateForm({ ...createForm, orderType })
                      if (orderType === 'MARKET') {
                        fetchMarketPrice(createForm.symbol)
                      }
                    }}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="MARKET">Market Order</option>
                    <option value="LIMIT">Limit Order</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Side</label>
                  <select
                    value={createForm.side}
                    onChange={(e) => {
                      const side = e.target.value
                      setCreateForm({ ...createForm, side })
                      if (createForm.orderType === 'MARKET') {
                        const price = marketPrices[createForm.symbol]
                        if (price) {
                          setCreateForm(prev => ({ 
                            ...prev, 
                            side,
                            openPrice: side === 'BUY' ? price.ask : price.bid 
                          }))
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Quantity (Lots)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={createForm.quantity}
                    onChange={(e) => setCreateForm({ ...createForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                  />
                </div>
              </div>
              
              {/* Market Price Display */}
              {loadingPrices ? (
                <div className="bg-dark-700 rounded-lg p-3 flex items-center justify-center">
                  <RefreshCw size={16} className="animate-spin text-gray-400 mr-2" />
                  <span className="text-gray-400 text-sm">Fetching live price...</span>
                </div>
              ) : marketPrices[createForm.symbol] ? (
                <div className="bg-dark-700 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <p className="text-gray-400 text-xs">Live Market Price</p>
                    <p className="text-white font-medium">{createForm.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-500">Bid: {marketPrices[createForm.symbol].bid?.toFixed(5)}</p>
                    <p className="text-green-500">Ask: {marketPrices[createForm.symbol].ask?.toFixed(5)}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-yellow-500 text-sm">Click on symbol to fetch live price</p>
                </div>
              )}

              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  {createForm.orderType === 'MARKET' ? 'Execution Price (auto)' : 'Limit Price'}
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={createForm.openPrice}
                  onChange={(e) => setCreateForm({ ...createForm, openPrice: e.target.value })}
                  disabled={createForm.orderType === 'MARKET'}
                  className={`w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white ${
                    createForm.orderType === 'MARKET' ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
                {createForm.orderType === 'MARKET' && (
                  <p className="text-gray-500 text-xs mt-1">Price auto-filled from market ({createForm.side === 'BUY' ? 'Ask' : 'Bid'})</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Stop Loss (optional)</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={createForm.stopLoss}
                    onChange={(e) => setCreateForm({ ...createForm, stopLoss: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Take Profit (optional)</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={createForm.takeProfit}
                    onChange={(e) => setCreateForm({ ...createForm, takeProfit: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTrade}
                  className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg"
                >
                  Create Trade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Edit Trade Modal */}
      {showEditModal && selectedTrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-dark-800">
              <h2 className="text-xl font-bold text-white">Edit Trade</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-dark-700 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-400 text-sm">Trade ID: {selectedTrade.tradeId}</p>
                    <p className="text-white font-medium">{selectedTrade.symbol} {selectedTrade.side}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(selectedTrade.status)}`}>
                    {selectedTrade.status}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-1">User: {selectedTrade.userId?.firstName || selectedTrade.userId?.email}</p>
                <p className="text-gray-500 text-xs font-mono">User ID: {selectedTrade.userId?._id || 'N/A'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Quantity (Lots)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Open Price</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={editForm.openPrice}
                    onChange={(e) => setEditForm({ ...editForm, openPrice: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Stop Loss</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={editForm.stopLoss}
                    onChange={(e) => setEditForm({ ...editForm, stopLoss: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Take Profit</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={editForm.takeProfit}
                    onChange={(e) => setEditForm({ ...editForm, takeProfit: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Close Price & PnL - for closed trades or to close open trades */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <p className="text-gray-400 text-sm mb-3">Close Trade Settings (for closed trades or to set P&L)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Close Price</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={editForm.closePrice}
                      onChange={(e) => setEditForm({ ...editForm, closePrice: e.target.value })}
                      className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white"
                      placeholder="Enter close price"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Realized P&L</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.realizedPnl}
                      onChange={(e) => setEditForm({ ...editForm, realizedPnl: e.target.value })}
                      className={`w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg ${
                        parseFloat(editForm.realizedPnl) >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}
                    />
                  </div>
                </div>
                {/* Calculate Button - moved below for better UX */}
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedTrade || !editForm.closePrice) {
                      alert('Please enter a close price first')
                      return
                    }
                    // Use actual contract size from trade (matches user's view)
                    const contractSize = selectedTrade.contractSize || getDefaultContractSize(selectedTrade.symbol)
                    const pnl = selectedTrade.side === 'BUY'
                      ? (parseFloat(editForm.closePrice) - parseFloat(editForm.openPrice)) * parseFloat(editForm.quantity) * contractSize
                      : (parseFloat(editForm.openPrice) - parseFloat(editForm.closePrice)) * parseFloat(editForm.quantity) * contractSize
                    // Subtract commission and swap
                    const finalPnl = pnl - (selectedTrade.commission || 0) - (selectedTrade.swap || 0)
                    setEditForm(prev => ({ ...prev, realizedPnl: Math.round(finalPnl * 100) / 100 }))
                  }}
                  className="w-full mt-3 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} />
                  Calculate P&L from Close Price
                </button>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-500 text-sm">⚠️ Changes will be saved silently without notifying the user.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditTrade}
                  className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Trade Modal */}
      {/* Reopen Trade Modal — super admin only */}
      {showReopenModal && selectedTrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !reopening && setShowReopenModal(false)}>
          <div className="bg-dark-800 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="text-green-400" />
                <h2 className="text-lg font-bold text-white">Reopen Trade</h2>
              </div>
              <button onClick={() => !reopening && setShowReopenModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertTriangle size={16} className="text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-yellow-200 text-xs">
                  This will reverse the realized P&L on the account and put the trade back to OPEN. The user will see it as a live position again.
                </p>
              </div>
              <div className="bg-dark-700 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-400"><span>Trade</span><span className="text-white font-mono">{selectedTrade.tradeId}</span></div>
                <div className="flex justify-between text-gray-400"><span>Symbol</span><span className="text-white">{selectedTrade.symbol}</span></div>
                <div className="flex justify-between text-gray-400">
                  <span>Side</span>
                  <span className={selectedTrade.side === 'BUY' ? 'text-green-500' : 'text-red-500'}>{selectedTrade.side}</span>
                </div>
                <div className="flex justify-between text-gray-400"><span>Realized P&L (will be reversed)</span>
                  <span className={(selectedTrade.realizedPnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {(selectedTrade.realizedPnl || 0) >= 0 ? '+' : ''}${(selectedTrade.realizedPnl || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0 flex gap-2">
              <button onClick={() => setShowReopenModal(false)} disabled={reopening} className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg text-sm disabled:opacity-50">Cancel</button>
              <button onClick={handleReopenTrade} disabled={reopening} className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {reopening ? 'Reopening...' : 'Reopen Trade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close All User Trades Modal */}
      {showBulkCloseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !bulkClosing && setShowBulkCloseModal(false)}>
          <div className="bg-dark-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <XCircle size={18} className="text-red-400" />
                <h2 className="text-lg font-bold text-white">Close All Open Trades</h2>
              </div>
              <button onClick={() => !bulkClosing && setShowBulkCloseModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              {!bulkCloseResult && (
                <>
                  <p className="text-sm text-gray-400">Search a user — every open position will be closed at the current market price.</p>
                  {!bulkCloseUser ? (
                    <>
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="text"
                          value={bulkCloseSearch}
                          onChange={(e) => setBulkCloseSearch(e.target.value)}
                          placeholder="Name or email..."
                          autoFocus
                          className="w-full bg-dark-700 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto divide-y divide-gray-800 rounded-lg border border-gray-800">
                        {(() => {
                          const q = bulkCloseSearch.trim().toLowerCase()
                          if (!q) return <p className="p-4 text-center text-gray-500 text-sm">Start typing to search…</p>
                          const matches = users.filter(u =>
                            (u.firstName || '').toLowerCase().includes(q) ||
                            (u.email || '').toLowerCase().includes(q)
                          ).slice(0, 20)
                          if (matches.length === 0) return <p className="p-4 text-center text-gray-500 text-sm">No users found</p>
                          return matches.map(u => (
                            <button
                              key={u._id}
                              onClick={() => setBulkCloseUser(u)}
                              className="w-full text-left px-3 py-2 hover:bg-dark-700 transition-colors"
                            >
                              <div className="text-white text-sm">{u.firstName || 'Unknown'}</div>
                              <div className="text-gray-500 text-xs">{u.email}</div>
                            </button>
                          ))
                        })()}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-dark-700 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="text-white text-sm">{bulkCloseUser.firstName || 'Unknown'}</div>
                          <div className="text-gray-500 text-xs">{bulkCloseUser.email}</div>
                        </div>
                        <button onClick={() => setBulkCloseUser(null)} className="text-gray-400 hover:text-white text-xs">Change</button>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                        <p className="text-red-200 text-xs">
                          All open positions for this user will be force-closed at the current market price. P&L will be realized to their account balance and follower trades will close too. This cannot be undone in bulk (only individual trades can be reopened by super admin).
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
              {bulkCloseResult && (
                <div className="space-y-3">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-green-300 text-sm font-medium">{bulkCloseResult.count} trade(s) closed</p>
                  </div>
                  {bulkCloseResult.closed.length > 0 && (
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {bulkCloseResult.closed.map((t, i) => (
                        <div key={i} className="text-xs flex justify-between text-gray-400">
                          <span className="font-mono">{t.tradeId} · {t.symbol}</span>
                          <span className={t.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {bulkCloseResult.failed.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-yellow-400 text-xs font-medium">{bulkCloseResult.failed.length} skipped:</p>
                      {bulkCloseResult.failed.map((t, i) => (
                        <div key={i} className="text-xs text-gray-500">
                          <span className="font-mono">{t.tradeId}</span> — {t.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-5 pt-0 flex gap-2 shrink-0">
              <button onClick={() => setShowBulkCloseModal(false)} disabled={bulkClosing} className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg text-sm disabled:opacity-50">
                {bulkCloseResult ? 'Done' : 'Cancel'}
              </button>
              {!bulkCloseResult && (
                <button
                  onClick={handleBulkClose}
                  disabled={bulkClosing || !bulkCloseUser}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {bulkClosing ? 'Closing…' : 'Close All Open Trades'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showSpreadModal && selectedTrade && (() => {
        const cur = selectedTrade.spread || 0
        const next = parseFloat(spreadInput)
        const validNext = !isNaN(next) && next >= 0
        const pip = pipFactorFor(selectedTrade.symbol)
        const delta = validNext ? (next - cur) * pip : 0
        const newOpenPrice = selectedTrade.side === 'BUY'
          ? selectedTrade.openPrice + delta
          : selectedTrade.openPrice - delta
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !updatingSpread && setShowSpreadModal(false)}>
            <div className="bg-dark-800 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders size={18} className="text-purple-400" />
                  <h2 className="text-lg font-bold text-white">Change Spread</h2>
                </div>
                <button onClick={() => !updatingSpread && setShowSpreadModal(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="text-sm text-gray-400">
                  <span className="text-white font-medium">{selectedTrade.symbol}</span>
                  <span className="mx-1">·</span>
                  <span className={selectedTrade.side === 'BUY' ? 'text-green-500' : 'text-red-500'}>{selectedTrade.side}</span>
                  <span className="mx-1">·</span>
                  <span>{selectedTrade.quantity} lots</span>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Current spread</label>
                  <div className="text-white text-sm">{cur} pips</div>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">New spread (pips)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={spreadInput}
                    onChange={(e) => setSpreadInput(e.target.value)}
                    className="w-full bg-dark-700 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="bg-dark-700 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between text-gray-400">
                    <span>Current open price</span>
                    <span className="text-white">${selectedTrade.openPrice?.toFixed(5)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>New open price (preview)</span>
                    <span className={validNext ? 'text-purple-400' : 'text-gray-600'}>
                      {validNext ? `$${newOpenPrice.toFixed(5)}` : '—'}
                    </span>
                  </div>
                  {validNext && next !== cur && (
                    <div className="flex justify-between text-gray-500 text-xs pt-1 border-t border-gray-600">
                      <span>{selectedTrade.side === 'BUY' ? 'BUY entry = ask + spread' : 'SELL entry = bid − spread'}</span>
                      <span>Δ {(next - cur).toFixed(1)} pips</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Spread change recalculates the open price and margin used. Action is logged in the admin audit log.
                </p>
              </div>
              <div className="p-5 pt-0 flex gap-2">
                <button
                  onClick={() => setShowSpreadModal(false)}
                  disabled={updatingSpread}
                  className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-lg text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSpread}
                  disabled={updatingSpread || !validNext}
                  className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {updatingSpread ? 'Saving...' : 'Save Spread'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showCloseModal && selectedTrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Close Trade</h2>
              <button onClick={() => setShowCloseModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-dark-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-2">Trade Details</p>
                <p className="text-white font-medium">{selectedTrade.tradeId}</p>
                <p className="text-white">{selectedTrade.symbol} {selectedTrade.side} {selectedTrade.quantity} lots</p>
                <p className="text-gray-400">Open Price: ${selectedTrade.openPrice}</p>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Close Price (Current Market)</label>
                <input
                  type="number"
                  step="0.00001"
                  value={closeFormPrice}
                  onChange={(e) => setCloseFormPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
              {closeFormPrice > 0 && (
                <div className="bg-dark-700 rounded-lg p-3">
                  <p className="text-gray-400 text-sm">Estimated P&L:</p>
                  {(() => {
                    const contractSize = selectedTrade.contractSize || getDefaultContractSize(selectedTrade.symbol)
                    const rawPnl = selectedTrade.side === 'BUY' 
                      ? (closeFormPrice - selectedTrade.openPrice) * selectedTrade.quantity * contractSize
                      : (selectedTrade.openPrice - closeFormPrice) * selectedTrade.quantity * contractSize
                    const finalPnl = rawPnl - (selectedTrade.commission || 0) - (selectedTrade.swap || 0)
                    return (
                      <p className={`text-lg font-bold ${finalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ${finalPnl.toFixed(2)}
                      </p>
                    )
                  })()}
                </div>
              )}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-500 text-sm">This will close the trade as "Admin Close". The user will see this in their trade history.</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => { setShowCloseModal(false); setCloseFormPrice(0); }}
                  className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseTrade}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                >
                  Close Trade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminTradeManagement
