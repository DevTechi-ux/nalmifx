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

export default { authUser, authAdmin, authSuperAdmin, authAny }
