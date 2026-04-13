import { useState, useEffect } from 'react'
import adminFetch from '../utils/adminFetch.js'
import {
  Plus,
  Trash2,
  Download,
  FileSpreadsheet,
  FileText,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Handshake
} from 'lucide-react'
import { API_URL } from '../config/api'

const SettlementPanel = ({ source, maxAmount, onTotalSettledChange }) => {
  const [settlements, setSettlements] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', contact: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [downloading, setDownloading] = useState(false)
  const itemsPerPage = 10

  const fetchSettlements = async () => {
    setLoading(true)
    try {
      const res = await adminFetch(`${API_URL}/settlements?source=${source}&limit=500`)
      const data = await res.json()
      if (data.success) {
        setSettlements(data.settlements)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching settlements:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchSettlements()
  }, [source])

  const totalAmount = settlements.reduce((sum, s) => sum + (s.amount || 0), 0)
  const availableBalance = maxAmount != null ? maxAmount - totalAmount : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.amount || !form.contact || !form.reason) {
      alert('All fields are required')
      return
    }
    const amt = parseFloat(form.amount)
    if (availableBalance != null && amt > availableBalance) {
      alert(`Settlement amount ($${amt.toFixed(2)}) exceeds available balance ($${availableBalance.toFixed(2)})`)
      return
    }
    setSubmitting(true)
    try {
      const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}')
      const res = await adminFetch(`${API_URL}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount), source, adminName: adminUser.name || adminUser.email || '' })
      })
      const data = await res.json()
      if (data.success) {
        setForm({ name: '', amount: '', contact: '', reason: '' })
        setShowForm(false)
        fetchSettlements()
      } else {
        alert(data.message || 'Error creating settlement')
      }
    } catch (error) {
      alert('Error creating settlement')
    }
    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this settlement record?')) return
    try {
      const res = await adminFetch(`${API_URL}/settlements/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) fetchSettlements()
      else alert(data.message || 'Error deleting')
    } catch (error) {
      alert('Error deleting settlement')
    }
  }

  const handleExport = async (format) => {
    setDownloading(true)
    try {
      const res = await adminFetch(`${API_URL}/settlements/export?source=${source}&format=${format}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `settlements_${source}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      alert('Error downloading report')
    }
    setDownloading(false)
  }

  const filtered = settlements.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    if (onTotalSettledChange) onTotalSettledChange(totalAmount)
  }, [totalAmount])

  useEffect(() => { setCurrentPage(1) }, [searchTerm])

  return (
    <div>
      {/* Summary Bar */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${availableBalance != null ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-6`}>
        {availableBalance != null && (
          <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Handshake size={18} className="text-yellow-500" />
              <p className="text-gray-500 text-sm">Available Balance</p>
            </div>
            <p className={`text-2xl font-bold ${availableBalance > 0 ? 'text-yellow-500' : 'text-red-500'}`}>
              ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        )}
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Handshake size={18} className="text-blue-500" />
            <p className="text-gray-500 text-sm">Total Settlements</p>
          </div>
          <p className="text-white text-2xl font-bold">{settlements.length}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <Handshake size={18} className="text-green-500" />
            <p className="text-gray-500 text-sm">Total Amount Settled</p>
          </div>
          <p className="text-green-500 text-2xl font-bold">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800 flex items-center justify-center">
          <button
            onClick={() => setShowForm(true)}
            disabled={availableBalance != null && availableBalance <= 0}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
            New Settlement
          </button>
        </div>
      </div>

      {/* Settlement Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">New Settlement</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Person or organization name"
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  Amount ($) *
                  {availableBalance != null && (
                    <span className="text-yellow-500 ml-2">Max: ${availableBalance.toFixed(2)}</span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={availableBalance != null ? availableBalance : undefined}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Contact *</label>
                <input
                  type="text"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  placeholder="Phone, email, or ID"
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Reason *</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Reason for settlement"
                  rows={3}
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 bg-dark-700 text-gray-400 rounded-lg hover:bg-dark-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold text-lg">Settlement History</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Export Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('excel')}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white text-sm transition-colors"
              >
                <FileSpreadsheet size={14} />
                Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white text-sm transition-colors"
              >
                <FileText size={14} />
                PDF
              </button>
            </div>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search settlements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-56 bg-dark-700 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading settlements...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No settlements found</div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden p-4 space-y-3">
              {paginated.map((s) => (
                <div key={s._id} className="bg-dark-700 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-medium">{s.name}</p>
                      <p className="text-gray-500 text-xs">{s.contact}</p>
                    </div>
                    <p className="text-green-500 font-bold text-lg">${s.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-sm mb-2">
                    <p className="text-gray-500">Reason</p>
                    <p className="text-white">{s.reason}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(s.createdAt).toLocaleString()}</span>
                    <button onClick={() => handleDelete(s._id)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">#</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Name</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Amount</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Contact</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Reason</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Admin</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Date</th>
                    <th className="text-left text-gray-500 text-sm font-medium py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s, i) => (
                    <tr key={s._id} className="border-b border-gray-800 hover:bg-dark-700/50">
                      <td className="py-4 px-4 text-gray-400">{(currentPage - 1) * itemsPerPage + i + 1}</td>
                      <td className="py-4 px-4 text-white font-medium">{s.name}</td>
                      <td className="py-4 px-4 text-green-500 font-medium">${s.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-4 px-4 text-gray-300">{s.contact}</td>
                      <td className="py-4 px-4 text-gray-300 max-w-[200px] truncate" title={s.reason}>{s.reason}</td>
                      <td className="py-4 px-4 text-gray-400">{s.adminName || '-'}</td>
                      <td className="py-4 px-4 text-gray-400">{new Date(s.createdAt).toLocaleString()}</td>
                      <td className="py-4 px-4">
                        <button onClick={() => handleDelete(s._id)} className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-gray-800">
            <p className="text-gray-500 text-sm">
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page
                if (totalPages <= 5) page = i + 1
                else if (currentPage <= 3) page = i + 1
                else if (currentPage >= totalPages - 2) page = totalPages - 4 + i
                else page = currentPage - 2 + i
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page ? 'bg-red-500 text-white' : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
                    }`}
                  >
                    {page}
                  </button>
                )
              })}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettlementPanel
