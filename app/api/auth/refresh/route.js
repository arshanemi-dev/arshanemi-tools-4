import { NextResponse } from 'next/server'
import { verifyRefreshToken, verifyToken, signToken, makeAuthCookie, clearAuthCookie, ADMIN_COOKIE } from '@/lib/auth'
import { IS_CONNECT, proxyAuthCall } from '@/lib/connect'

export async function POST(req) {
  try {
    const { refreshToken } = await req.json()

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token required' }, { status: 400 })
    }

    // Connected mode: root owns refresh-token rotation — see login/route.js
    // for the JWT_SECRET-sharing note this (and login) relies on.
    if (IS_CONNECT) {
      const { status, data } = await proxyAuthCall('/api/auth/refresh', { body: { refreshToken } })
      if (status !== 200 || !data.ok) {
        return NextResponse.json({ error: data.error || 'Invalid or expired refresh token' }, { status: status || 401 })
      }
      const res = NextResponse.json(data)
      res.cookies.set(makeAuthCookie(data.accessToken))
      // Relies on this app's JWT_SECRET matching root's (see login/route.js) —
      // decodes root's freshly-issued token locally just to read the role,
      // so the admin-token cookie stays in sync the same way local mode does.
      const decoded = await verifyToken(data.accessToken)
      if (decoded?.role === 'master_admin') {
        res.cookies.set({ ...makeAuthCookie(data.accessToken), name: ADMIN_COOKIE })
      }
      return res
    }

    const payload = await verifyRefreshToken(refreshToken)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 })
    }

    const tokenPayload = {
      userId: payload.userId,
      role:   payload.role,
      // re-use fields that were in original token
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.name  ? { name:  payload.name  } : {}),
      ...(payload.companyId !== undefined ? { companyId: payload.companyId } : {}),
    }

    const accessToken = await signToken(tokenPayload, '1d')
    const cookie      = makeAuthCookie(accessToken)

    const res = NextResponse.json({
      ok: true,
      accessToken,
      expiresIn: 86400,
    })

    res.cookies.set(cookie)
    if (payload.role === 'master_admin') {
      res.cookies.set({ ...cookie, name: ADMIN_COOKIE })
    } else {
      // Same stale-cookie guard as login — see that route for why.
      res.cookies.set({ ...clearAuthCookie(), name: ADMIN_COOKIE })
    }

    return res
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
