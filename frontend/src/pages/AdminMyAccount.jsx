import { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import { 
  User,
  Mail,
  Lock,
  Save,
  Eye,
  EyeOff,
  Shield,
  CheckCircle
} from 'lucide-react'
import { API_URL } from '../config/api'

const AdminMyAccount = () => {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: ''
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  const token = localStorage.getItem('adminToken')

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/admin-mgmt/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success && data.admin) {
        setAdmin(data.admin)
        setProfileForm({
          firstName: data.admin.firstName || '',
          lastName: data.admin.lastName || '',
          email: data.admin.email || ''
        })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
    setLoading(false)
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSuccessMsg('')
    setErrorMsg('')

    try {
      const res = await fetch(`${API_URL}/admin-mgmt/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileForm)
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg('Profile updated successfully')
        setAdmin(data.admin)
        // Update localStorage
        const stored = JSON.parse(localStorage.getItem('adminUser') || '{}')
        localStorage.setItem('adminUser', JSON.stringify({ ...stored, ...data.admin }))
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        setErrorMsg(data.message || 'Failed to update profile')
        setTimeout(() => setErrorMsg(''), 3000)
      }
    } catch (error) {
      setErrorMsg('Failed to update profile')
      setTimeout(() => setErrorMsg(''), 3000)
    }
    setSaving(false)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setSuccessMsg('')
    setErrorMsg('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMsg('New passwords do not match')
      setTimeout(() => setErrorMsg(''), 3000)
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters')
      setTimeout(() => setErrorMsg(''), 3000)
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch(`${API_URL}/admin-mgmt/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg('Password changed successfully')
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        setErrorMsg(data.message || 'Failed to change password')
        setTimeout(() => setErrorMsg(''), 3000)
      }
    } catch (error) {
      setErrorMsg('Failed to change password')
      setTimeout(() => setErrorMsg(''), 3000)
    }
    setChangingPassword(false)
  }

  if (loading) {
    return (
      <AdminLayout title="My Account" subtitle="Manage your admin account">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="My Account" subtitle="Manage your admin account settings">
      <div className="max-w-2xl space-y-6">

        {/* Success/Error Messages */}
        {successMsg && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl">
            <CheckCircle size={18} />
            <span className="text-sm">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
            <Shield size={18} />
            <span className="text-sm">{errorMsg}</span>
          </div>
        )}

        {/* Profile Info Card */}
        <div className="bg-dark-800 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
              <User size={24} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-white text-lg font-semibold">Profile Information</h2>
              <p className="text-gray-500 text-sm">Update your name and email address</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">First Name</label>
                <input
                  type="text"
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Last Name</label>
                <input
                  type="text"
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Shield size={14} />
              <span>Role: <span className="text-red-400 font-medium">{admin?.role || 'ADMIN'}</span></span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="bg-dark-800 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
              <Lock size={24} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-white text-lg font-semibold">Change Password</h2>
              <p className="text-gray-500 text-sm">Update your account password</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Current Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg pl-10 pr-12 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="Enter current password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">New Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg pl-10 pr-12 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="Enter new password (min 6 characters)"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Confirm New Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full bg-dark-700 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <Lock size={18} />
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminMyAccount
