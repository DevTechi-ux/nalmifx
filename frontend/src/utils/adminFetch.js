import { API_URL } from '../config/api.js'

/**
 * Wrapper around fetch that automatically attaches the admin Authorization header.
 * Drop-in replacement for `fetch()` in admin pages.
 */
export default function adminFetch(url, options = {}) {
  const token = localStorage.getItem('adminToken')
  const headers = {
    ...(options.headers || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(url, { ...options, headers })
}
