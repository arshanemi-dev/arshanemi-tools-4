'use client'
import { useEffect } from 'react'
import { getRefreshToken, clearAuthTokens, isTokenExpired, refreshAccessToken } from '@/lib/tokenStore'

// Keeps the httpOnly access-token cookie alive without ever bouncing the user
// to /settings/login while their 7-day refresh token is still good. Two
// mechanisms:
//   1. Reactive — a one-time, idempotent patch of window.fetch that catches
//      any 401 from a same-origin /api/* call (the access token expired
//      between requests), silently refreshes (via lib/tokenStore.js's own
//      refreshAccessToken — the same helper authFetch already uses), and
//      retries the original call once. No existing fetch('/api/admin/...')
//      call site anywhere in the app needs to change for this to work.
//   2. Proactive — a periodic check against the expiresAt mirror kept in
//      localStorage (tokenStore.js) so most requests never even hit a 401.
// If the refresh token itself is invalid/expired, both paths fall through to
// forceLogout(): clears the httpOnly cookie(s) server-side, clears the
// localStorage mirror, and hard-redirects to /settings/login.

let patched = false
let realFetch = null

async function tryRefresh() {
  try {
    await refreshAccessToken()
    return true
  } catch {
    return false
  }
}

async function forceLogout() {
  clearAuthTokens()
  try { await realFetch('/api/auth/logout', { method: 'POST' }) } catch { /* cookie may already be gone */ }
  window.location.href = '/settings/login'
}

function installFetchInterceptor() {
  if (patched || typeof window === 'undefined') return
  patched = true
  realFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    const isAuthRoute = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'].some((p) => url.includes(p))
    const isApiCall = url.startsWith('/api') || url.includes(window.location.origin + '/api')

    const res = await realFetch(input, init)
    if (res.status !== 401 || isAuthRoute || !isApiCall) return res

    const refreshed = await tryRefresh()
    if (!refreshed) {
      forceLogout()
      return res
    }
    return realFetch(input, init)
  }
}

export default function SessionManager() {
  useEffect(() => {
    installFetchInterceptor()

    const interval = setInterval(async () => {
      if (getRefreshToken() && isTokenExpired()) {
        const ok = await tryRefresh()
        if (!ok) forceLogout()
      }
    }, 60_000)

    return () => clearInterval(interval)
  }, [])

  return null
}
