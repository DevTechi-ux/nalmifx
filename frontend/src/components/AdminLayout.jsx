import { useState, useEffect, useCallback } from 'react'
import adminFetch from '../utils/adminFetch.js'
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

  // Route-space detection: /admin/* is super admin, /<slug>/* is sub-admin.
  // We read from separate localStorage keys so both sessions can coexist.
  const firstSeg = location.pathname.split('/')[1] || ''
  const isAdminSpace = firstSeg === 'admin'
  const isBranchSpace = !isAdminSpace && firstSeg !== ''
  const storageKey = isBranchSpace ? 'branchUser' : 'adminUser'
  const tokenKey = isBranchSpace ? 'branchToken' : 'adminToken'
  const basePath = isAdminSpace ? '/admin' : `/${firstSeg}`

  const adminUser = JSON.parse(localStorage.getItem(storageKey) || '{}')
  const isSuperAdmin = adminUser?.role === 'SUPER_ADMIN'
  const perms = adminUser?.permissions || {}

  // Check if the admin has a specific permission (super admin always passes)
  const can = (permissionKey) => isSuperAdmin || !!perms[permissionKey]

  const fetchPendingCounts = useCallback(async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin/pending-counts`)
      const data = await res.json()
      if (data.success) setPendingCounts(data.counts)
    } catch (e) {
      // silently fail — badges just won't show
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem(tokenKey)
    if (!token) {
      navigate(isBranchSpace ? `/${firstSeg}/admin` : '/admin')
      return
    }
    fetchPendingCounts()
    const interval = setInterval(fetchPendingCounts, 30000)
    return () => clearInterval(interval)
  }, [navigate, fetchPendingCounts, tokenKey, isBranchSpace, firstSeg])

  // All possible menu items with their required permission key.
  // Paths use `basePath` so sub-admins see /branch/* and super admin sees /admin/*.
  // Items with permKey: null are always visible to any authenticated admin.
  // Items with superOnly: true are only visible to SUPER_ADMIN.
  const allMenuItems = [
    { name: 'Overview Dashboard',    icon: LayoutDashboard, path: `${basePath}/dashboard`,        permKey: null },
    { name: 'User Management',       icon: Users,           path: `${basePath}/users`,             permKey: 'canManageUsers' },
    { name: 'Trade Management',      icon: TrendingUp,      path: `${basePath}/trades`,            permKey: 'canManageTrades' },
    { name: 'Fund Management',       icon: Wallet,          path: `${basePath}/funds`,             permKey: 'canManageDeposits', badge: pendingCounts.funds },
    { name: 'Bank Settings',         icon: Building2,       path: `${basePath}/bank-settings`,     permKey: 'canManageDeposits', badge: pendingCounts.bankRequests },
    { name: 'IB Management',         icon: UserCog,         path: `${basePath}/ib-management`,     permKey: 'canManageIB', badge: pendingCounts.ib },
    { name: 'Forex Charges',         icon: DollarSign,      path: `${basePath}/forex-charges`,     permKey: 'canManageSymbols' },
    { name: 'Earnings Report',       icon: TrendingUp,      path: `${basePath}/earnings`,          permKey: 'canViewReports' },
    { name: 'Copy Trade Management', icon: Copy,            path: `${basePath}/copy-trade`,        permKey: 'canManageCopyTrading', badge: pendingCounts.copyTrade },
    { name: 'Prop Firm Challenges',  icon: Trophy,          path: `${basePath}/prop-firm`,         permKey: 'canManageTrades', badge: pendingCounts.propFirm },
    { name: 'Account Types',         icon: CreditCard,      path: `${basePath}/account-types`,     permKey: 'canManageAccounts' },
    { name: 'Theme Settings',        icon: Palette,         path: `${basePath}/theme`,             permKey: 'canManageTheme' },
    { name: 'Email Templates',       icon: Mail,            path: `${basePath}/email-templates`,   permKey: 'canManageSettings' },
    { name: 'Bonus Management',      icon: Gift,            path: `${basePath}/bonus-management`,  permKey: 'canManageSettings' },
    { name: 'Banner Management',     icon: Image,           path: `${basePath}/banners`,           permKey: 'canManageTheme' },
    { name: 'Employee Management',   icon: Shield,          path: `${basePath}/admin-management`,  superOnly: true },
    { name: 'KYC Verification',      icon: FileCheck,       path: `${basePath}/kyc`,               permKey: 'canManageKYC', badge: pendingCounts.kyc },
    { name: 'Support Tickets',       icon: HeadphonesIcon,  path: `${basePath}/support`,           permKey: null, badge: pendingCounts.support },
  ]

  // Filter menu based on role / permissions
  const menuItems = allMenuItems.filter(item => {
    if (item.superOnly) return isSuperAdmin
    if (item.permKey === null) return true // always visible
    return can(item.permKey)
  })

  const handleLogout = () => {
    localStorage.removeItem(tokenKey)
    localStorage.removeItem(storageKey)
    navigate(isBranchSpace ? `/${firstSeg}/admin` : '/admin')
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
            onClick={() => { navigate(`${basePath}/my-account`); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors rounded-lg ${
              isActive(`${basePath}/my-account`)
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
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-sm ${isSuperAdmin ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-400'}`}>
            <span className={`w-2 h-2 rounded-full ${isSuperAdmin ? 'bg-red-500' : 'bg-yellow-400'}`}></span>
            <span className="hidden sm:inline">{isSuperAdmin ? 'Super Admin' : 'Branch Admin'}</span>
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
