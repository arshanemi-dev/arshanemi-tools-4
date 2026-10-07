import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getUserByEmail, getUserByMobile, createOTP } from '@/lib/db'
import { sendContactChangeOtpEmail } from '@/lib/mailer'
import { sendSmsOtp } from '@/lib/sms'
import { IS_CONNECT, proxyAuthCall, authHeaderFrom } from '@/lib/connect'
import { generateOTP } from '@/lib/otp'
import { tooManyAttempts, MINUTES } from '@/lib/rateLimit'

// Sends a verification OTP to a NEW email/mobile the logged-in user wants to
// switch to (proving they own it) — distinct from /api/auth/send-otp, which
// only ever targets an identifier already on file (password reset / login).
export async function POST(req) {
  // Each send is an email/SMS to an address the caller typed.
  const limited = tooManyAttempts(req, 'send-contact-otp', { limit: 10, windowMs: 10 * MINUTES })
  if (limited) return limited

  if (IS_CONNECT) {
    const body = await req.json()
    const { status, data } = await proxyAuthCall('/api/auth/send-contact-otp', { body, authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const payload = await getUserFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, value } = await req.json()
  if (!['email', 'mobile'].includes(type)) {
    return NextResponse.json({ error: 'Type must be email or mobile' }, { status: 400 })
  }
  const identifier = value?.trim()
  if (!identifier) return NextResponse.json({ error: 'Please enter a value' }, { status: 400 })
  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }
  if (type === 'mobile' && identifier.replace(/\D/g, '').length < 10) {
    return NextResponse.json({ error: 'Enter a valid mobile number' }, { status: 400 })
  }

  try {
    const normalized = type === 'email' ? identifier.toLowerCase() : identifier
    const existing = type === 'email' ? await getUserByEmail(normalized) : await getUserByMobile(normalized)
    if (existing && existing.id !== payload.userId) {
      return NextResponse.json({ error: `This ${type} is already in use by another account` }, { status: 409 })
    }

    const otpCode = generateOTP()
    const purpose = type === 'email' ? 'change_email' : 'change_mobile'
    await createOTP({ identifier: normalized, type, otpCode, purpose })

    if (type === 'email') {
      await sendContactChangeOtpEmail({ to: normalized, otpCode, name: payload.name, contactType: 'email' })
    } else {
      await sendSmsOtp({ to: normalized, otpCode })
    }

    return NextResponse.json({ ok: true, message: 'OTP sent successfully.' })
  } catch (err) {
    console.error('Send contact-change OTP error:', err)
    return NextResponse.json({ error: 'Failed to send OTP. Please try again.' }, { status: 500 })
  }
}
