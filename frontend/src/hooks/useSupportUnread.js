import { useEffect, useState } from 'react'
import userFetch from '../utils/userFetch.js'
import { API_URL } from '../config/api'

// Polls the user's unread support count every 30s. Used by sidebars to
// show a notification badge whenever the bot or a human admin replies.
let lastCount = 0
const listeners = new Set()

async function fetchUnread() {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return
    const user = JSON.parse(raw)
    if (!user || !user._id) return
    const res = await userFetch(`${API_URL}/support/user/${user._id}/unread`)
    const data = await res.json()
    if (data && data.success) {
      lastCount = data.count || 0
      listeners.forEach(fn => fn(lastCount))
    }
  } catch {
    // silently ignore network blips — the badge just won't update
  }
}

let interval = null
function ensurePolling() {
  if (interval) return
  fetchUnread()
  interval = setInterval(fetchUnread, 30_000)
}

export function refreshSupportUnread() {
  return fetchUnread()
}

export default function useSupportUnread() {
  const [count, setCount] = useState(lastCount)
  useEffect(() => {
    ensurePolling()
    listeners.add(setCount)
    setCount(lastCount)
    return () => { listeners.delete(setCount) }
  }, [])
  return count
}
