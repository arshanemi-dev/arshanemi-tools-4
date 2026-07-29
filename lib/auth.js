import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET         = new TextEncoder().encode(process.env.JWT_SECRET)
const REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET + '_refresh')

const COOKIE_NAME = 'arshanemi-token'
export const ADMIN_COOKIE = 'admin-token'

// ── Access token (1 day) ─────────────────────────────────────────────────────

export async function signToken(payload, expiresIn = '1d') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(SECRET)
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload
  } catch {
    return null
  }
}

// ── Refresh token (7 days) ───────────────────────────────────────────────────

export async function signRefreshToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(REFRESH_SECRET)
}

export async function verifyRefreshToken(token) {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET)
    return payload
  } catch {
    return null
  }
}

// ── Token extraction helpers ─────────────────────────────────────────────────

export function getBearerToken(req) {
  const auth = req.headers.get('Authorization') ?? ''
  if (auth.startsWith('Bearer ')) return auth.slice(7)
  return null
}

export async function getAuthPayload(req) {
  // Priority: Bearer header → httpOnly cookie
  const bearer = getBearerToken(req)
  if (bearer) return verifyToken(bearer)
  const cookie = req.cookies.get(COOKIE_NAME) || req.cookies.get(ADMIN_COOKIE)
  if (!cookie?.value) return null
  return verifyToken(cookie.value)
}

// ── Cookie helpers (httpOnly — for browser sessions) ────────────────────────

export async function getUserFromRequest(req) {
  return getAuthPayload(req)
}

export async function getUserFromCookies() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export function makeAuthCookie(token) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 1 day — matches access token
    path: '/',
  }
}

export function clearAuthCookie() {
  return {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  }
}

export { makeAuthCookie as makeAdminCookie }

export async function getAdminFromRequest(req) {
  const payload = await getAuthPayload(req)
  if (!payload) return null
  return payload.role === 'master_admin' ? payload : null
}

// 'Staff' = master_admin or the company-scoped 'admin' role — used by the
// Users CRUD and tools-access endpoints, which both roles can operate
// (scoped to their own company for 'admin'). Master-only surfaces (companies,
// CMS content, tools catalog writes, site config) keep using getAdminFromRequest.
const STAFF_ROLES = ['master_admin', 'admin']

export async function getStaffFromRequest(req) {
  const payload = await getAuthPayload(req)
  if (!payload) return null
  return STAFF_ROLES.includes(payload.role) ? payload : null
}

export async function getAdminFromCookies() {
  const cookieStore = await cookies()
  const token = (cookieStore.get(ADMIN_COOKIE) || cookieStore.get(COOKIE_NAME))?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  return payload.role === 'master_admin' ? payload : null
}
