import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken, signRefreshToken, makeAuthCookie, clearAuthCookie, ADMIN_COOKIE } from '@/lib/auth'
import { getUserByEmail, getUserByMobile, createOTP, verifyOTP } from '@/lib/db'
import { sendLoginOtpEmail } from '@/lib/mailer'
import { IS_CONNECT, proxyAuthCall } from '@/lib/connect'

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

const OTP_DISABLED = process.env.NEXT_PUBLIC_IS_OTP_Verifications_Disable === 'true'

export async function POST(req) {
  const { identifier, password, username, otpCode } = await req.json()

  // Support legacy admin login (username field) for backward compatibility
  const id = identifier || username

  if (!id || (!password && !otpCode)) {
    return NextResponse.json({ error: 'Identifier and password required' }, { status: 400 })
  }

  // Connected mode: proxy credentials to the root admin panel and hand its
  // issued tokens back to the browser as-is. Requires this app's JWT_SECRET /
  // JWT_REFRESH_SECRET to match root's — see .env.example — so the tokens
  // issued here also verify against this app's own /settings SSR gate
  // (app/settings/layout.js + proxy.js), which still checks locally.
  if (IS_CONNECT) {
    const { status, data } = await proxyAuthCall('/api/auth/login', { body: { identifier: id, password, otpCode } })
    if (data.otpRequired) return NextResponse.json(data, { status })
    if (status !== 200 || !data.ok) {
      return NextResponse.json({ error: data.error || 'Invalid credentials' }, { status: status || 401 })
    }
    const res = NextResponse.json(data)
    res.cookies.set(makeAuthCookie(data.accessToken))
    if (data.user?.role === 'master_admin') {
      res.cookies.set({ ...makeAuthCookie(data.accessToken), name: ADMIN_COOKIE })
    } else {
      res.cookies.set({ ...clearAuthCookie(), name: ADMIN_COOKIE })
    }
    return res
  }

  try {
    const isEmail = id.includes('@')
    const user = isEmail
      ? await getUserByEmail(id.toLowerCase().trim())
      : await getUserByMobile(id.trim())

    if (!user || !user.is_active) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // OTP-gated login: always required for master_admin, optional per-user otherwise —
    // unless OTP verification is globally disabled, in which case login is
    // password-only for every role and the /login and /settings/login OTP
    // step never renders (they're both driven off this same otpRequired flag).
    const otpRequired = !OTP_DISABLED && (user.role === 'master_admin' || !!user.otp_enabled)

    if (otpCode) {
      // Step 2: verifying the login OTP
      if (!otpRequired) {
        return NextResponse.json({ error: 'OTP not applicable for this account' }, { status: 400 })
      }
      const valid = await verifyOTP({ identifier: user.email, otpCode, purpose: 'login_otp' })
      if (!valid) {
        return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 })
      }
    } else {
      // Step 1: password check
      const match = await bcrypt.compare(password, user.password_hash)
      if (!match) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      if (otpRequired) {
        if (!user.email) {
          return NextResponse.json({ error: 'Account has no email on file for OTP' }, { status: 500 })
        }
        const otp = generateOTP()
        await createOTP({ identifier: user.email, type: 'email', otpCode: otp, purpose: 'login_otp' })
        await sendLoginOtpEmail({ to: user.email, otpCode: otp, name: user.name })
        return NextResponse.json({ otpRequired: true, identifier: user.email })
      }
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role, name: user.name, companyId: user.company_id ?? null }

    // Access token (1 day) + long-lived refresh token (7 days). Refresh token
    // carries the same identity fields so a silent refresh doesn't drop
    // email/name/companyId from the re-signed access token.
    const accessToken  = await signToken(tokenPayload, '1d')
    const refreshToken = await signRefreshToken(tokenPayload)

    const cookie = makeAuthCookie(accessToken)

    const res = NextResponse.json({
      ok: true,
      accessToken,
      refreshToken,
      expiresIn: 86400, // seconds (1 day)
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })

    res.cookies.set(cookie)
    if (user.role === 'master_admin') {
      res.cookies.set({ ...cookie, name: ADMIN_COOKIE })
    } else {
      // A stale 'admin-token' cookie from a previous master_admin session on
      // this browser must not leak into this login — /settings/layout.js
      // reads 'admin-token' first, so without this a regular user signing in
      // right after a master_admin would still be treated as master_admin.
      res.cookies.set({ ...clearAuthCookie(), name: ADMIN_COOKIE })
    }

    return res
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
}
