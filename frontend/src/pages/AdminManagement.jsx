import { useState, useEffect } from 'react'
import adminFetch from '../utils/adminFetch.js'
import AdminLayout from '../components/AdminLayout'
import ReportDownload from '../components/ReportDownload'
import {
  Shield, Plus, Search, Eye, Edit, Trash2, Key, Mail, Calendar, X, Wallet,
  Users, DollarSign, Link, Copy, Check, AlertCircle, Lock, MapPin, Building2,
  Phone, Globe, TrendingUp, BarChart3,
  ArrowRightLeft, Hash, UserPlus
} from 'lucide-react'
import { API_URL } from '../config/api'

const AdminManagement = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('branches') // branches | overview
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showFundModal, setShowFundModal] = useState(false)
  const [showDeductModal, setShowDeductModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState(null)
  const [branchUsers, setBranchUsers] = useState([])
  const [branchUsersLoading, setBranchUsersLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [copiedSlug, setCopiedSlug] = useState(null)
  const [overviewData, setOverviewData] = useState(null)
  const [expandedBranch, setExpandedBranch] = useState(null)

  const [newAdmin, setNewAdmin] = useState({
    email: '', password: '', firstName: '', lastName: '', phone: '',
    urlSlug: '', brandName: '', branchName: '', branchLocation: '',
    branchAddress: '', branchPhone: '', branchEmail: '', maxFundLimit: '',
    permissions: {}
  })

  const [fundAmount, setFundAmount] = useState('')
  const [fundDescription, setFundDescription] = useState('')
  const [deductAmount, setDeductAmount] = useState('')
  const [deductDescription, setDeductDescription] = useState('')

  // Transfer-users state
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferSourceAdmin, setTransferSourceAdmin] = useState(null)
  const [transferTargetAdminId, setTransferTargetAdminId] = useState('')
  const [transferMode, setTransferMode] = useState('all') // 'all' | 'select'
  const [transferSelectedIds, setTransferSelectedIds] = useState([])
  const [transferring, setTransferring] = useState(false)
  const [transferMsg, setTransferMsg] = useState(null)

  // Add-users-to-branch state
  const [showAddUsersModal, setShowAddUsersModal] = useState(false)
  const [addUsersTargetAdmin, setAddUsersTargetAdmin] = useState(null)
  const [addUsersSearch, setAddUsersSearch] = useState('')
  const [addUsersResults, setAddUsersResults] = useState([])
  const [addUsersSearching, setAddUsersSearching] = useState(false)
  const [addUsersSelectedIds, setAddUsersSelectedIds] = useState([])
  const [addingUsers, setAddingUsers] = useState(false)
  const [addUsersMsg, setAddUsersMsg] = useState(null)

  const allPermissions = [
    { key: 'canManageUsers', label: 'Manage Users', category: 'Users' },
    { key: 'canCreateUsers', label: 'Create Users', category: 'Users' },
    { key: 'canDeleteUsers', label: 'Delete Users', category: 'Users' },
    { key: 'canViewUsers', label: 'View Users', category: 'Users' },
    { key: 'canManageTrades', label: 'Manage Trades', category: 'Trading' },
    { key: 'canCloseTrades', label: 'Close Trades', category: 'Trading' },
    { key: 'canModifyTrades', label: 'Modify Trades', category: 'Trading' },
    { key: 'canManageAccounts', label: 'Manage Accounts', category: 'Accounts' },
    { key: 'canCreateAccounts', label: 'Create Accounts', category: 'Accounts' },
    { key: 'canDeleteAccounts', label: 'Delete Accounts', category: 'Accounts' },
    { key: 'canModifyLeverage', label: 'Modify Leverage', category: 'Accounts' },
    { key: 'canManageDeposits', label: 'Manage Deposits', category: 'Finance' },
    { key: 'canApproveDeposits', label: 'Approve Deposits', category: 'Finance' },
    { key: 'canManageWithdrawals', label: 'Manage Withdrawals', category: 'Finance' },
    { key: 'canApproveWithdrawals', label: 'Approve Withdrawals', category: 'Finance' },
    { key: 'canManageKYC', label: 'Manage KYC', category: 'KYC' },
    { key: 'canApproveKYC', label: 'Approve KYC', category: 'KYC' },
    { key: 'canManageIB', label: 'Manage IB', category: 'IB' },
    { key: 'canApproveIB', label: 'Approve IB', category: 'IB' },
    { key: 'canManageCopyTrading', label: 'Manage Copy Trading', category: 'Copy Trade' },
    { key: 'canApproveMasters', label: 'Approve Masters', category: 'Copy Trade' },
    { key: 'canManageSymbols', label: 'Manage Symbols', category: 'Settings' },
    { key: 'canManageGroups', label: 'Manage Groups', category: 'Settings' },
    { key: 'canManageSettings', label: 'Manage Settings', category: 'Settings' },
    { key: 'canManageTheme', label: 'Manage Theme', category: 'Settings' },
    { key: 'canViewReports', label: 'View Reports', category: 'Reports' },
    { key: 'canExportReports', label: 'Export Reports', category: 'Reports' },
  ]

  useEffect(() => {
    fetchAdmins()
    fetchOverview()
  }, [])

  const fetchAdmins = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/admins`)
      const data = await res.json()
      if (data.success) setAdmins(data.admins || [])
    } catch (error) {
      console.error('Error fetching admins:', error)
    }
    setLoading(false)
  }

  const fetchOverview = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/branch-overview`)
      const data = await res.json()
      if (data.success) setOverviewData(data)
    } catch (error) {
      console.error('Error fetching overview:', error)
    }
  }

  const fetchBranchUsers = async (adminId) => {
    setBranchUsersLoading(true)
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/admins/${adminId}/users`)
      const data = await res.json()
      if (data.success) setBranchUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching branch users:', error)
    }
    setBranchUsersLoading(false)
  }

  // Open the transfer-users modal. Preloads the source branch's users so the
  // super admin can either bulk-move all or pick specific ones.
  const openTransferModal = async (admin) => {
    setTransferSourceAdmin(admin)
    setTransferTargetAdminId('')
    setTransferMode('all')
    setTransferSelectedIds([])
    setTransferMsg(null)
    setShowTransferModal(true)
    fetchBranchUsers(admin._id)
  }

  const handleTransferUsers = async () => {
    if (!transferSourceAdmin || !transferTargetAdminId) {
      setTransferMsg({ type: 'error', text: 'Pick a destination branch' })
      return
    }
    if (transferMode === 'select' && transferSelectedIds.length === 0) {
      setTransferMsg({ type: 'error', text: 'Select at least one user' })
      return
    }
    setTransferring(true)
    setTransferMsg(null)
    try {
      const body = {
        fromAdminId: transferSourceAdmin._id,
        toAdminId: transferTargetAdminId,
        ...(transferMode === 'all' ? { all: true } : { userIds: transferSelectedIds })
      }
      const res = await adminFetch(`${API_URL}/admin-mgmt/admins/transfer-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        setTransferMsg({ type: 'success', text: data.message })
        fetchAdmins()
        setTimeout(() => setShowTransferModal(false), 1200)
      } else {
        setTransferMsg({ type: 'error', text: data.message || 'Transfer failed' })
      }
    } catch (e) {
      setTransferMsg({ type: 'error', text: 'Network error' })
    }
    setTransferring(false)
  }

  // Open the "Add Users" picker for a specific branch.
  const openAddUsersModal = (admin) => {
    setAddUsersTargetAdmin(admin)
    setAddUsersSearch('')
    setAddUsersResults([])
    setAddUsersSelectedIds([])
    setAddUsersMsg(null)
    setShowAddUsersModal(true)
  }

  // Debounced user search (excludes users already in the target branch).
  useEffect(() => {
    if (!showAddUsersModal || !addUsersTargetAdmin) return
    const handle = setTimeout(async () => {
      setAddUsersSearching(true)
      try {
        const params = new URLSearchParams({ q: addUsersSearch, excludeAdminId: addUsersTargetAdmin._id })
        const res = await adminFetch(`${API_URL}/admin-mgmt/searchable-users?${params}`)
        const data = await res.json()
        if (data.success) setAddUsersResults(data.users || [])
      } catch (e) {
        // ignore — user can retry
      }
      setAddUsersSearching(false)
    }, 250)
    return () => clearTimeout(handle)
  }, [addUsersSearch, showAddUsersModal, addUsersTargetAdmin])

  const handleAddUsersToBranch = async () => {
    if (!addUsersTargetAdmin || addUsersSelectedIds.length === 0) {
      setAddUsersMsg({ type: 'error', text: 'Pick at least one user' })
      return
    }
    setAddingUsers(true)
    setAddUsersMsg(null)
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/admins/${addUsersTargetAdmin._id}/add-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: addUsersSelectedIds })
      })
      const data = await res.json()
      if (data.success) {
        setAddUsersMsg({ type: 'success', text: data.message })
        setAddUsersSelectedIds([])
        fetchAdmins()
        // Refresh the search results so newly-added users are filtered out
        const params = new URLSearchParams({ q: addUsersSearch, excludeAdminId: addUsersTargetAdmin._id })
        const r2 = await adminFetch(`${API_URL}/admin-mgmt/searchable-users?${params}`)
        const d2 = await r2.json()
        if (d2.success) setAddUsersResults(d2.users || [])
      } else {
        setAddUsersMsg({ type: 'error', text: data.message || 'Failed' })
      }
    } catch (e) {
      setAddUsersMsg({ type: 'error', text: 'Network error' })
    }
    setAddingUsers(false)
  }

  const handleBackfillBranchCodes = async () => {
    if (!confirm('Assign 5-digit branch codes to any existing branches/users that don\'t have one? Safe to run multiple times.')) return
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/admins/backfill-branch-codes`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert(data.message)
        fetchAdmins()
      } else {
        alert(data.message || 'Backfill failed')
      }
    } catch (e) {
      alert('Network error')
    }
  }

  const handleCreateAdmin = async () => {
    try {
      const payload = { ...newAdmin }
      if (payload.maxFundLimit) payload.maxFundLimit = parseFloat(payload.maxFundLimit)
      const res = await adminFetch(`${API_URL}/admin-mgmt/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.success) {
        alert('Branch created successfully!')
        setShowAddModal(false)
        setNewAdmin({ email: '', password: '', firstName: '', lastName: '', phone: '', urlSlug: '', brandName: '', branchName: '', branchLocation: '', branchAddress: '', branchPhone: '', branchEmail: '', maxFundLimit: '', permissions: {} })
        fetchAdmins()
        fetchOverview()
      } else {
        alert(data.message || 'Failed to create branch')
      }
    } catch (error) {
      alert('Error creating branch')
    }
  }

  const handleUpdateAdmin = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/admins/${selectedAdmin._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: selectedAdmin.firstName,
          lastName: selectedAdmin.lastName,
          phone: selectedAdmin.phone,
          brandName: selectedAdmin.brandName,
          branchName: selectedAdmin.branchName,
          branchLocation: selectedAdmin.branchLocation,
          branchAddress: selectedAdmin.branchAddress,
          branchPhone: selectedAdmin.branchPhone,
          branchEmail: selectedAdmin.branchEmail,
          maxFundLimit: parseFloat(selectedAdmin.maxFundLimit) || 0,
          status: selectedAdmin.status
        })
      })
      const data = await res.json()
      if (data.success) {
        alert('Branch updated successfully!')
        setShowEditModal(false)
        fetchAdmins()
        fetchOverview()
      } else {
        alert(data.message || 'Failed to update')
      }
    } catch (error) {
      alert('Error updating branch')
    }
  }

  const handleUpdatePermissions = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/admins/${selectedAdmin._id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: selectedAdmin.permissions })
      })
      const data = await res.json()
      if (data.success) {
        alert('Permissions updated!')
        setShowPermissionsModal(false)
        fetchAdmins()
      } else {
        alert(data.message || 'Failed to update permissions')
      }
    } catch (error) {
      alert('Error updating permissions')
    }
  }

  const handleFundAdmin = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/wallet/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: selectedAdmin._id, amount: parseFloat(fundAmount), description: fundDescription })
      })
      const data = await res.json()
      if (data.success) {
        alert(data.message)
        setShowFundModal(false)
        setFundAmount('')
        setFundDescription('')
        fetchAdmins()
        fetchOverview()
      } else {
        alert(data.message || 'Failed to fund')
      }
    } catch (error) {
      alert('Error funding admin')
    }
  }

  const handleDeductAdmin = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/wallet/deduct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: selectedAdmin._id, amount: parseFloat(deductAmount), description: deductDescription })
      })
      const data = await res.json()
      if (data.success) {
        alert(data.message)
        setShowDeductModal(false)
        setDeductAmount('')
        setDeductDescription('')
        fetchAdmins()
        fetchOverview()
      } else {
        alert(data.message || 'Failed to deduct')
      }
    } catch (error) {
      alert('Error deducting funds')
    }
  }

  const handleToggleStatus = async (admin) => {
    const newStatus = admin.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/admins/${admin._id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      const data = await res.json()
      if (data.success) { fetchAdmins(); fetchOverview() }
    } catch (error) {
      alert('Error updating status')
    }
  }

  const handleDeleteAdmin = async (admin) => {
    if (!confirm(`Delete branch "${admin.branchName || admin.firstName}"? This cannot be undone.`)) return
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/admins/${admin._id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) { alert('Branch deleted!'); fetchAdmins(); fetchOverview() }
      else alert(data.message || 'Failed to delete')
    } catch (error) {
      alert('Error deleting branch')
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { alert('Password must be at least 6 characters'); return }
    try {
      const res = await adminFetch(`${API_URL}/admin-mgmt/admins/${selectedAdmin._id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      })
      const data = await res.json()
      if (data.success) { alert('Password reset!'); setShowPasswordModal(false); setNewPassword('') }
      else alert(data.message || 'Failed')
    } catch (error) {
      alert('Error resetting password')
    }
  }

  const copyToClipboard = (slug) => {
    const url = `${window.location.origin}/${slug}/login`
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  const filteredAdmins = admins.filter(admin =>
    admin.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.urlSlug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.branchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.branchLocation?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getPermissionCount = (permissions) => {
    if (!permissions) return 0
    return Object.values(permissions).filter(v => v === true).length
  }

  const totals = overviewData?.totals || {}

  return (
    <AdminLayout title="Branch Management" subtitle="Manage branches, permissions, funds and users">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
        {[
          { label: 'Total Branches', value: totals.totalBranches || admins.length, icon: Building2, color: 'blue' },
          { label: 'Active', value: totals.activeBranches || admins.filter(a => a.status === 'ACTIVE').length, icon: Check, color: 'green' },
          { label: 'Total Users', value: totals.totalUsers || admins.reduce((s, a) => s + (a.userCount || 0), 0), icon: Users, color: 'purple' },
          { label: 'Funds Allocated', value: `$${(totals.totalFundsAllocated || admins.reduce((s, a) => s + (a.totalReceived || 0), 0)).toLocaleString()}`, icon: DollarSign, color: 'yellow' },
          { label: 'Wallet Balance', value: `$${(totals.totalWalletBalance || admins.reduce((s, a) => s + (a.walletBalance || 0), 0)).toLocaleString()}`, icon: Wallet, color: 'cyan' },
          { label: 'Accounts', value: totals.totalAccounts || 0, icon: BarChart3, color: 'orange' },
          { label: 'Active Trades', value: totals.totalActiveTrades || 0, icon: TrendingUp, color: 'red' }
        ].map((stat, i) => (
          <div key={i} className="bg-dark-800 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 bg-${stat.color}-500/20 rounded-lg flex items-center justify-center`}>
                <stat.icon size={16} className={`text-${stat.color}-500`} />
              </div>
              <div>
                <p className="text-gray-500 text-xs">{stat.label}</p>
                <p className="text-white text-sm font-bold">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, slug, branch, location..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-dark-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <ReportDownload endpoint="admin-report" title="Export" />
          <button onClick={handleBackfillBranchCodes} className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700" title="Assign 5-digit branch codes to legacy branches/users that don't have one">
            <Hash size={16} /> Backfill Codes
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Plus size={16} /> Add Branch
          </button>
        </div>
      </div>

      {/* Branch Cards */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading branches...</div>
      ) : filteredAdmins.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No branches found</div>
      ) : (
        <div className="space-y-4">
          {filteredAdmins.map(admin => (
            <div key={admin._id} className="bg-dark-800 rounded-xl border border-gray-800 overflow-hidden">
              {/* Branch Header */}
              <div className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Branch Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building2 size={22} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold text-lg">{admin.branchName || `${admin.firstName} ${admin.lastName}`}</h3>
                        {admin.branchCode && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-purple-500/20 text-purple-300">
                            #{admin.branchCode}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${admin.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {admin.status}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">{admin.firstName} {admin.lastName} &middot; {admin.email}</p>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        {admin.branchLocation && (
                          <span className="flex items-center gap-1 text-gray-500 text-xs"><MapPin size={12} /> {admin.branchLocation}</span>
                        )}
                        <span className="flex items-center gap-1 text-gray-500 text-xs">
                          <Globe size={12} />
                          <span className="text-blue-400 cursor-pointer" onClick={() => copyToClipboard(admin.urlSlug)}>
                            /{admin.urlSlug}
                            {copiedSlug === admin.urlSlug ? <Check size={12} className="inline ml-1 text-green-400" /> : <Copy size={12} className="inline ml-1" />}
                          </span>
                        </span>
                        {admin.branchPhone && (
                          <span className="flex items-center gap-1 text-gray-500 text-xs"><Phone size={12} /> {admin.branchPhone}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Stats */}
                  <div className="flex items-center gap-5 flex-wrap">
                    <div className="text-center">
                      <p className="text-white font-bold">{admin.userCount || 0}</p>
                      <p className="text-gray-500 text-xs">Users</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold ${(admin.netDeposit || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                        ${(admin.netDeposit || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-gray-500 text-xs">Net Deposit</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold ${(admin.netPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(admin.netPnl || 0) >= 0 ? '+' : ''}${(admin.netPnl || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-gray-500 text-xs">Net P&L</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold ${(admin.pendingWithdrawals || 0) > 0 ? 'text-orange-400' : 'text-gray-400'}`}>{admin.pendingWithdrawals || 0}</p>
                      <p className="text-gray-500 text-xs">Pending W/D</p>
                    </div>
                    <div className="text-center">
                      <p className="text-green-400 font-bold">${(admin.walletBalance || 0).toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">Balance</p>
                    </div>
                    <div className="text-center">
                      <p className="text-purple-400 font-bold">{getPermissionCount(admin.permissions)}</p>
                      <p className="text-gray-500 text-xs">Perms</p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => { setSelectedAdmin(admin); fetchBranchUsers(admin._id); setShowUsersModal(true) }} className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30" title="View Users">
                      <Users size={16} />
                    </button>
                    <button onClick={() => openAddUsersModal(admin)} className="p-2 bg-teal-500/20 text-teal-400 rounded-lg hover:bg-teal-500/30" title="Add Existing User to This Branch">
                      <UserPlus size={16} />
                    </button>
                    <button onClick={() => openTransferModal(admin)} className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30" title="Transfer Users to Another Branch">
                      <ArrowRightLeft size={16} />
                    </button>
                    <button onClick={() => { setSelectedAdmin(admin); setShowFundModal(true) }} className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30" title="Add Fund">
                      <DollarSign size={16} />
                    </button>
                    <button onClick={() => { setSelectedAdmin(admin); setShowDeductModal(true) }} className="p-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30" title="Deduct Fund">
                      <Wallet size={16} />
                    </button>
                    <button onClick={() => { setSelectedAdmin(admin); setShowPermissionsModal(true) }} className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30" title="Permissions">
                      <Key size={16} />
                    </button>
                    <button onClick={() => { setSelectedAdmin({...admin}); setShowEditModal(true) }} className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30" title="Edit Branch">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => { setSelectedAdmin(admin); setShowPasswordModal(true) }} className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30" title="Reset Password">
                      <Lock size={16} />
                    </button>
                    <button onClick={() => handleToggleStatus(admin)} className={`p-2 rounded-lg ${admin.status === 'ACTIVE' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`} title={admin.status === 'ACTIVE' ? 'Suspend' : 'Activate'}>
                      <Shield size={16} />
                    </button>
                    <button onClick={() => handleDeleteAdmin(admin)} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Expanded: Branch Details */}
                {admin.branchAddress && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-gray-500 text-xs">
                      <span className="text-gray-400">Address:</span> {admin.branchAddress}
                      {admin.branchEmail && <> &middot; <span className="text-gray-400">Email:</span> {admin.branchEmail}</>}
                      {admin.brandName && <> &middot; <span className="text-gray-400">Brand:</span> {admin.brandName}</>}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Add Branch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-dark-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-semibold text-lg">Add New Branch</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Admin Account */}
              <div>
                <p className="text-gray-400 text-sm font-medium mb-3">Admin Account</p>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="First Name *" value={newAdmin.firstName} onChange={e => setNewAdmin({...newAdmin, firstName: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                  <input placeholder="Last Name *" value={newAdmin.lastName} onChange={e => setNewAdmin({...newAdmin, lastName: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                  <input placeholder="Email *" type="email" value={newAdmin.email} onChange={e => setNewAdmin({...newAdmin, email: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                  <input placeholder="Password *" type="password" value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                  <input placeholder="Phone" value={newAdmin.phone} onChange={e => setNewAdmin({...newAdmin, phone: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                </div>
              </div>

              {/* Branch Details */}
              <div>
                <p className="text-gray-400 text-sm font-medium mb-3">Branch Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Branch Name" value={newAdmin.branchName} onChange={e => setNewAdmin({...newAdmin, branchName: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                  <input placeholder="Branch Location (City)" value={newAdmin.branchLocation} onChange={e => setNewAdmin({...newAdmin, branchLocation: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                  <input placeholder="Branch Address" value={newAdmin.branchAddress} onChange={e => setNewAdmin({...newAdmin, branchAddress: e.target.value})} className="col-span-2 px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                  <input placeholder="Branch Phone" value={newAdmin.branchPhone} onChange={e => setNewAdmin({...newAdmin, branchPhone: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                  <input placeholder="Branch Email" value={newAdmin.branchEmail} onChange={e => setNewAdmin({...newAdmin, branchEmail: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                </div>
              </div>

              {/* Branding & Limits */}
              <div>
                <p className="text-gray-400 text-sm font-medium mb-3">Branding & Limits</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input placeholder="URL Slug *" value={newAdmin.urlSlug} onChange={e => setNewAdmin({...newAdmin, urlSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})} className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                    {newAdmin.urlSlug && <p className="text-xs text-gray-500 mt-1">Login URL: {window.location.origin}/{newAdmin.urlSlug}/login</p>}
                  </div>
                  <input placeholder="Brand Name" value={newAdmin.brandName} onChange={e => setNewAdmin({...newAdmin, brandName: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                  <div>
                    <input placeholder="Max Fund Limit ($)" type="number" value={newAdmin.maxFundLimit} onChange={e => setNewAdmin({...newAdmin, maxFundLimit: e.target.value})} className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                    <p className="text-xs text-gray-500 mt-1">0 = unlimited</p>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <p className="text-gray-400 text-sm font-medium mb-3">Feature Access</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allPermissions.map(p => (
                    <label key={p.key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={newAdmin.permissions[p.key] || false} onChange={e => setNewAdmin({...newAdmin, permissions: {...newAdmin.permissions, [p.key]: e.target.checked}})} className="rounded" />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
              <button onClick={handleCreateAdmin} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Create Branch</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {showEditModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-dark-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-semibold">Edit Branch — {selectedAdmin.branchName || selectedAdmin.firstName}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="First Name" value={selectedAdmin.firstName} onChange={e => setSelectedAdmin({...selectedAdmin, firstName: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                <input placeholder="Last Name" value={selectedAdmin.lastName} onChange={e => setSelectedAdmin({...selectedAdmin, lastName: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                <input placeholder="Branch Name" value={selectedAdmin.branchName || ''} onChange={e => setSelectedAdmin({...selectedAdmin, branchName: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                <input placeholder="Branch Location" value={selectedAdmin.branchLocation || ''} onChange={e => setSelectedAdmin({...selectedAdmin, branchLocation: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                <input placeholder="Branch Address" value={selectedAdmin.branchAddress || ''} onChange={e => setSelectedAdmin({...selectedAdmin, branchAddress: e.target.value})} className="col-span-2 px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                <input placeholder="Branch Phone" value={selectedAdmin.branchPhone || ''} onChange={e => setSelectedAdmin({...selectedAdmin, branchPhone: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                <input placeholder="Branch Email" value={selectedAdmin.branchEmail || ''} onChange={e => setSelectedAdmin({...selectedAdmin, branchEmail: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                <input placeholder="Brand Name" value={selectedAdmin.brandName || ''} onChange={e => setSelectedAdmin({...selectedAdmin, brandName: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                <input placeholder="Phone" value={selectedAdmin.phone || ''} onChange={e => setSelectedAdmin({...selectedAdmin, phone: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                <input placeholder="Max Fund Limit ($)" type="number" value={selectedAdmin.maxFundLimit || ''} onChange={e => setSelectedAdmin({...selectedAdmin, maxFundLimit: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
                <select value={selectedAdmin.status} onChange={e => setSelectedAdmin({...selectedAdmin, status: e.target.value})} className="px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm">
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
              <button onClick={handleUpdateAdmin} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Fund Modal */}
      {showFundModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowFundModal(false)}>
          <div className="bg-dark-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-semibold">Add Funds — {selectedAdmin.branchName || selectedAdmin.firstName}</h3>
              <button onClick={() => setShowFundModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Current Balance</span>
                <span className="text-green-400 font-bold">${(selectedAdmin.walletBalance || 0).toLocaleString()}</span>
              </div>
              {selectedAdmin.maxFundLimit > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Fund Limit</span>
                  <span className="text-yellow-400 font-bold">${selectedAdmin.maxFundLimit.toLocaleString()}</span>
                </div>
              )}
              <input type="number" placeholder="Amount ($)" value={fundAmount} onChange={e => setFundAmount(e.target.value)} className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
              <input type="text" placeholder="Description (optional)" value={fundDescription} onChange={e => setFundDescription(e.target.value)} className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowFundModal(false)} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
              <button onClick={handleFundAdmin} className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Add Funds</button>
            </div>
          </div>
        </div>
      )}

      {/* Deduct Fund Modal */}
      {showDeductModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowDeductModal(false)}>
          <div className="bg-dark-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-semibold">Deduct Funds — {selectedAdmin.branchName || selectedAdmin.firstName}</h3>
              <button onClick={() => setShowDeductModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Current Balance</span>
                <span className="text-green-400 font-bold">${(selectedAdmin.walletBalance || 0).toLocaleString()}</span>
              </div>
              <input type="number" placeholder="Amount to deduct ($)" value={deductAmount} onChange={e => setDeductAmount(e.target.value)} className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
              <input type="text" placeholder="Reason" value={deductDescription} onChange={e => setDeductDescription(e.target.value)} className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowDeductModal(false)} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
              <button onClick={handleDeductAdmin} className="px-6 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">Deduct</button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPermissionsModal(false)}>
          <div className="bg-dark-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-semibold">Feature Access — {selectedAdmin.branchName || selectedAdmin.firstName}</h3>
              <button onClick={() => setShowPermissionsModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5">
              {['Users', 'Trading', 'Accounts', 'Finance', 'KYC', 'IB', 'Copy Trade', 'Settings', 'Reports'].map(cat => (
                <div key={cat} className="mb-4">
                  <p className="text-gray-400 text-xs font-semibold uppercase mb-2">{cat}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {allPermissions.filter(p => p.category === cat).map(p => (
                      <label key={p.key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={selectedAdmin.permissions?.[p.key] || false} onChange={e => setSelectedAdmin({...selectedAdmin, permissions: {...selectedAdmin.permissions, [p.key]: e.target.checked}})} className="rounded" />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowPermissionsModal(false)} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
              <button onClick={handleUpdatePermissions} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save Permissions</button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPasswordModal(false)}>
          <div className="bg-dark-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-semibold">Reset Password — {selectedAdmin.firstName}</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <AlertCircle size={16} className="text-yellow-500 mt-0.5" />
                <p className="text-yellow-300 text-sm">This will immediately change the password for {selectedAdmin.email}</p>
              </div>
              <input type="password" placeholder="New Password (min 6 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm" />
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
              <button onClick={handleResetPassword} className="px-6 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700">Reset Password</button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Users Modal */}
      {showUsersModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowUsersModal(false)}>
          <div className="bg-dark-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div>
                <h3 className="text-white font-semibold">Branch Users — {selectedAdmin.branchName || selectedAdmin.firstName}</h3>
                <p className="text-gray-500 text-sm">{selectedAdmin.branchLocation && `${selectedAdmin.branchLocation} · `}{selectedAdmin.urlSlug}</p>
              </div>
              <button onClick={() => setShowUsersModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5">
              {branchUsersLoading ? (
                <div className="text-center py-10 text-gray-500">Loading users...</div>
              ) : branchUsers.length === 0 ? (
                <div className="text-center py-10 text-gray-500">No users in this branch yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                        <th className="text-left py-3 px-3">User</th>
                        <th className="text-left py-3 px-3">Email</th>
                        <th className="text-left py-3 px-3">Phone</th>
                        <th className="text-left py-3 px-3">Wallet</th>
                        <th className="text-left py-3 px-3">KYC</th>
                        <th className="text-left py-3 px-3">Status</th>
                        <th className="text-left py-3 px-3">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branchUsers.map(user => (
                        <tr key={user._id} className="border-b border-gray-800/50 hover:bg-dark-700/50">
                          <td className="py-3 px-3 text-white">{user.firstName} {user.lastName || ''}</td>
                          <td className="py-3 px-3 text-gray-400">{user.email}</td>
                          <td className="py-3 px-3 text-gray-400">{user.phone || '-'}</td>
                          <td className="py-3 px-3 text-green-400">${(user.walletBalance || 0).toFixed(2)}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${user.kycApproved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                              {user.kycApproved ? 'Verified' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${user.isBlocked ? 'bg-red-500/20 text-red-400' : user.isBanned ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                              {user.isBanned ? 'Banned' : user.isBlocked ? 'Blocked' : 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Users Modal */}
      {showTransferModal && transferSourceAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h2 className="text-white font-semibold">Transfer Users</h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  From: <span className="text-white">{transferSourceAdmin.branchName || `${transferSourceAdmin.firstName} ${transferSourceAdmin.lastName}`}</span>
                  {transferSourceAdmin.branchCode && <span className="text-purple-300 ml-1">#{transferSourceAdmin.branchCode}</span>}
                </p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4">
              {transferMsg && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${transferMsg.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {transferMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  {transferMsg.text}
                </div>
              )}

              <div>
                <label className="block text-gray-400 text-xs mb-1">Destination Branch</label>
                <select
                  value={transferTargetAdminId}
                  onChange={(e) => setTransferTargetAdminId(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                >
                  <option value="">Select a branch…</option>
                  {admins
                    .filter(a => a._id !== transferSourceAdmin._id)
                    .map(a => (
                      <option key={a._id} value={a._id}>
                        {a.branchName || `${a.firstName} ${a.lastName}`} {a.branchCode ? `(#${a.branchCode})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-2">What to transfer</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTransferMode('all')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm border ${transferMode === 'all' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'bg-dark-700 text-gray-400 border-gray-700'}`}
                  >
                    All {branchUsers.length || ''} user{branchUsers.length === 1 ? '' : 's'}
                  </button>
                  <button
                    onClick={() => setTransferMode('select')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm border ${transferMode === 'select' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'bg-dark-700 text-gray-400 border-gray-700'}`}
                  >
                    Pick specific users
                  </button>
                </div>
              </div>

              {transferMode === 'select' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-gray-400 text-xs">Select users to transfer</label>
                    <button
                      onClick={() => setTransferSelectedIds(branchUsers.map(u => u._id))}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Select all
                    </button>
                  </div>
                  <div className="bg-dark-700 border border-gray-700 rounded-lg max-h-72 overflow-y-auto">
                    {branchUsersLoading ? (
                      <div className="p-4 text-center text-gray-500 text-sm">Loading users…</div>
                    ) : branchUsers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">No users in this branch</div>
                    ) : (
                      branchUsers.map(u => {
                        const checked = transferSelectedIds.includes(u._id)
                        return (
                          <label key={u._id} className={`flex items-center gap-3 px-3 py-2 border-b border-gray-800 last:border-b-0 cursor-pointer hover:bg-dark-600 ${checked ? 'bg-indigo-500/10' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setTransferSelectedIds(prev => prev.includes(u._id) ? prev.filter(id => id !== u._id) : [...prev, u._id])}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{u.firstName} {u.lastName || ''}</p>
                              <p className="text-gray-500 text-xs truncate">{u.email}</p>
                            </div>
                            {u.branchCode && (
                              <span className="text-xs font-mono text-purple-300">#{u.branchCode}</span>
                            )}
                          </label>
                        )
                      })
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-2">{transferSelectedIds.length} selected</p>
                </div>
              )}

              <div className="bg-dark-700/50 border border-gray-700 rounded-lg p-3 text-xs text-gray-400">
                Transferred users will get the destination branch's 5-digit code stamped on their profile, and any pending withdrawals will move to the new branch admin's queue. Closed transaction history stays on the original branch for audit.
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-700">
              <button onClick={() => setShowTransferModal(false)} className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={handleTransferUsers} disabled={transferring} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                <ArrowRightLeft size={14} />
                {transferring ? 'Transferring…' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Users to Branch Modal */}
      {showAddUsersModal && addUsersTargetAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h2 className="text-white font-semibold">Add Users to Branch</h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  Target: <span className="text-white">{addUsersTargetAdmin.branchName || `${addUsersTargetAdmin.firstName} ${addUsersTargetAdmin.lastName}`}</span>
                  {addUsersTargetAdmin.branchCode && <span className="text-purple-300 ml-1">#{addUsersTargetAdmin.branchCode}</span>}
                </p>
              </div>
              <button onClick={() => setShowAddUsersModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4">
              {addUsersMsg && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${addUsersMsg.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {addUsersMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  {addUsersMsg.text}
                </div>
              )}

              <div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search by name, email, phone, or branch code…"
                    value={addUsersSearch}
                    onChange={(e) => setAddUsersSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-dark-700 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Shows users from any other branch + unassigned users. Users already in this branch are filtered out.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-xs">{addUsersResults.length} result{addUsersResults.length === 1 ? '' : 's'}</p>
                {addUsersResults.length > 0 && (
                  <button
                    onClick={() => setAddUsersSelectedIds(addUsersResults.map(u => u._id))}
                    className="text-xs text-teal-400 hover:text-teal-300"
                  >
                    Select all
                  </button>
                )}
              </div>

              <div className="bg-dark-700 border border-gray-700 rounded-lg max-h-80 overflow-y-auto">
                {addUsersSearching ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Searching…</div>
                ) : addUsersResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {addUsersSearch ? 'No matching users' : 'Type to search for users'}
                  </div>
                ) : (
                  addUsersResults.map(u => {
                    const checked = addUsersSelectedIds.includes(u._id)
                    const currentBranch = u.assignedAdmin
                      ? (u.assignedAdmin.branchName || `${u.assignedAdmin.firstName || ''} ${u.assignedAdmin.lastName || ''}`.trim())
                      : null
                    return (
                      <label key={u._id} className={`flex items-center gap-3 px-3 py-2 border-b border-gray-800 last:border-b-0 cursor-pointer hover:bg-dark-600 ${checked ? 'bg-teal-500/10' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setAddUsersSelectedIds(prev => prev.includes(u._id) ? prev.filter(id => id !== u._id) : [...prev, u._id])}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{u.firstName} {u.lastName || ''}</p>
                          <p className="text-gray-500 text-xs truncate">{u.email}</p>
                        </div>
                        <div className="text-right">
                          {currentBranch ? (
                            <p className="text-gray-400 text-xs">
                              In: <span className="text-gray-300">{currentBranch}</span>
                              {u.assignedAdmin?.branchCode && <span className="text-purple-300 ml-1">#{u.assignedAdmin.branchCode}</span>}
                            </p>
                          ) : (
                            <p className="text-orange-400 text-xs">Unassigned</p>
                          )}
                        </div>
                      </label>
                    )
                  })
                )}
              </div>

              <div className="bg-dark-700/50 border border-gray-700 rounded-lg p-3 text-xs text-gray-400">
                Selected users will be re-assigned to this branch. Their branch code will update; closed transaction history stays where it was for audit.
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-700">
              <button onClick={() => setShowAddUsersModal(false)} className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm">Close</button>
              <button onClick={handleAddUsersToBranch} disabled={addingUsers || addUsersSelectedIds.length === 0} className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                <UserPlus size={14} />
                {addingUsers ? 'Adding…' : `Add ${addUsersSelectedIds.length || ''} user${addUsersSelectedIds.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdminManagement
