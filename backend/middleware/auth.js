import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Admin from '../models/Admin.js'

// Lazy getter — env vars are available by the time any request is handled,
// even though they may not be ready at ES-module import time.
function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set.')
  }
  return secret
}

// Authenticate regular users
export const authUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' })
    }

    const decoded = jwt.verify(token, getJwtSecret())
    const user = await User.findById(decoded.userId || decoded.id).select('-password')
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' })
    }

    req.user = user
    req.userId = user._id.toString()
    next()
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

// Authenticate admin users
export const authAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ success: false, message: 'Admin authentication required' })
    }

    const decoded = jwt.verify(token, getJwtSecret())
    const admin = await Admin.findById(decoded.adminId).select('-password')
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin not found' })
    }
    if (admin.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Admin account is suspended' })
    }

    req.admin = admin
    req.adminId = admin._id.toString()
    next()
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired admin token' })
  }
}

// Authenticate super admin only
export const authSuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ success: false, message: 'Super admin authentication required' })
    }

    const decoded = jwt.verify(token, getJwtSecret())
    const admin = await Admin.findById(decoded.adminId).select('-password')
    if (!admin || admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Super admin access required' })
    }
    if (admin.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Admin account is suspended' })
    }

    req.admin = admin
    req.adminId = admin._id.toString()
    next()
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

// Authenticate either user or admin (for shared endpoints)
export const authAny = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' })
    }

    const decoded = jwt.verify(token, getJwtSecret())

    // Try admin first
    if (decoded.adminId) {
      const admin = await Admin.findById(decoded.adminId).select('-password')
      if (admin && admin.status === 'ACTIVE') {
        req.admin = admin
        req.adminId = admin._id.toString()
        req.isAdmin = true
        return next()
      }
    }

    // Try user
    const userId = decoded.userId || decoded.id
    if (userId) {
      const user = await User.findById(userId).select('-password')
      if (user) {
        req.user = user
        req.userId = user._id.toString()
        req.isAdmin = false
        return next()
      }
    }

    return res.status(401).json({ success: false, message: 'Invalid token' })
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

// Permission gate — use after authAdmin to enforce a specific permission.
// Usage: router.get('/users', authAdmin, requirePermission('canManageUsers'), handler)
export const requirePermission = (permissionName) => (req, res, next) => {
  // Super admins bypass all permission checks
  if (req.admin && req.admin.role === 'SUPER_ADMIN') return next()

  // Sub-admins must have the specific permission enabled
  if (req.admin && req.admin.permissions && req.admin.permissions[permissionName]) {
    return next()
  }

  return res.status(403).json({
    success: false,
    message: `Access denied: you do not have the '${permissionName}' permission`
  })
}

// Scope helper — returns a MongoDB filter that limits queries to the admin's
// assigned users.  Super admins see everything; sub-admins only their users.
// Import this in route files:
//   import { scopeToAdmin } from '../middleware/auth.js'
//   const scope = scopeToAdmin(req)          // { assignedAdmin: <id> } or {}
//   const users = await User.find(scope)
export function scopeToAdmin(req) {
  if (req.admin && req.admin.role === 'SUPER_ADMIN') return {}
  return { assignedAdmin: req.adminId }
}

// Convenience: get scoped user IDs for downstream model queries (Trade, Transaction, etc.)
// Returns an array of ObjectIds.
export async function getScopedUserIds(req) {
  if (req.admin && req.admin.role === 'SUPER_ADMIN') return null // null = no filter
  const User = (await import('../models/User.js')).default
  return User.find({ assignedAdmin: req.adminId }).distinct('_id')
}

export default { authUser, authAdmin, authSuperAdmin, authAny, requirePermission, scopeToAdmin, getScopedUserIds }
