import { NextResponse } from 'next/server'
import { verifyOTP } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { IS_CONNECT, proxyAuthCall } from '@/lib/connect'

export async function POST(req) {
  const { identifier, otpCode } = await req.json()

  if (IS_CONNECT) {
    const { status, data } = await proxyAuthCall('/api/auth/verify-otp', { body: { identifier, otpCode } })
    return NextResponse.json(data, { status })
  }

  if (!identifier || !otpCode) {
    return NextResponse.json({ error: 'Identifier and OTP are required' }, { status: 400 })
  }

  try {
    const valid = await verifyOTP({ identifier: identifier.trim(), otpCode: otpCode.trim() })
    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired OTP. Please request a new one.' }, { status: 400 })
    }

    // Issue a short-lived reset token (5 minutes) carrying the identifier
    const resetToken = await signToken({ identifier: identifier.trim(), purpose: 'reset_password' }, '5m')
    return NextResponse.json({ ok: true, resetToken })
  } catch (err) {
    console.error('Verify OTP error:', err)
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
  }
}
