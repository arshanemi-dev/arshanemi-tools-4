import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET)
const PUBLIC_PATHS = ['/api/auth/login']

// Same cookie lib/auth.js's makeAuthCookie/ADMIN_COOKIE issue on a normal password login — not
// imported from there because that module pulls in next/headers' cookies(), which isn't the
// right API surface inside middleware (this file already reimplements JWT verification itself
// via `jose` directly for the same reason, rather than importing lib/auth.js's verifyToken).
const COOKIE_NAME = 'barmeto-token'
const ADMIN_COOKIE = 'admin-token'
function authCookie(token) {
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

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3001').split(',').map((o) => o.trim())

function setCorsHeaders(res, origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.headers.set('Access-Control-Allow-Origin', allowed)
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  res.headers.set('Vary', 'Origin')
}

export async function proxy(req) {
  const { pathname } = req.nextUrl
  const origin = req.headers.get('origin') || ''

  // Handle CORS preflight for all API routes
  if (req.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    const res = new NextResponse(null, { status: 204 })
    setCorsHeaders(res, origin)
    return res
  }

  const isAdminPath = pathname.startsWith('/api/admin')
  // Listing Tools pages themselves are NOT login-gated (see
  // app/listing-tools/layout.js and lib/authGate.js) — "requires auth" here
  // only still means something for /api/listing-tools/* (always a real
  // 401 below, same as any other protected API) and /api/admin/*. Any
  // authenticated role may reach the pages (not just master_admin/admin).
  const isListingToolsPath = pathname.startsWith('/listing-tools') || pathname.startsWith('/api/listing-tools')
  const requiresAuth = isAdminPath || isListingToolsPath

  // Non-admin API routes (e.g. /api/auth/*) and the standalone auth pages
  // (/login, ...): inject CORS headers where relevant and pass
  // through, but still stamp x-pathname so the root layout can tell these
  // full-bleed auth screens apart from regular public pages and skip the
  // site Header/Footer for them.
  if (!requiresAuth) {
    const res = NextResponse.next()
    res.headers.set('x-pathname', pathname)
    if (pathname.startsWith('/api/')) setCorsHeaders(res, origin)
    return res
  }

  // Theme is read by the public site (ThemeContext) for every visitor, so GET
  // must be readable without an admin session — PUT/DELETE still require auth.
  const isPublicThemeGet = pathname === '/api/admin/theme' && req.method === 'GET'
  const isPublic = isPublicThemeGet || PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (isPublic) {
    const res = NextResponse.next()
    res.headers.set('x-pathname', pathname)
    setCorsHeaders(res, origin)
    return res
  }

  // Any authenticated role (master_admin / admin / user) gets an
  // 'barmeto-token' cookie on login; only master_admin additionally gets
  // 'admin-token'. Structural access to these paths is granted to any
  // logged-in role here — the layout and API routes below decide what each
  // role can actually see/do, same defense-in-depth pattern already used
  // elsewhere.
  const cookieToken = req.cookies.get('admin-token')?.value || req.cookies.get('barmeto-token')?.value
  // Cross-app SSO handoff (see lib/tokenHandoff.js) — root appends its own issued access token as
  // `lt_at` on this app's URL when opening it embedded in an iframe. That's normally only picked
  // up by client-side JS for *API calls* (a Bearer header attached from localStorage), but a
  // plain page *navigation* like this one never carries a custom header, and this middleware runs
  // server-side, before any client code exists to read localStorage at all — so without this, an
  // iframe-embedded first load always bounced to /login even carrying a perfectly valid token.
  // Verified below with the exact same jwtVerify() as the cookie path (connected mode already
  // requires this app's JWT_SECRET to match root's — see .env.example — so a real root-issued
  // token verifies here too); only a token that actually passes gets trusted.
  const handoffToken = !cookieToken ? req.nextUrl.searchParams.get('lt_at') : null
  // Every actual dashboard data call (SessionManager's fetch interceptor,
  // lib/tokenStore.js's authFetch) authenticates with this header, not a
  // cookie — it's the one channel guaranteed to work regardless of
  // third-party cookie policy (see components/admin/SessionManager.jsx).
  // Without also trusting it here, every /api/listing-tools/* and
  // /api/admin/* call made *after* the initial page load 401'd at this
  // middleware before ever reaching the route handler below (which already
  // accepts this same header via lib/auth.js's getAuthPayload) — even
  // though the visitor had a perfectly valid, currently-working token.
  const bearer = req.headers.get('Authorization')
  const bearerToken = !cookieToken && !handoffToken && bearer?.startsWith('Bearer ') ? bearer.slice(7) : null
  const token = cookieToken || handoffToken || bearerToken
  const isApi = pathname.startsWith('/api/')

  // No token, or (below) an invalid/expired one, on a page navigation: this
  // used to hard-redirect straight to /login — but this app has no page
  // that requires being signed in just to look at it (see
  // app/listing-tools/layout.js), and a full-page navigation has no way to
  // run the client-side silent-refresh flow SessionManager already does for
  // API calls. That made every access-token expiry (1 day) or missed SSO
  // handoff bounce a page-reload straight to /login even when the visitor
  // had a perfectly good refreshable session — now it renders through, and
  // only an actual authenticated action shows the shared login-required
  // modal (an unauthenticated /api/* call still 401s immediately below,
  // same as before — that's what the modal reacts to).
  if (!token) {
    if (isApi) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      setCorsHeaders(res, origin)
      return res
    }
    const res = NextResponse.next()
    res.headers.set('x-pathname', pathname)
    setCorsHeaders(res, origin)
    return res
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)
    const res = NextResponse.next()
    res.headers.set('X-Admin-User', payload.name ?? '')
    res.headers.set('x-pathname', pathname)
    setCorsHeaders(res, origin)
    // First time this token's been seen (URL handoff, no cookie yet) — stamp it as a real cookie
    // right now, exactly like a normal password login would, so every request after this one
    // (including the very next navigation) is cookie-authenticated with no need for the query
    // param to still be there.
    if (handoffToken) {
      res.cookies.set(authCookie(handoffToken))
      if (payload.role === 'master_admin') res.cookies.set({ ...authCookie(handoffToken), name: ADMIN_COOKIE })
    }
    return res
  } catch {
    if (isApi) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      setCorsHeaders(res, origin)
      return res
    }
    const res = NextResponse.next()
    res.headers.set('x-pathname', pathname)
    setCorsHeaders(res, origin)
    return res
  }
}

export const config = {
  matcher: ['/listing-tools/:path*', '/api/:path*', '/login', '/forgot-password', '/reset-password'],
}
