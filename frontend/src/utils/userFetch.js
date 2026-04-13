import { API_URL } from '../config/api.js'

/**
 * Wrapper around fetch that automatically attaches the user Authorization header.
 * Drop-in replacement for `fetch()` in user pages.
 */
export default function userFetch(url, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    ...(options.headers || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(url, { ...options, headers })
}
