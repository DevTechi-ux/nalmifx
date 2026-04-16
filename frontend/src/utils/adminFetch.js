import { API_URL } from '../config/api.js'

/**
 * Wrapper around fetch that auto-attaches the right admin token.
 *
 * Two localStorage buckets so a super-admin session in one tab is not wiped
 * when a sub-admin logs into the same browser in another tab:
 *   - /admin/*       → `adminToken` + `adminUser`   (SUPER_ADMIN)
 *   - /<slug>/*      → `branchToken` + `branchUser` (sub-admin, branded)
 */
function currentAdminTokenKey() {
  if (typeof window === 'undefined') return 'adminToken'
  const path = window.location.pathname
  if (path.startsWith('/admin')) return 'adminToken'
  return 'branchToken'
}

export default function adminFetch(url, options = {}) {
  const primaryKey = currentAdminTokenKey()
  const fallbackKey = primaryKey === 'adminToken' ? 'branchToken' : 'adminToken'
  const token = localStorage.getItem(primaryKey) || localStorage.getItem(fallbackKey)
  const headers = {
    ...(options.headers || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(url, { ...options, headers })
}

export function getCurrentAdminUser() {
  const key = currentAdminTokenKey() === 'branchToken' ? 'branchUser' : 'adminUser'
  try {
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}
