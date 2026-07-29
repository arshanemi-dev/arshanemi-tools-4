import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET)
const PUBLIC_PATHS = ['/settings/login', '/api/auth/login']

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

  const isAdminPath = pathname.startsWith('/settings') || pathname.startsWith('/api/admin')

  // Non-admin API routes (e.g. /api/auth/*) and the standalone auth pages
  // (/login, ...): inject CORS headers where relevant and pass
  // through, but still stamp x-pathname so the root layout can tell these
  // full-bleed auth screens apart from regular public pages and skip the
  // site Header/Footer for them.
  if (!isAdminPath) {
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
  // 'arshanemi-token' cookie on login; only master_admin additionally gets
  // 'admin-token'. Structural access to /settings is granted to any logged-in
  // role here — the layout and API routes below decide what each role can
  // actually see/do, same defense-in-depth pattern already used elsewhere.
  const token = req.cookies.get('admin-token')?.value || req.cookies.get('arshanemi-token')?.value
  if (!token) {
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      setCorsHeaders(res, origin)
      return res
    }
    const loginUrl = new URL('/settings/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)
    const res = NextResponse.next()
    res.headers.set('X-Admin-User', payload.name ?? '')
    res.headers.set('x-pathname', pathname)
    setCorsHeaders(res, origin)
    return res
  } catch {
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      setCorsHeaders(res, origin)
      return res
    }
    const loginUrl = new URL('/settings/login', req.url)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: ['/settings/:path*', '/api/:path*', '/login',  '/forgot-password', '/reset-password'],
}
