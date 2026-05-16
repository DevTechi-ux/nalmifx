import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import adminFetch from '../utils/adminFetch.js'
import AdminLayout from '../components/AdminLayout'
import {
  Users,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  RefreshCw,
  Calendar,
  BarChart2,
  ArrowDownCircle,
  ArrowUpCircle,
  Activity
} from 'lucide-react'
import { API_URL } from '../config/api'

const AdminOverview = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    netDeposit: 0,
    netPnl: 0,
    pendingKYC: 0,
    pendingWithdrawals: 0,
    activeTrades: 0
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersResponse, statsResponse] = await Promise.all([
        adminFetch(`${API_URL}/admin/users`),
        adminFetch(`${API_URL}/admin/dashboard-stats`)
      ])

      if (usersResponse.ok) {
        const data = await usersResponse.json()
        setUsers(data.users || [])
      }

      if (statsResponse.ok) {
        const data = await statsResponse.json()
        if (data.success) {
          setStats({
            totalUsers: data.stats.totalUsers || 0,
            totalDeposits: data.stats.totalDeposits || 0,
            totalWithdrawals: data.stats.totalWithdrawals || 0,
            netDeposit: data.stats.netDeposit || 0,
            netPnl: data.stats.netPnl || 0,
            pendingKYC: data.stats.pendingKYC || 0,
            pendingWithdrawals: data.stats.pendingWithdrawals || 0,
            activeTrades: data.stats.activeTrades || 0
          })
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
    setLoading(false)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (value) => {
    const abs = Math.abs(value)
    const formatted = abs >= 1000
      ? `$${(abs / 1000).toFixed(1)}k`
      : `$${abs.toFixed(2)}`
    return value < 0 ? `-${formatted}` : formatted
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      color: 'blue',
      route: '/admin/users',
      sub: `${stats.pendingKYC} pending KYC`
    },
    {
      title: 'Open Trades',
      value: stats.activeTrades.toLocaleString(),
      icon: Activity,
      color: 'green',
      route: '/admin/trades',
      sub: 'Live positions'
    },
    {
      title: 'Net Deposit',
      value: formatCurrency(stats.netDeposit),
      icon: stats.netDeposit >= 0 ? ArrowDownCircle : ArrowUpCircle,
      color: stats.netDeposit >= 0 ? 'purple' : 'red',
      route: '/admin/transactions',
      sub: `$${stats.totalDeposits.toLocaleString()} in / $${stats.totalWithdrawals.toLocaleString()} out`
    },
    {
      title: 'Net P&L',
      value: formatCurrency(stats.netPnl),
      icon: stats.netPnl >= 0 ? TrendingUp : TrendingDown,
      color: stats.netPnl >= 0 ? 'green' : 'red',
      route: '/admin/trades',
      sub: 'All closed trades'
    },
    {
      title: 'Total Deposits',
      value: formatCurrency(stats.totalDeposits),
      icon: Wallet,
      color: 'purple',
      route: '/admin/transactions?filter=deposits',
      sub: 'Approved deposits'
    },
    {
      title: 'Total Withdrawals',
      value: formatCurrency(stats.totalWithdrawals),
      icon: CreditCard,
      color: 'orange',
      route: '/admin/transactions?filter=withdrawals',
      sub: 'Approved withdrawals'
    },
    {
      title: 'Pending Withdrawals',
      value: stats.pendingWithdrawals.toLocaleString(),
      icon: ArrowUpCircle,
      color: 'yellow',
      route: '/admin/funds',
      sub: 'Awaiting approval'
    },
    {
      title: 'Pending KYC',
      value: stats.pendingKYC.toLocaleString(),
      icon: Calendar,
      color: 'yellow',
      route: '/admin/kyc',
      sub: 'Awaiting review'
    },
  ]

  const colorMap = {
    blue:   { bg: 'bg-blue-500/20',   text: 'text-blue-400' },
    green:  { bg: 'bg-green-500/20',  text: 'text-green-400' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    orange: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
    yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    red:    { bg: 'bg-red-500/20',    text: 'text-red-400' },
  }

  return (
    <AdminLayout title="Overview Dashboard" subtitle="Welcome back, Admin">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, index) => {
          const c = colorMap[stat.color] || colorMap.blue
          return (
            <div
              key={index}
              onClick={() => navigate(stat.route)}
              className="bg-dark-800 rounded-xl p-5 border border-gray-800 cursor-pointer hover:border-gray-600 hover:bg-dark-700 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center`}>
                  <stat.icon size={20} className={c.text} />
                </div>
                <BarChart2 size={14} className="text-gray-700 group-hover:text-gray-500 transition-colors" />
              </div>
              <p className="text-gray-500 text-sm mb-1">{stat.title}</p>
              <p className={`text-2xl font-bold ${stat.title === 'Net P&L' ? (stats.netPnl >= 0 ? 'text-green-400' : 'text-red-400') : stat.title === 'Net Deposit' ? (stats.netDeposit >= 0 ? 'text-white' : 'text-red-400') : 'text-white'}`}>
                {loading ? '—' : stat.value}
              </p>
              {stat.sub && (
                <p className="text-gray-600 text-xs mt-1">{stat.sub}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Recent Users</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/admin/users')}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View all
              </button>
              <button
                onClick={fetchData}
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <RefreshCw size={16} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw size={20} className="text-gray-500 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No users registered yet</p>
            ) : (
              users.slice(0, 5).map((user, index) => (
                <div
                  key={index}
                  onClick={() => navigate('/admin/users')}
                  className="flex items-center justify-between p-3 bg-dark-700 rounded-lg cursor-pointer hover:bg-dark-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent-green/20 rounded-full flex items-center justify-center">
                      <span className="text-accent-green font-medium">
                        {user.firstName?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{user.firstName || 'Unknown'}</p>
                      <p className="text-gray-500 text-sm">{user.email}</p>
                    </div>
                  </div>
                  <span className="text-gray-500 text-sm">{formatDate(user.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Platform Overview */}
        <div className="bg-dark-800 rounded-xl p-5 border border-gray-800">
          <h2 className="text-white font-semibold mb-4">Platform Overview</h2>
          <div className="space-y-3">
            {[
              { label: 'Open Trades', value: stats.activeTrades, icon: Activity, color: 'green', route: '/admin/trades' },
              { label: 'Pending KYC', value: stats.pendingKYC, icon: Calendar, color: 'yellow', route: '/admin/kyc' },
              { label: 'Pending Withdrawals', value: stats.pendingWithdrawals, icon: ArrowUpCircle, color: 'orange', route: '/admin/funds' },
              { label: 'Net P&L (All Time)', value: formatCurrency(stats.netPnl), icon: stats.netPnl >= 0 ? TrendingUp : TrendingDown, color: stats.netPnl >= 0 ? 'green' : 'red', route: '/admin/trades' },
            ].map((item, i) => {
              const c = colorMap[item.color] || colorMap.blue
              return (
                <div
                  key={i}
                  onClick={() => navigate(item.route)}
                  className="flex items-center justify-between p-3 bg-dark-700 rounded-lg cursor-pointer hover:bg-dark-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center`}>
                      <item.icon size={18} className={c.text} />
                    </div>
                    <span className="text-gray-400">{item.label}</span>
                  </div>
                  <span className={`font-semibold ${item.label.includes('P&L') ? (stats.netPnl >= 0 ? 'text-green-400' : 'text-red-400') : 'text-white'}`}>
                    {loading ? '—' : item.value}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminOverview
