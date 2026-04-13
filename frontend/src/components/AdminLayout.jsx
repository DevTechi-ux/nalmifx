import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  LogOut,
  TrendingUp,
  Wallet,
  Building2,
  UserCog,
  DollarSign,
  IndianRupee,
  Copy,
  Trophy,
  CreditCard,
  Shield,
  FileCheck,
  HeadphonesIcon,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Palette,
  Mail,
  Gift,
  Image,
  UserCircle
} from 'lucide-react'
import logoImage from '../assets/nalmifx.png'
import { API_URL } from '../config/api'

const AdminLayout = ({ children, title, subtitle }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState({})
  const [pendingCounts, setPendingCounts] = useState({
    funds: 0, kyc: 0, ib: 0, copyTrade: 0, support: 0, bankRequests: 0, propFirm: 0
  })

  const fetchPendingCounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/pending-counts`)
      const data = await res.json()
      if (data.success) setPendingCounts(data.counts)
    } catch (e) {
      // silently fail — badges just won't show
    }
  }, [])

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken')
    if (!adminToken) {
      navigate('/admin')
      return
    }
    fetchPendingCounts()
    const interval = setInterval(fetchPendingCounts, 30000)
    return () => clearInterval(interval)
  }, [navigate, fetchPendingCounts])

  const menuItems = [
    { name: 'Overview Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { name: 'User Management', icon: Users, path: '/admin/users' },
    { name: 'Trade Management', icon: TrendingUp, path: '/admin/trades' },
    { name: 'Fund Management', icon: Wallet, path: '/admin/funds', badge: pendingCounts.funds },
    { name: 'Bank Settings', icon: Building2, path: '/admin/bank-settings', badge: pendingCounts.bankRequests },
    { name: 'IB Management', icon: UserCog, path: '/admin/ib-management', badge: pendingCounts.ib },
    { name: 'Forex Charges', icon: DollarSign, path: '/admin/forex-charges' },
    { name: 'Earnings Report', icon: TrendingUp, path: '/admin/earnings' },
    { name: 'Copy Trade Management', icon: Copy, path: '/admin/copy-trade', badge: pendingCounts.copyTrade },
    { name: 'Prop Firm Challenges', icon: Trophy, path: '/admin/prop-firm', badge: pendingCounts.propFirm },
    { name: 'Account Types', icon: CreditCard, path: '/admin/account-types' },
    { name: 'Theme Settings', icon: Palette, path: '/admin/theme' },
    { name: 'Email Templates', icon: Mail, path: '/admin/email-templates' },
    { name: 'Bonus Management', icon: Gift, path: '/admin/bonus-management' },
    { name: 'Banner Management', icon: Image, path: '/admin/banners' },
    { name: 'Admin Management', icon: Shield, path: '/admin/admin-management' },
    { name: 'KYC Verification', icon: FileCheck, path: '/admin/kyc', badge: pendingCounts.kyc },
    { name: 'Support Tickets', icon: HeadphonesIcon, path: '/admin/support', badge: pendingCounts.support },
  ]

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    navigate('/admin')
  }

  const isActive = (path) => location.pathname === path

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          ${sidebarExpanded ? 'w-64' : 'w-16'} 
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          bg-dark-900 border-r border-gray-800 flex flex-col 
          transition-all duration-300 ease-in-out
        `}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="NalmiFX" className="h-8 w-auto object-contain flex-shrink-0" />
            {sidebarExpanded && <span className="text-white font-semibold">NalmiFX Admin</span>}
          </div>
          <button 
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="hidden lg:block p-1 hover:bg-dark-700 rounded transition-colors"
          >
            <Menu size={18} className="text-gray-400" />
          </button>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 hover:bg-dark-700 rounded transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                navigate(item.path)
                setMobileMenuOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                isActive(item.path)
                  ? 'bg-red-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              }`}
              title={!sidebarExpanded ? item.name : ''}
            >
              <div className="relative flex-shrink-0">
                <item.icon size={18} />
                {!sidebarExpanded && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              {sidebarExpanded && (
                <>
                  <span className="text-sm font-medium whitespace-nowrap truncate flex-1 text-left">{item.name}</span>
                  {item.badge > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* My Account & Logout */}
        <div className="p-2 border-t border-gray-800 space-y-1">
          <button 
            onClick={() => { navigate('/admin/my-account'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors rounded-lg ${
              isActive('/admin/my-account')
                ? 'bg-red-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
            title={!sidebarExpanded ? 'My Account' : ''}
          >
            <UserCircle size={18} className="flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm font-medium whitespace-nowrap">My Account</span>}
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-white hover:bg-dark-700 transition-colors rounded-lg"
            title={!sidebarExpanded ? 'Log Out' : ''}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarExpanded && <span className="text-sm font-medium whitespace-nowrap">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-dark-900/95 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-dark-700 rounded-lg transition-colors"
            >
              <Menu size={20} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-white">{title || 'Admin Dashboard'}</h1>
              {subtitle && <p className="text-gray-500 text-sm hidden sm:block">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-500 rounded-full text-xs sm:text-sm">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            <span className="hidden sm:inline">Admin Mode</span>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default AdminLayout
