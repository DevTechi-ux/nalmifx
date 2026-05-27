import { useState, useEffect } from 'react'
import adminFetch from '../utils/adminFetch.js'
import AdminLayout from '../components/AdminLayout'
import { 
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  RefreshCw,
  Search,
  User,
  Info,
  TrendingUp,
  Moon
} from 'lucide-react'
import { API_URL } from '../config/api'

const AdminForexCharges = () => {
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalType, setModalType] = useState(null) // 'commission', 'spread', 'swap'
  const [editingCharge, setEditingCharge] = useState(null)
  const [users, setUsers] = useState([])
  const [accountTypes, setAccountTypes] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedAccountType, setSelectedAccountType] = useState(null)
  const [form, setForm] = useState({
    level: 'SEGMENT',
    segment: 'Forex',
    instrumentSymbol: '',
    userId: '',
    accountTypeId: '',
    spreadType: 'FIXED',
    spreadValue: 0,
    commissionType: 'PER_LOT',
    commissionValue: 0,
    commissionOnBuy: true,
    commissionOnSell: true,
    commissionOnClose: false,
    swapLong: 0,
    swapShort: 0
  })

  const [inrRate, setInrRate] = useState(83)
  const [showBulkSpreadModal, setShowBulkSpreadModal] = useState(false)
  const [bulkSpread, setBulkSpread] = useState({ value: 1, type: 'FIXED' })
  const [bulkApplying, setBulkApplying] = useState(false)

  // Multi-select for bulk delete (shared across all three sections, keyed by charge _id)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  // Live instrument catalogue from the Instruments collection — replaces the
  // previously hardcoded 10-pair dropdown so exotics like USDTHB / USDRUB /
  // USOIL / NGAS / COPPER (which exist on the trading screen) are reachable
  // from the charges modals.
  const [instruments, setInstruments] = useState([])

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  // Select / deselect every row currently shown in a section
  const toggleSelectAll = (rows) => {
    const ids = rows.map(c => c._id)
    const allSelected = ids.length > 0 && ids.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }
  const allSelected = (rows) => rows.length > 0 && rows.every(c => selectedIds.has(c._id))
  const selectedCountIn = (rows) => rows.filter(c => selectedIds.has(c._id)).length

  const handleBulkDelete = async (rows) => {
    const idsToDelete = rows.filter(c => selectedIds.has(c._id)).map(c => c._id)
    if (idsToDelete.length === 0) return
    if (!confirm(`Delete ${idsToDelete.length} selected charge(s)? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      const res = await adminFetch(`${API_URL}/charges/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete })
      })
      const data = await res.json()
      if (data.success) {
        setSelectedIds(prev => {
          const next = new Set(prev)
          idsToDelete.forEach(id => next.delete(id))
          return next
        })
        fetchCharges()
      } else {
        alert(data.message || 'Failed to delete')
      }
    } catch (e) {
      alert('Error deleting charges')
    }
    setBulkDeleting(false)
  }

  useEffect(() => {
    fetchCharges()
    fetchUsers()
    fetchAccountTypes()
    fetchInrRate()
    fetchInstruments()
  }, [])

  // Build the <optgroup>/<option> tree for the Instrument selects from the
  // live Instrument collection, grouped by segment in a stable order.
  // Filters by `filterSegment` when one is set on the form. This replaces
  // the previously hardcoded 10-pair Forex list, so exotics like USDTHB /
  // USDRUB / USOIL / NGAS / COPPER are now reachable from every modal.
  const renderInstrumentOptions = (filterSegment) => {
    const SEGMENT_ORDER = ['Forex', 'Metals', 'Crypto', 'Indices', 'Stocks', 'Commodities', 'Energy']
    const grouped = instruments.reduce((acc, inst) => {
      const seg = inst.segment || 'Other'
      if (!acc[seg]) acc[seg] = []
      acc[seg].push(inst)
      return acc
    }, {})
    const segs = [
      ...SEGMENT_ORDER.filter(s => grouped[s]),
      ...Object.keys(grouped).filter(s => !SEGMENT_ORDER.includes(s)).sort()
    ]
    return segs
      .filter(seg => !filterSegment || seg === filterSegment)
      .map(seg => (
        <optgroup key={seg} label={seg}>
          {grouped[seg]
            .slice()
            .sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''))
            .map(inst => (
              <option key={inst.symbol} value={inst.symbol}>
                {inst.symbol}{inst.name && inst.name !== inst.symbol ? ` (${inst.name})` : ''}
              </option>
            ))}
        </optgroup>
      ))
  }

  const fetchInstruments = async () => {
    try {
      // Same Instrument collection AdminInstruments manages. Auth required
      // (route is behind authAny) so we use adminFetch.
      const res = await adminFetch(`${API_URL}/instruments`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data.instruments || [])
      setInstruments(list)
    } catch (error) {
      console.error('Error fetching instruments:', error)
    }
  }

  const fetchInrRate = async () => {
    try {
      const res = await adminFetch(`${API_URL}/payment-methods/currencies/active`)
      const data = await res.json()
      const inr = (data.currencies || []).find(c => c.currency === 'INR')
      if (inr?.rateToUSD) setInrRate(inr.rateToUSD)
    } catch (error) {
      console.error('Error fetching INR rate:', error)
    }
  }

  // Spread → USD per standard lot. The Charges model documents the unit per
  // asset class: Forex=pips, Metals=cents, Crypto=USD. We compute a per-lot
  // dollar estimate so admins can compare spreads across instruments.
  const spreadToUsd = (charge) => {
    if (!charge.spreadValue) return 0
    const symbol = (charge.instrumentSymbol || '').toUpperCase()
    if (!symbol) return charge.spreadValue
    // Crypto: spread value is in USD
    if (/^(BTC|ETH|LTC|XRP|BCH|DOGE)/.test(symbol)) return charge.spreadValue
    // Metals: spread value is in cents on a 100oz lot
    if (symbol.startsWith('XAU') || symbol.startsWith('XAG')) {
      return (charge.spreadValue / 100) * 100
    }
    // Forex: spread value is in pips. 1 pip ≈ $10 per standard lot for USD-quoted pairs.
    if (symbol.endsWith('JPY')) return charge.spreadValue * 9.09
    return charge.spreadValue * 10
  }

  const handleBulkApplySpread = async () => {
    if (!bulkSpread.value || bulkSpread.value < 0) return
    setBulkApplying(true)
    try {
      const res = await adminFetch(`${API_URL}/charges/bulk-apply-spread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadValue: parseFloat(bulkSpread.value), spreadType: bulkSpread.type })
      })
      const data = await res.json()
      if (data.success) {
        setShowBulkSpreadModal(false)
        fetchCharges()
      } else {
        alert(data.message || 'Failed to apply spread')
      }
    } catch (e) {
      alert('Error applying spread')
    }
    setBulkApplying(false)
  }

  const fetchAccountTypes = async () => {
    try {
      const res = await adminFetch(`${API_URL}/account-types/all`)
      const data = await res.json()
      setAccountTypes(data.accountTypes || [])
    } catch (error) {
      console.error('Error fetching account types:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin/users`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchCharges = async () => {
    setLoading(true)
    try {
      const res = await adminFetch(`${API_URL}/charges?segment=Forex`)
      const data = await res.json()
      if (data.success) {
        setCharges(data.charges || [])
      }
    } catch (error) {
      console.error('Error fetching charges:', error)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    try {
      const url = editingCharge
        ? `${API_URL}/charges/${editingCharge._id}`
        : `${API_URL}/charges`
      const method = editingCharge ? 'PUT' : 'POST'

      // Coerce numeric form fields here, not on every keystroke. Doing it
      // mid-typing snapped the field back to 0 whenever the user typed a
      // partial decimal ("1.") or cleared it, leaving arrow keys as the
      // only way to change the value.
      const toNum = (v) => {
        const n = parseFloat(v)
        return Number.isFinite(n) ? n : 0
      }
      const payload = {
        ...form,
        commissionValue: toNum(form.commissionValue),
        spreadValue: toNum(form.spreadValue),
        swapLong: toNum(form.swapLong),
        swapShort: toNum(form.swapShort)
      }

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.success) {
        alert(editingCharge ? 'Updated!' : 'Created!')
        setModalType(null)
        setEditingCharge(null)
        resetForm()
        fetchCharges()
      } else {
        alert(data.message || 'Error saving')
      }
    } catch (error) {
      alert('Error saving')
    }
  }

  const handleDelete = async (chargeId) => {
    if (!confirm('Are you sure you want to delete this charge?')) return
    try {
      const res = await adminFetch(`${API_URL}/charges/${chargeId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        alert('Charge deleted!')
        fetchCharges()
      } else {
        alert(data.message || 'Error deleting charge')
      }
    } catch (error) {
      alert('Error deleting charge')
    }
  }

  const openEditModal = (charge, type) => {
    setEditingCharge(charge)
    setForm({
      level: charge.level || 'SEGMENT',
      segment: charge.segment || 'Forex',
      instrumentSymbol: charge.instrumentSymbol || '',
      userId: charge.userId?._id || charge.userId || '',
      accountTypeId: charge.accountTypeId?._id || charge.accountTypeId || '',
      spreadType: charge.spreadType || 'FIXED',
      spreadValue: charge.spreadValue || 0,
      commissionType: charge.commissionType || 'PER_LOT',
      commissionValue: charge.commissionValue || 0,
      commissionOnBuy: charge.commissionOnBuy !== false,
      commissionOnSell: charge.commissionOnSell !== false,
      commissionOnClose: charge.commissionOnClose || false,
      swapLong: charge.swapLong || 0,
      swapShort: charge.swapShort || 0
    })
    if (charge.level === 'USER' && charge.userId) {
      const user = users.find(u => u._id === (charge.userId?._id || charge.userId))
      setSelectedUser(user || null)
    } else {
      setSelectedUser(null)
    }
    if (charge.level === 'ACCOUNT_TYPE' && charge.accountTypeId) {
      const accType = accountTypes.find(a => a._id === (charge.accountTypeId?._id || charge.accountTypeId))
      setSelectedAccountType(accType || null)
    } else {
      setSelectedAccountType(null)
    }
    setModalType(type)
  }

  const resetForm = () => {
    setForm({
      level: 'SEGMENT',
      segment: 'Forex',
      instrumentSymbol: '',
      userId: '',
      accountTypeId: '',
      spreadType: 'FIXED',
      spreadValue: 0,
      commissionType: 'PER_LOT',
      commissionValue: 0,
      commissionOnBuy: true,
      commissionOnSell: true,
      commissionOnClose: false,
      swapLong: 0,
      swapShort: 0
    })
    setSelectedUser(null)
    setSelectedAccountType(null)
    setUserSearch('')
  }

  const selectUser = (user) => {
    setSelectedUser(user)
    setForm({ ...form, userId: user._id })
    setShowUserDropdown(false)
    setUserSearch('')
  }

  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase()
    const searchLower = userSearch.toLowerCase()
    return fullName.includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.phone?.includes(userSearch) ||
      user._id?.includes(userSearch)
  })

  const getLevelLabel = (charge) => {
    if (charge.level === 'USER') {
      const userName = charge.userId?.firstName 
        ? `${charge.userId.firstName} ${charge.userId.lastName || ''}`.trim()
        : charge.userId?.email || 'Unknown User'
      return `${userName} - ${charge.instrumentSymbol || 'All Instruments'}`
    }
    if (charge.level === 'INSTRUMENT') return charge.instrumentSymbol
    if (charge.level === 'SEGMENT') return charge.segment
    if (charge.level === 'GLOBAL') return 'Global'
    return charge.level
  }

  return (
    <AdminLayout title="Forex Charges" subtitle="Manage trading fees and spreads">
      <div className="space-y-6">
        
        {/* COMMISSION SECTION */}
        {(() => { const rows = charges.filter(c => c.commissionValue > 0); return (
        <div className="bg-dark-800 rounded-xl border border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center shrink-0">
                <DollarSign size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Commission</h2>
                <p className="text-gray-500 text-sm">Trading fees per lot/trade</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedCountIn(rows) > 0 && (
                <button
                  onClick={() => handleBulkDelete(rows)}
                  disabled={bulkDeleting}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors text-sm disabled:opacity-50"
                >
                  <Trash2 size={15} /> Delete ({selectedCountIn(rows)})
                </button>
              )}
              <button
                onClick={() => { resetForm(); setEditingCharge(null); setModalType('commission') }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                <Plus size={16} />
                <span>Add Commission</span>
              </button>
            </div>
          </div>
          <div className="p-4">
            {loading ? (
              <p className="text-gray-500 text-center py-4">Loading...</p>
            ) : rows.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No commission charges configured</p>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 px-3 text-xs text-gray-400 cursor-pointer select-none">
                  <input type="checkbox" checked={allSelected(rows)} onChange={() => toggleSelectAll(rows)} className="accent-purple-500" />
                  Select all
                </label>
                {rows.map((charge) => (
                  <div key={charge._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-dark-700 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <input type="checkbox" checked={selectedIds.has(charge._id)} onChange={() => toggleSelect(charge._id)} className="accent-purple-500 shrink-0" />
                      <span className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded shrink-0">{charge.level}</span>
                      <span className="text-white truncate">{getLevelLabel(charge)}</span>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 pl-7 sm:pl-0">
                      <span className="text-white font-medium">${charge.commissionValue} <span className="text-gray-500 text-sm">({charge.commissionType})</span></span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditModal(charge, 'commission')} className="p-1.5 hover:bg-dark-600 rounded text-gray-400 hover:text-white"><Edit size={14} /></button>
                        <button onClick={() => handleDelete(charge._id)} className="p-1.5 hover:bg-dark-600 rounded text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )})()}

        {/* SPREAD SECTION */}
        {(() => { const rows = charges.filter(c => c.spreadValue > 0); return (
        <div className="bg-dark-800 rounded-xl border border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Spread</h2>
                <p className="text-gray-500 text-sm">Bid/Ask price difference</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedCountIn(rows) > 0 && (
                <button
                  onClick={() => handleBulkDelete(rows)}
                  disabled={bulkDeleting}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors text-sm disabled:opacity-50"
                >
                  <Trash2 size={15} /> Delete ({selectedCountIn(rows)})
                </button>
              )}
              <button
                onClick={() => setShowBulkSpreadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors text-sm"
                title="Apply one spread value to every symbol in one click"
              >
                <TrendingUp size={16} />
                <span>Apply to All Symbols</span>
              </button>
              <button
                onClick={() => { resetForm(); setEditingCharge(null); setModalType('spread') }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                <Plus size={16} />
                <span>Add Spread</span>
              </button>
            </div>
          </div>
          <div className="p-4">
            {loading ? (
              <p className="text-gray-500 text-center py-4">Loading...</p>
            ) : rows.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No spread charges configured</p>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 px-3 text-xs text-gray-400 cursor-pointer select-none">
                  <input type="checkbox" checked={allSelected(rows)} onChange={() => toggleSelectAll(rows)} className="accent-purple-500" />
                  Select all
                </label>
                {rows.map((charge) => {
                  const usd = spreadToUsd(charge)
                  const inr = usd * inrRate
                  return (
                    <div key={charge._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-dark-700 rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <input type="checkbox" checked={selectedIds.has(charge._id)} onChange={() => toggleSelect(charge._id)} className="accent-purple-500 shrink-0" />
                        <span className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded shrink-0">{charge.level}</span>
                        <span className="text-white truncate">{getLevelLabel(charge)}</span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 pl-7 sm:pl-0">
                        <div className="text-left sm:text-right">
                          <div className="text-white font-medium">{charge.spreadValue} <span className="text-gray-500 text-sm">({charge.spreadType})</span></div>
                          <div className="text-xs text-gray-400">≈ ${usd.toFixed(2)} USD · ₹{inr.toFixed(2)} INR <span className="text-gray-600">per lot</span></div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEditModal(charge, 'spread')} className="p-1.5 hover:bg-dark-600 rounded text-gray-400 hover:text-white"><Edit size={14} /></button>
                          <button onClick={() => handleDelete(charge._id)} className="p-1.5 hover:bg-dark-600 rounded text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        )})()}

        {/* SWAP SECTION */}
        {(() => { const rows = charges.filter(c => c.swapLong !== 0 || c.swapShort !== 0); return (
        <div className="bg-dark-800 rounded-xl border border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center shrink-0">
                <Moon size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Swap</h2>
                <p className="text-gray-500 text-sm">Overnight holding fees</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedCountIn(rows) > 0 && (
                <button
                  onClick={() => handleBulkDelete(rows)}
                  disabled={bulkDeleting}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors text-sm disabled:opacity-50"
                >
                  <Trash2 size={15} /> Delete ({selectedCountIn(rows)})
                </button>
              )}
              <button
                onClick={() => { resetForm(); setEditingCharge(null); setModalType('swap') }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                <Plus size={16} />
                <span>Add Swap</span>
              </button>
            </div>
          </div>
          <div className="p-4">
            {loading ? (
              <p className="text-gray-500 text-center py-4">Loading...</p>
            ) : rows.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No swap charges configured</p>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 px-3 text-xs text-gray-400 cursor-pointer select-none">
                  <input type="checkbox" checked={allSelected(rows)} onChange={() => toggleSelectAll(rows)} className="accent-purple-500" />
                  Select all
                </label>
                {rows.map((charge) => (
                  <div key={charge._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-dark-700 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <input type="checkbox" checked={selectedIds.has(charge._id)} onChange={() => toggleSelect(charge._id)} className="accent-purple-500 shrink-0" />
                      <span className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded shrink-0">{charge.level}</span>
                      <span className="text-white truncate">{getLevelLabel(charge)}</span>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 pl-7 sm:pl-0">
                      <span className="text-white font-medium">Long: {charge.swapLong} | Short: {charge.swapShort}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditModal(charge, 'swap')} className="p-1.5 hover:bg-dark-600 rounded text-gray-400 hover:text-white"><Edit size={14} /></button>
                        <button onClick={() => handleDelete(charge._id)} className="p-1.5 hover:bg-dark-600 rounded text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )})()}
      </div>

      {/* COMMISSION MODAL - Cascading Hierarchy */}
      {modalType === 'commission' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-dark-800">
              <h2 className="text-lg font-semibold text-white">{editingCharge ? 'Edit Commission' : 'Add Commission'}</h2>
              <button onClick={() => setModalType(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Step 1: Account Type */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">1. Account Type <span className="text-gray-600">(optional)</span></label>
                <select value={form.accountTypeId} onChange={(e) => setForm({ ...form, accountTypeId: e.target.value, level: e.target.value ? 'ACCOUNT_TYPE' : 'GLOBAL' })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm">
                  <option value="">All Account Types (Global)</option>
                  {accountTypes.map(acc => <option key={acc._id} value={acc._id}>{acc.name}</option>)}
                </select>
              </div>

              {/* Step 2: Segment */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">2. Segment <span className="text-gray-600">(optional)</span></label>
                <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value, level: form.accountTypeId ? 'ACCOUNT_TYPE' : (e.target.value ? 'SEGMENT' : form.level) })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm">
                  <option value="">All Segments</option>
                  <option value="Forex">Forex</option>
                  <option value="Metals">Metals</option>
                  <option value="Crypto">Crypto</option>
                  <option value="Indices">Indices</option>
                </select>
              </div>

              {/* Step 3: Instrument - Filtered by Segment */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">3. Instrument <span className="text-gray-600">(optional{form.segment ? ` - showing ${form.segment} only` : ''})</span></label>
                <select value={form.instrumentSymbol} onChange={(e) => setForm({ ...form, instrumentSymbol: e.target.value, level: e.target.value ? 'INSTRUMENT' : (form.accountTypeId ? 'ACCOUNT_TYPE' : (form.segment ? 'SEGMENT' : 'GLOBAL')) })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm">
                  <option value="">All Instruments</option>
                  {renderInstrumentOptions(form.segment)}
                </select>
              </div>

              {/* Step 4: User (Optional - Highest Priority) */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">4. Specific User <span className="text-gray-600">(optional - highest priority)</span></label>
                {selectedUser ? (
                  <div className="flex items-center justify-between p-2 bg-dark-700 border border-gray-600 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs">{selectedUser.firstName?.charAt(0)}</div>
                      <div>
                        <p className="text-white text-sm">{selectedUser.firstName} {selectedUser.lastName}</p>
                        <p className="text-gray-500 text-xs">{selectedUser.email}</p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedUser(null); setForm({ ...form, userId: '', level: form.instrumentSymbol ? 'INSTRUMENT' : form.segment ? 'SEGMENT' : form.accountTypeId ? 'ACCOUNT_TYPE' : 'GLOBAL' }) }} className="text-gray-400 hover:text-white"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" placeholder="Search user to override..." value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setShowUserDropdown(true) }} onFocus={() => setShowUserDropdown(true)} className="w-full pl-9 pr-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm" />
                    {showUserDropdown && userSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-dark-700 border border-gray-600 rounded-lg max-h-40 overflow-y-auto">
                        {filteredUsers.length === 0 ? (
                          <p className="p-2 text-gray-500 text-sm">No users found</p>
                        ) : (
                          filteredUsers.slice(0, 10).map(user => (
                            <button key={user._id} onClick={() => { setSelectedUser(user); setForm({ ...form, userId: user._id, level: 'USER' }); setShowUserDropdown(false); setUserSearch('') }} className="w-full flex items-center gap-2 p-2 hover:bg-dark-600 text-left">
                              <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs">{user.firstName?.charAt(0)}</div>
                              <div>
                                <p className="text-white text-sm">{user.firstName} {user.lastName}</p>
                                <p className="text-gray-500 text-xs">{user.email}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Applied Level Indicator */}
              <div className="bg-dark-700 rounded-lg p-2 text-xs">
                <span className="text-gray-400">Applies to: </span>
                <span className="text-white font-medium">
                  {form.userId ? `User: ${selectedUser?.firstName || 'Selected'}` : ''}
                  {form.userId && form.instrumentSymbol ? ' → ' : ''}
                  {form.instrumentSymbol ? `${form.instrumentSymbol}` : ''}
                  {(form.userId || form.instrumentSymbol) && form.segment ? ' → ' : ''}
                  {form.segment ? `${form.segment}` : ''}
                  {(form.userId || form.instrumentSymbol || form.segment) && form.accountTypeId ? ' → ' : ''}
                  {form.accountTypeId ? accountTypes.find(a => a._id === form.accountTypeId)?.name : ''}
                  {!form.userId && !form.instrumentSymbol && !form.segment && !form.accountTypeId ? 'Global (All)' : ''}
                </span>
              </div>
              
              {/* Commission Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Commission Type</label>
                  <select value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm">
                    <option value="PER_LOT">Per Lot ($)</option>
                    <option value="PER_TRADE">Per Trade ($)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Value</label>
                  <input type="number" step="0.01" value={form.commissionValue} onChange={(e) => setForm({ ...form, commissionValue: e.target.value })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm" placeholder="0" />
                </div>
              </div>
              
              {/* Charge On */}
              <div>
                <label className="block text-gray-400 text-xs mb-2">Charge on:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.commissionOnBuy} onChange={(e) => setForm({ ...form, commissionOnBuy: e.target.checked })} className="w-4 h-4 rounded bg-dark-600 border-gray-600" />
                    <span className="text-white text-sm">Buy</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.commissionOnSell} onChange={(e) => setForm({ ...form, commissionOnSell: e.target.checked })} className="w-4 h-4 rounded bg-dark-600 border-gray-600" />
                    <span className="text-white text-sm">Sell</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.commissionOnClose} onChange={(e) => setForm({ ...form, commissionOnClose: e.target.checked })} className="w-4 h-4 rounded bg-dark-600 border-gray-600" />
                    <span className="text-white text-sm">Close</span>
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalType(null)} className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm">Cancel</button>
                <button onClick={handleSave} className="flex-1 py-2 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-medium">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SPREAD MODAL - Account Type first, then Instrument selection */}
      {modalType === 'spread' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-dark-800">
              <h2 className="text-lg font-semibold text-white">{editingCharge ? 'Edit Spread' : 'Add Spread'}</h2>
              <button onClick={() => setModalType(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Step 1: Account Type */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">1. Account Type <span className="text-gray-600">(optional)</span></label>
                <select value={form.accountTypeId} onChange={(e) => setForm({ ...form, accountTypeId: e.target.value, level: e.target.value ? 'ACCOUNT_TYPE' : 'GLOBAL' })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm">
                  <option value="">All Account Types (Global)</option>
                  {accountTypes.map(acc => <option key={acc._id} value={acc._id}>{acc.name}</option>)}
                </select>
              </div>

              {/* Step 2: Segment Filter */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">2. Segment <span className="text-gray-600">(optional)</span></label>
                <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value, instrumentSymbol: '' })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm">
                  <option value="">All Segments</option>
                  <option value="Forex">Forex</option>
                  <option value="Metals">Metals</option>
                  <option value="Crypto">Crypto</option>
                  <option value="Indices">Indices</option>
                </select>
              </div>

              {/* Step 3: Instrument - Filtered by Segment */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">3. Instrument <span className="text-gray-600">(optional{form.segment ? ` - showing ${form.segment} only` : ''})</span></label>
                <select value={form.instrumentSymbol} onChange={(e) => setForm({ ...form, instrumentSymbol: e.target.value, level: e.target.value ? 'INSTRUMENT' : (form.accountTypeId ? 'ACCOUNT_TYPE' : (form.segment ? 'SEGMENT' : 'GLOBAL')) })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm">
                  <option value="">All Instruments</option>
                  {renderInstrumentOptions(form.segment)}
                </select>
              </div>

              {/* Step 4: User Override (Optional) */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">4. User Override <span className="text-gray-600">(optional - for specific user only)</span></label>
                {selectedUser ? (
                  <div className="flex items-center justify-between p-2 bg-dark-700 border border-gray-600 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs">{selectedUser.firstName?.charAt(0)}</div>
                      <div>
                        <p className="text-white text-sm">{selectedUser.firstName} {selectedUser.lastName}</p>
                        <p className="text-gray-500 text-xs">{selectedUser.email}</p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedUser(null); setForm({ ...form, userId: '', level: form.instrumentSymbol ? 'INSTRUMENT' : form.accountTypeId ? 'ACCOUNT_TYPE' : 'GLOBAL' }) }} className="text-gray-400 hover:text-white"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" placeholder="Search user for custom spread..." value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setShowUserDropdown(true) }} onFocus={() => setShowUserDropdown(true)} className="w-full pl-9 pr-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm" />
                    {showUserDropdown && userSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-dark-700 border border-gray-600 rounded-lg max-h-40 overflow-y-auto">
                        {filteredUsers.length === 0 ? (
                          <p className="p-2 text-gray-500 text-sm">No users found</p>
                        ) : (
                          filteredUsers.slice(0, 10).map(user => (
                            <button key={user._id} onClick={() => { setSelectedUser(user); setForm({ ...form, userId: user._id, level: 'USER' }); setShowUserDropdown(false); setUserSearch('') }} className="w-full flex items-center gap-2 p-2 hover:bg-dark-600 text-left">
                              <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs">{user.firstName?.charAt(0)}</div>
                              <div>
                                <p className="text-white text-sm">{user.firstName} {user.lastName}</p>
                                <p className="text-gray-500 text-xs">{user.email}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Applied Level Indicator */}
              <div className="bg-dark-700 rounded-lg p-2 text-xs">
                <span className="text-gray-400">Applies to: </span>
                <span className="text-white font-medium">
                  {form.userId ? `User: ${selectedUser?.firstName || 'Selected'}` : ''}
                  {form.userId && form.instrumentSymbol ? ' → ' : ''}
                  {form.instrumentSymbol ? `${form.instrumentSymbol}` : ''}
                  {(form.userId || form.instrumentSymbol) && form.accountTypeId ? ' → ' : ''}
                  {form.accountTypeId ? accountTypes.find(a => a._id === form.accountTypeId)?.name : ''}
                  {!form.userId && !form.instrumentSymbol && !form.accountTypeId ? 'Global (All)' : ''}
                </span>
              </div>
              
              {/* Spread Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Spread Type</label>
                  <select value={form.spreadType} onChange={(e) => setForm({ ...form, spreadType: e.target.value })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm">
                    <option value="FIXED">Fixed (Pips/Cents)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Spread Value</label>
                  <input type="number" step="0.01" value={form.spreadValue} onChange={(e) => setForm({ ...form, spreadValue: e.target.value })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm" placeholder="0" />
                </div>
              </div>
              
              <p className="text-gray-500 text-xs">Forex: pips (e.g., 1.5) | Gold: cents (e.g., 50) | Crypto: USD (e.g., 10)</p>
              
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalType(null)} className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm">Cancel</button>
                <button onClick={handleSave} className="flex-1 py-2 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-medium">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SWAP MODAL - Cascading Hierarchy */}
      {modalType === 'swap' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-dark-800">
              <h2 className="text-lg font-semibold text-white">{editingCharge ? 'Edit Swap' : 'Add Swap'}</h2>
              <button onClick={() => setModalType(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Step 1: Account Type */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">1. Account Type <span className="text-gray-600">(optional)</span></label>
                <select value={form.accountTypeId} onChange={(e) => setForm({ ...form, accountTypeId: e.target.value, level: e.target.value ? 'ACCOUNT_TYPE' : 'GLOBAL' })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm">
                  <option value="">All Account Types (Global)</option>
                  {accountTypes.map(acc => <option key={acc._id} value={acc._id}>{acc.name}</option>)}
                </select>
              </div>

              {/* Step 2: Segment Filter */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">2. Segment <span className="text-gray-600">(optional)</span></label>
                <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value, instrumentSymbol: '' })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm">
                  <option value="">All Segments</option>
                  <option value="Forex">Forex</option>
                  <option value="Metals">Metals</option>
                  <option value="Crypto">Crypto</option>
                  <option value="Indices">Indices</option>
                </select>
              </div>

              {/* Step 3: Instrument - Filtered by Segment */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">3. Instrument <span className="text-gray-600">(optional{form.segment ? ` - showing ${form.segment} only` : ''})</span></label>
                <select value={form.instrumentSymbol} onChange={(e) => setForm({ ...form, instrumentSymbol: e.target.value, level: e.target.value ? 'INSTRUMENT' : (form.accountTypeId ? 'ACCOUNT_TYPE' : (form.segment ? 'SEGMENT' : 'GLOBAL')) })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm">
                  <option value="">All Instruments</option>
                  {renderInstrumentOptions(form.segment)}
                </select>
              </div>

              {/* Step 4: User Override (Optional) */}
              <div>
                <label className="block text-gray-400 text-xs mb-1">4. User Override <span className="text-gray-600">(optional - for specific user only)</span></label>
                {selectedUser ? (
                  <div className="flex items-center justify-between p-2 bg-dark-700 border border-gray-600 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs">{selectedUser.firstName?.charAt(0)}</div>
                      <div>
                        <p className="text-white text-sm">{selectedUser.firstName} {selectedUser.lastName}</p>
                        <p className="text-gray-500 text-xs">{selectedUser.email}</p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedUser(null); setForm({ ...form, userId: '', level: form.instrumentSymbol ? 'INSTRUMENT' : form.accountTypeId ? 'ACCOUNT_TYPE' : 'GLOBAL' }) }} className="text-gray-400 hover:text-white"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" placeholder="Search user for custom swap..." value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setShowUserDropdown(true) }} onFocus={() => setShowUserDropdown(true)} className="w-full pl-9 pr-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm" />
                    {showUserDropdown && userSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-dark-700 border border-gray-600 rounded-lg max-h-40 overflow-y-auto">
                        {filteredUsers.length === 0 ? (
                          <p className="p-2 text-gray-500 text-sm">No users found</p>
                        ) : (
                          filteredUsers.slice(0, 10).map(user => (
                            <button key={user._id} onClick={() => { setSelectedUser(user); setForm({ ...form, userId: user._id, level: 'USER' }); setShowUserDropdown(false); setUserSearch('') }} className="w-full flex items-center gap-2 p-2 hover:bg-dark-600 text-left">
                              <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs">{user.firstName?.charAt(0)}</div>
                              <div>
                                <p className="text-white text-sm">{user.firstName} {user.lastName}</p>
                                <p className="text-gray-500 text-xs">{user.email}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Applied Level Indicator */}
              <div className="bg-dark-700 rounded-lg p-2 text-xs">
                <span className="text-gray-400">Applies to: </span>
                <span className="text-white font-medium">
                  {form.userId ? `User: ${selectedUser?.firstName || 'Selected'}` : ''}
                  {form.userId && form.instrumentSymbol ? ' → ' : ''}
                  {form.instrumentSymbol ? `${form.instrumentSymbol}` : ''}
                  {(form.userId || form.instrumentSymbol) && form.accountTypeId ? ' → ' : ''}
                  {form.accountTypeId ? accountTypes.find(a => a._id === form.accountTypeId)?.name : ''}
                  {!form.userId && !form.instrumentSymbol && !form.accountTypeId ? 'Global (All)' : ''}
                </span>
              </div>
              
              {/* Swap Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Swap Long (points)</label>
                  <input type="number" step="0.01" value={form.swapLong} onChange={(e) => setForm({ ...form, swapLong: e.target.value })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Swap Short (points)</label>
                  <input type="number" step="0.01" value={form.swapShort} onChange={(e) => setForm({ ...form, swapShort: e.target.value })} className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm" placeholder="0" />
                </div>
              </div>
              
              <p className="text-gray-500 text-xs">Overnight fees charged for holding positions (negative = charge, positive = credit)</p>
              
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalType(null)} className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm">Cancel</button>
                <button onClick={handleSave} className="flex-1 py-2 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-medium">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Apply Spread Modal */}
      {showBulkSpreadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 rounded-xl border border-gray-700 w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Apply Spread to All Symbols</h3>
              <button onClick={() => setShowBulkSpreadModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-gray-400 text-sm mb-4">Sets the same INSTRUMENT-level spread on every symbol in the catalog. Existing per-symbol entries are updated; missing ones are created.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Spread Value</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bulkSpread.value}
                  onChange={(e) => setBulkSpread({ ...bulkSpread, value: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Type</label>
                <select
                  value={bulkSpread.type}
                  onChange={(e) => setBulkSpread({ ...bulkSpread, type: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-600 rounded-lg text-white text-sm"
                >
                  <option value="FIXED">FIXED</option>
                  <option value="PERCENTAGE">PERCENTAGE</option>
                </select>
              </div>
            </div>

            <div className="bg-dark-700 rounded-lg p-3 mb-4 text-xs text-gray-400">
              For Forex pairs: spread is in pips (1 pip ≈ $10 per lot). For metals: cents. For crypto: USD. At {bulkSpread.value} {bulkSpread.type}, a Forex pair would cost ≈ ${(bulkSpread.value * 10).toFixed(2)} USD / ₹{(bulkSpread.value * 10 * inrRate).toFixed(2)} INR per lot.
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowBulkSpreadModal(false)} className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={handleBulkApplySpread} disabled={bulkApplying} className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {bulkApplying ? 'Applying...' : 'Apply to All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminForexCharges
