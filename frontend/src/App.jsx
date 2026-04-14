import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import MobileTradingApp from './pages/MobileTradingApp'
import Account from './pages/Account'
import WalletPage from './pages/WalletPage'
import OrderBook from './pages/OrderBook'
import TradingPage from './pages/TradingPage'
import CopyTradePage from './pages/CopyTradePage'
import IBPage from './pages/IBPage'
import ProfilePage from './pages/ProfilePage'
import SupportPage from './pages/SupportPage'
import InstructionsPage from './pages/InstructionsPage'
import AdminLogin from './pages/AdminLogin'
import AdminOverview from './pages/AdminOverview'
import AdminUserManagement from './pages/AdminUserManagement'
import AdminAccounts from './pages/AdminAccounts'
import AdminAccountTypes from './pages/AdminAccountTypes'
import AdminTransactions from './pages/AdminTransactions'
import AdminPaymentMethods from './pages/AdminPaymentMethods'
import AdminTradeManagement from './pages/AdminTradeManagement'
import AdminFundManagement from './pages/AdminFundManagement'
import AdminBankSettings from './pages/AdminBankSettings'
import AdminIBManagement from './pages/AdminIBManagement'
import AdminForexCharges from './pages/AdminForexCharges'
import AdminIndianCharges from './pages/AdminIndianCharges'
import AdminCopyTrade from './pages/AdminCopyTrade'
import AdminPropFirm from './pages/AdminPropFirm'
import AdminManagement from './pages/AdminManagement'
import AdminKYC from './pages/AdminKYC'
import AdminSupport from './pages/AdminSupport'
import BuyChallengePage from './pages/BuyChallengePage'
import ChallengeDashboardPage from './pages/ChallengeDashboardPage'
import AdminPropTrading from './pages/AdminPropTrading'
import AdminEarnings from './pages/AdminEarnings'
import ForgotPassword from './pages/ForgotPassword'
import AdminThemeSettings from './pages/AdminThemeSettings'
import BrandedLogin from './pages/BrandedLogin'
import BrandedSignup from './pages/BrandedSignup'
import AdminEmailTemplates from './pages/AdminEmailTemplates'
import AdminBonusManagement from './pages/AdminBonusManagement'
import AdminBannerManagement from './pages/AdminBannerManagement'
import AdminMyAccount from './pages/AdminMyAccount'
import LandingPage from './pages/LandingPage'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import DataDeletion from './pages/DataDeletion'

// Guard: blocks a route if the admin doesn't have the required permission.
// superOnly=true means SUPER_ADMIN only.
function AdminGuard({ children, permKey, superOnly }) {
  const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}')
  const isSuperAdmin = adminUser?.role === 'SUPER_ADMIN'
  const perms = adminUser?.permissions || {}

  if (superOnly && !isSuperAdmin) return <Navigate to="/admin/dashboard" replace />
  if (permKey && !isSuperAdmin && !perms[permKey]) return <Navigate to="/admin/dashboard" replace />
  return children
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Navigate to="/user/login" replace />} />
        <Route path="/signup" element={<Navigate to="/user/signup" replace />} />
        <Route path="/user/signup" element={<Signup />} />
        <Route path="/user/login" element={<Login />} />
        <Route path="/user/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/mobile" element={<MobileTradingApp />} />
        <Route path="/account" element={<Account />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/orders" element={<OrderBook />} />
        <Route path="/trade/:accountId" element={<TradingPage />} />
        <Route path="/copytrade" element={<CopyTradePage />} />
        <Route path="/ib" element={<IBPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/instructions" element={<InstructionsPage />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminOverview />} />
        <Route path="/admin/users" element={<AdminGuard permKey="canManageUsers"><AdminUserManagement /></AdminGuard>} />
        <Route path="/admin/accounts" element={<AdminGuard permKey="canManageAccounts"><AdminAccounts /></AdminGuard>} />
        <Route path="/admin/account-types" element={<AdminGuard permKey="canManageAccounts"><AdminAccountTypes /></AdminGuard>} />
        <Route path="/admin/transactions" element={<AdminGuard permKey="canManageDeposits"><AdminTransactions /></AdminGuard>} />
        <Route path="/admin/payment-methods" element={<AdminGuard permKey="canManageDeposits"><AdminPaymentMethods /></AdminGuard>} />
        <Route path="/admin/trades" element={<AdminGuard permKey="canManageTrades"><AdminTradeManagement /></AdminGuard>} />
        <Route path="/admin/funds" element={<AdminGuard permKey="canManageDeposits"><AdminFundManagement /></AdminGuard>} />
        <Route path="/admin/bank-settings" element={<AdminGuard permKey="canManageDeposits"><AdminBankSettings /></AdminGuard>} />
        <Route path="/admin/ib-management" element={<AdminGuard permKey="canManageIB"><AdminIBManagement /></AdminGuard>} />
        <Route path="/admin/forex-charges" element={<AdminGuard permKey="canManageSymbols"><AdminForexCharges /></AdminGuard>} />
        <Route path="/admin/indian-charges" element={<AdminGuard permKey="canManageSymbols"><AdminIndianCharges /></AdminGuard>} />
        <Route path="/admin/copy-trade" element={<AdminGuard permKey="canManageCopyTrading"><AdminCopyTrade /></AdminGuard>} />
        <Route path="/admin/prop-firm" element={<AdminGuard permKey="canManageTrades"><AdminPropFirm /></AdminGuard>} />
        <Route path="/admin/admin-management" element={<AdminGuard superOnly={true}><AdminManagement /></AdminGuard>} />
        <Route path="/admin/kyc" element={<AdminGuard permKey="canManageKYC"><AdminKYC /></AdminGuard>} />
        <Route path="/admin/support" element={<AdminSupport />} />
        <Route path="/admin/prop-trading" element={<AdminGuard permKey="canManageTrades"><AdminPropTrading /></AdminGuard>} />
        <Route path="/admin/earnings" element={<AdminGuard permKey="canViewReports"><AdminEarnings /></AdminGuard>} />
        <Route path="/admin/theme" element={<AdminGuard permKey="canManageTheme"><AdminThemeSettings /></AdminGuard>} />
        <Route path="/admin/email-templates" element={<AdminGuard permKey="canManageSettings"><AdminEmailTemplates /></AdminGuard>} />
        <Route path="/admin/bonus-management" element={<AdminGuard permKey="canManageSettings"><AdminBonusManagement /></AdminGuard>} />
        <Route path="/admin/banners" element={<AdminGuard permKey="canManageTheme"><AdminBannerManagement /></AdminGuard>} />
        <Route path="/admin/my-account" element={<AdminMyAccount />} />
        <Route path="/buy-challenge" element={<BuyChallengePage />} />
        <Route path="/challenge-dashboard" element={<ChallengeDashboardPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
        <Route path="/:slug/login" element={<BrandedLogin />} />
        <Route path="/:slug/signup" element={<BrandedSignup />} />
        <Route path="/:slug/admin" element={<AdminLogin />} />
      </Routes>
    </Router>
  )
}

export default App
