// API base: 1) window.__NALMIFX_API_BASE__ from index.html on nalmifx.com  2) VITE_* at build  3) localhost dev
function resolveApiBaseUrl() {
  if (typeof window !== 'undefined' && window.__NALMIFX_API_BASE__) {
    return String(window.__NALMIFX_API_BASE__).replace(/\/$/, '')
  }
  const fromEnv = (import.meta.env.VITE_API_URL || '').trim()
  if (typeof window !== 'undefined' && import.meta.env.PROD) {
    const host = window.location.hostname
    const onNalmiSite =
      host === 'nalmifx.com' || host === 'www.nalmifx.com' || /\.nalmifx\.com$/i.test(host)
    const looksLocal = !fromEnv || /localhost|127\.0\.0\.1/i.test(fromEnv)
    if (onNalmiSite && looksLocal) {
      return 'https://api.nalmifx.com'
    }
  }
  return fromEnv || 'http://localhost:5001'
}

export const API_BASE_URL = resolveApiBaseUrl()
export const API_URL = `${API_BASE_URL}/api`
