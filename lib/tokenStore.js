'use client'

// Client-side cache of the auth session (admin or regular user), alongside
// (not instead of) the httpOnly token cookie that actually gates /admin and
// /api/admin/*. Mirrors tools/arshanemi-tools-1/lib/tokenStore.js so
// satellite tools can read the same shape if they ever share a session.
const KEYS = {
  accessToken:  'access_token',
  refreshToken: 'refresh_token',
  expiresAt:    'token_expires_at',
  user:         'user',
}

export function saveAuthTokens({ accessToken, refreshToken, expiresIn = 86400, user }) {
  if (typeof window === 'undefined') return
  const expiresAt = Date.now() + expiresIn * 1000
  localStorage.setItem(KEYS.accessToken, accessToken)
  localStorage.setItem(KEYS.refreshToken, refreshToken)
  localStorage.setItem(KEYS.expiresAt, String(expiresAt))
  if (user) localStorage.setItem(KEYS.user, JSON.stringify(user))
}

export function getAccessToken() {
  return typeof window !== 'undefined' ? localStorage.getItem(KEYS.accessToken) ?? null : null
}

export function getRefreshToken() {
  return typeof window !== 'undefined' ? localStorage.getItem(KEYS.refreshToken) ?? null : null
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(KEYS.user) ?? 'null') } catch { return null }
}

export function isTokenExpired() {
  if (typeof window === 'undefined') return true
  const expiresAt = Number(localStorage.getItem(KEYS.expiresAt) ?? 0)
  return Date.now() > expiresAt - 30_000 // 30-second buffer
}

export function isLoggedIn() {
  return !!getRefreshToken()
}

export function clearAuthTokens() {
  if (typeof window === 'undefined') return
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
}

let refreshPromise = null

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) throw new Error('No refresh token')

    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) {
      clearAuthTokens()
      throw new Error('Session expired')
    }

    const data = await res.json()
    saveAuthTokens({
      accessToken: data.accessToken,
      refreshToken,
      expiresIn: data.expiresIn ?? 86400,
      user: getStoredUser(),
    })
    return data.accessToken
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

// Bearer-authenticated fetch with a single auto-refresh-and-retry on 401.
export async function authFetch(path, options = {}) {
  if (isTokenExpired() && getRefreshToken()) {
    await refreshAccessToken().catch(() => {})
  }

  const doFetch = (token) =>
    fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

  let res = await doFetch(getAccessToken())

  if (res.status === 401 && getRefreshToken()) {
    try {
      const token = await refreshAccessToken()
      res = await doFetch(token)
    } catch {
      // refresh failed — fall through with the original 401
    }
  }

  return res
}
