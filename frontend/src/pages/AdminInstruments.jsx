import { useState, useEffect } from 'react'
import adminFetch from '../utils/adminFetch.js'
import AdminLayout from '../components/AdminLayout'
import { Plus, Edit, Trash2, X, Search, RefreshCw, Check, AlertTriangle, Download } from 'lucide-react'
import { API_URL } from '../config/api'

const SEGMENTS = ['Crypto', 'Forex', 'Metals', 'Commodities', 'Indices']

const emptyForm = {
  symbol: '',
  name: '',
  segment: 'Crypto',
  infowayCode: '',
  baseCurrency: '',
  quoteCurrency: 'USD',
  contractSize: 1,
  pipSize: 0.01,
  pipValue: 1,
  digits: 2,
  minLotSize: 0.01,
  maxLotSize: 100,
  lotStep: 0.01,
  tradingViewSymbol: '',
  popular: false,
  isActive: true
}

const AdminInstruments = () => {
  const [instruments, setInstruments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [banner, setBanner] = useState(null) // { type, text }
  const [message, setMessage] = useState(null) // { type, text }

  useEffect(() => { fetchInstruments() }, [])

  const fetchInstruments = async () => {
    setLoading(true)
    try {
      const res = await adminFetch(`${API_URL}/instruments`)
      const data = await res.json()
      if (data.success) setInstruments(data.instruments || [])
    } catch (e) {
      console.error('Error fetching instruments:', e)
    }
    setLoading(false)
  }

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setMessage(null)
    setShowModal(true)
  }

  const openEdit = (inst) => {
    setEditing(inst)
    setForm({
      symbol: inst.symbol || '',
      name: inst.name || '',
      segment: inst.segment || 'Crypto',
      infowayCode: inst.infowayCode || '',
      baseCurrency: inst.baseCurrency || '',
      quoteCurrency: inst.quoteCurrency || 'USD',
      contractSize: inst.contractSize ?? 1,
      pipSize: inst.pipSize ?? 0.01,
      pipValue: inst.pipValue ?? 1,
      digits: inst.digits ?? 2,
      minLotSize: inst.minLotSize ?? 0.01,
      maxLotSize: inst.maxLotSize ?? 100,
      lotStep: inst.lotStep ?? 0.01,
      tradingViewSymbol: inst.tradingViewSymbol || '',
      popular: !!inst.popular,
      isActive: inst.isActive !== false
    })
    setMessage(null)
    setShowModal(true)
  }

  // Sensible defaults per segment so the admin doesn't have to think about pipSize for crypto.
  const applySegmentDefaults = (segment) => {
    if (segment === 'Crypto') return { contractSize: 1, pipSize: 0.01, pipValue: 1, digits: 2 }
    if (segment === 'Metals') return { contractSize: 100, pipSize: 0.01, pipValue: 1, digits: 2 }
    if (segment === 'Indices') return { contractSize: 1, pipSize: 0.1, pipValue: 1, digits: 1 }
    if (segment === 'Commodities') return { contractSize: 1000, pipSize: 0.01, pipValue: 10, digits: 2 }
    return { contractSize: 100000, pipSize: 0.0001, pipValue: 10, digits: 5 } // Forex
  }

  const handleSegmentChange = (segment) => {
    setForm({ ...form, segment, ...applySegmentDefaults(segment) })
  }

  const handleSave = async () => {
    if (!form.symbol || !form.name || !form.infowayCode) {
      setMessage({ type: 'error', text: 'Symbol, Name, and Infoway Code are required' })
      return
    }
    setSaving(true)
    try {
      const url = editing ? `${API_URL}/instruments/${editing._id}` : `${API_URL}/instruments`
      const method = editing ? 'PUT' : 'POST'
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, symbol: form.symbol.toUpperCase().trim() })
      })
      const data = await res.json()
      if (data.success) {
        setShowModal(false)
        fetchInstruments()
      } else {
        setMessage({ type: 'error', text: data.message || 'Save failed' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error' })
    }
    setSaving(false)
  }

  const handleSeed = async () => {
    if (!confirm('Import all platform symbols (~140) from the built-in catalog into the Instruments collection? Existing entries are skipped.')) return
    setSeeding(true)
    try {
      const res = await adminFetch(`${API_URL}/instruments/seed-from-legacy`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setBanner({ type: 'success', text: data.message })
        fetchInstruments()
      } else {
        setBanner({ type: 'error', text: data.message || 'Seed failed' })
      }
    } catch (e) {
      setBanner({ type: 'error', text: 'Network error during seed' })
    }
    setSeeding(false)
    setTimeout(() => setBanner(null), 6000)
  }

  const handleDelete = async (inst) => {
    if (!confirm(`Delete ${inst.symbol}? This will remove it from price feeds and charge defaults.`)) return
    try {
      const res = await adminFetch(`${API_URL}/instruments/${inst._id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) fetchInstruments()
      else alert(data.message || 'Delete failed')
    } catch (e) {
      alert('Network error')
    }
  }

  const filtered = instruments.filter(i => {
    if (segmentFilter !== 'All' && i.segment !== segmentFilter) return false
    if (search && !`${i.symbol} ${i.name}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <AdminLayout title="Instrument Management" subtitle="Add crypto, forex, metals, commodities and indices">
      {banner && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${banner.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {banner.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {banner.text}
        </div>
      )}
      <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-800">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium">
              <Plus size={16} /> Add Instrument
            </button>
            <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium" title="Import all symbols from the built-in catalog (~140) into the DB. Skips existing.">
              <Download size={16} /> {seeding ? 'Importing…' : 'Import Existing Symbols'}
            </button>
            <button onClick={fetchInstruments} className="p-2 hover:bg-dark-700 rounded-lg text-gray-400" title="Refresh">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search symbol or name"
                className="pl-9 pr-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm w-56"
              />
            </div>
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
            >
              <option value="All">All Segments</option>
              {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-500 text-xs font-medium py-3 px-4">Symbol</th>
                <th className="text-left text-gray-500 text-xs font-medium py-3 px-4">Name</th>
                <th className="text-left text-gray-500 text-xs font-medium py-3 px-4">Segment</th>
                <th className="text-left text-gray-500 text-xs font-medium py-3 px-4">Infoway Code</th>
                <th className="text-left text-gray-500 text-xs font-medium py-3 px-4">Contract</th>
                <th className="text-left text-gray-500 text-xs font-medium py-3 px-4">Digits</th>
                <th className="text-left text-gray-500 text-xs font-medium py-3 px-4">Status</th>
                <th className="text-right text-gray-500 text-xs font-medium py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="text-center py-8 text-gray-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-8 text-gray-500">
                  No instruments in the DB yet. Click <span className="text-purple-400 font-medium">"Import Existing Symbols"</span> to load the ~140 built-in symbols, or <span className="text-primary-400 font-medium">"Add Instrument"</span> to create a new one.
                </td></tr>
              ) : (
                filtered.map(inst => (
                  <tr key={inst._id} className="border-b border-gray-800 hover:bg-dark-700/40">
                    <td className="py-3 px-4 text-white font-mono">{inst.symbol}</td>
                    <td className="py-3 px-4 text-gray-300">{inst.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">{inst.segment}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 font-mono text-sm">{inst.infowayCode}</td>
                    <td className="py-3 px-4 text-gray-400">{inst.contractSize}</td>
                    <td className="py-3 px-4 text-gray-400">{inst.digits}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${inst.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/30 text-gray-400'}`}>
                        {inst.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(inst)} className="p-1.5 hover:bg-dark-600 rounded text-gray-400 hover:text-white" title="Edit">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(inst)} className="p-1.5 hover:bg-dark-600 rounded text-gray-400 hover:text-red-400" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-white font-semibold">{editing ? `Edit ${editing.symbol}` : 'Add Instrument'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4">
              {message && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {message.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Symbol <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                    placeholder="e.g. BTCUSD"
                    disabled={!!editing}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm font-mono disabled:opacity-50"
                  />
                  {editing && <p className="text-gray-500 text-xs mt-1">Symbol can't be changed after creation</p>}
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Display Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Bitcoin"
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Segment</label>
                  <select
                    value={form.segment}
                    onChange={(e) => handleSegmentChange(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  >
                    {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Infoway Code <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.infowayCode}
                    onChange={(e) => setForm({ ...form, infowayCode: e.target.value })}
                    placeholder="e.g. BTCUSDT (crypto) or EURUSD (forex)"
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm font-mono"
                  />
                  <p className="text-gray-500 text-xs mt-1">Upstream symbol on Infoway.io. Crypto uses USDT suffix.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Base Currency</label>
                  <input
                    type="text"
                    value={form.baseCurrency}
                    onChange={(e) => setForm({ ...form, baseCurrency: e.target.value.toUpperCase() })}
                    placeholder="e.g. BTC"
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Quote Currency</label>
                  <input
                    type="text"
                    value={form.quoteCurrency}
                    onChange={(e) => setForm({ ...form, quoteCurrency: e.target.value.toUpperCase() })}
                    placeholder="e.g. USD"
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Digits</label>
                  <input
                    type="number"
                    min="0"
                    value={form.digits}
                    onChange={(e) => setForm({ ...form, digits: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Contract Size</label>
                  <input
                    type="number"
                    value={form.contractSize}
                    onChange={(e) => setForm({ ...form, contractSize: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Pip Size</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={form.pipSize}
                    onChange={(e) => setForm({ ...form, pipSize: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Pip Value (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.pipValue}
                    onChange={(e) => setForm({ ...form, pipValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Min Lot</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.minLotSize}
                    onChange={(e) => setForm({ ...form, minLotSize: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Max Lot</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.maxLotSize}
                    onChange={(e) => setForm({ ...form, maxLotSize: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Lot Step</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.lotStep}
                    onChange={(e) => setForm({ ...form, lotStep: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1">TradingView Symbol (optional)</label>
                <input
                  type="text"
                  value={form.tradingViewSymbol}
                  onChange={(e) => setForm({ ...form, tradingViewSymbol: e.target.value })}
                  placeholder="e.g. BINANCE:BTCUSDT"
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={form.popular} onChange={(e) => setForm({ ...form, popular: e.target.checked })} />
                  Mark as popular
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  Active (available for trading)
                </label>
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-700">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminInstruments
