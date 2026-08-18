'use client'
import { useEffect } from 'react'
import { getAccessToken, getRefreshToken, clearAuthTokens, isTokenExpired, refreshAccessToken } from '@/lib/tokenStore'
import { requireLogin } from '@/lib/authGate'

// Keeps every same-origin /api/* call authenticated without any individual
// fetch('/api/...') call site needing to know or care how — three mechanisms:
//   1. Proactive header attach — every outgoing same-origin /api/* request
//      that doesn't already carry its own Authorization header gets the
//      cached access token attached as one. This is what actually makes the
//      cross-app iframe SSO handoff (lib/tokenHandoff.js) reach every API
//      call, not just the ones already using lib/tokenStore.js's authFetch:
//      the httpOnly cookie proxy.js stamps from the handoff's `lt_at` param
//      is a *third-party* cookie from the embedding page's point of view
//      (this app is iframed from a different origin), and browsers that
//      block third-party cookies (Safari ITP today, Chrome moving the same
//      direction) will silently drop it — the Authorization header has no
//      such restriction, so it's the one path guaranteed to work regardless
//      of cookie policy.
//   2. Reactive — catches any 401 from a same-origin /api/* call (the access
//      token expired between requests), silently refreshes (via
//      lib/tokenStore.js's own refreshAccessToken — the same helper
//      authFetch already uses), and retries the original call once with the
//      freshly-refreshed token attached.
//   3. Proactive expiry check — a periodic check against the expiresAt
//      mirror kept in localStorage (tokenStore.js) so most requests never
//      even hit a 401.
// If the refresh token itself is invalid/expired (or never existed — a
// guest), both paths fall through to forceLogout(): clears the httpOnly
// cookie(s) server-side, clears the localStorage mirror, and triggers the
// shared "please log in" modal (lib/authGate.js) — never a hard redirect.
// This app has no page that requires being logged in just to look at it;
// only an actual authenticated action should ever interrupt the visitor.

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

let loggingOut = false
async function forceLogout() {
  if (loggingOut) return
  loggingOut = true
  clearAuthTokens()
  try { await realFetch('/api/auth/logout', { method: 'POST' }) } catch { /* cookie may already be gone */ }
  requireLogin()
  loggingOut = false
}

// Merges the cached access token into `init.headers` as `Authorization:
// Bearer …` — unless the caller already set one explicitly (e.g. authFetch,
// or a proxy route forwarding someone else's token), which always wins.
// Handles `input` being either a URL string or a Request object, since a
// Request's own headers need seeding into the merged Headers instance too.
function withAuthHeader(input, init) {
  const token = getAccessToken()
  if (!token) return init

  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v))
  if (headers.has('Authorization')) return init

  headers.set('Authorization', `Bearer ${token}`)
  return { ...init, headers }
}

function installFetchInterceptor() {
  if (patched || typeof window === 'undefined') return
  patched = true
  realFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    const isAuthRoute = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'].some((p) => url.includes(p))
    const isApiCall = url.startsWith('/api') || url.includes(window.location.origin + '/api')

    const authedInit = isApiCall && !isAuthRoute ? withAuthHeader(input, init) : init
    const res = await realFetch(input, authedInit)
    if (res.status !== 401 || isAuthRoute || !isApiCall) return res

    const refreshed = await tryRefresh()
    if (!refreshed) {
      forceLogout()
      return res
    }
    return realFetch(input, withAuthHeader(input, init))
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
