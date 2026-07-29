// Connected-mode proxy helpers. See CONNECT_MODE.md / .env.example for the full
// story. NEXT_PUBLIC_IS_CONNECT toggles whether /api/auth/* and /api/admin/* read
// and write against the root admin panel (arshanemi-admin-pannels) instead of this
// app's own local Supabase — mirrors tools/arshanemi-tools-1's identical flag.
export const IS_CONNECT = process.env.NEXT_PUBLIC_IS_CONNECT === 'true'

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || ''

// Pulls the caller's own bearer/cookie token off an incoming request so it can
// be forwarded as this same identity's Authorization header on the outbound
// call to root — same priority order as lib/auth.js's getAuthPayload (Bearer
// header, then the arshanemi-token/admin-token cookies), since cookies don't
// cross origins on a server-to-server fetch.
export function authHeaderFrom(req) {
  const bearer = req.headers.get('Authorization')
  if (bearer?.startsWith('Bearer ')) return bearer
  const token = req.cookies.get('arshanemi-token')?.value || req.cookies.get('admin-token')?.value
  return token ? `Bearer ${token}` : undefined
}

// Server-to-server admin CRUD calls (companies/users/tools/blogs/theme/generic
// collections & singletons). No static service token — forwards the actual
// caller's own identity via `authHeader` (build it with authHeaderFrom(req)),
// which resolves to a real root-issued token one of two ways: (1) this app's
// own cookie, when the caller logged in directly through /login (which
// proxies to root and stores root's issued token in that cookie — see
// app/api/auth/login/route.js), or (2) a Bearer header the browser attached
// from localStorage, populated by lib/tokenHandoff.js when this app is opened
// embedded in the root admin panel's iframe (root appends its session tokens
// as URL query params on the iframe src — same handoff tools-1 receives).
export async function proxyAdminCall(path, { method = 'GET', body, authHeader } = {}) {
  const res = await fetch(`${ADMIN_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// Auth calls (login/refresh/me/change-password/...) — forwards the request as-is
// and returns root's response verbatim, so root's accessToken/refreshToken/user
// pass straight through to the browser unchanged. `authHeader` forwards the
// caller's own bearer token for already-authenticated calls (me, change-password).
export async function proxyAuthCall(path, { method = 'POST', body, authHeader } = {}) {
  const res = await fetch(`${ADMIN_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}
