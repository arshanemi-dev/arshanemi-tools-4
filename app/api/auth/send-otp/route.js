import { NextResponse } from 'next/server'
import { getUserByEmail, getUserByMobile, createOTP } from '@/lib/db'
import { sendOtpEmail } from '@/lib/mailer'
import { sendSmsOtp } from '@/lib/sms'
import { IS_CONNECT, proxyAuthCall } from '@/lib/connect'

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req) {
  const { identifier, type } = await req.json()

  if (IS_CONNECT) {
    const { status, data } = await proxyAuthCall('/api/auth/send-otp', { body: { identifier, type } })
    return NextResponse.json(data, { status })
  }

  if (!identifier?.trim()) return NextResponse.json({ error: 'Identifier required' }, { status: 400 })
  if (!['email', 'mobile'].includes(type)) return NextResponse.json({ error: 'Type must be email or mobile' }, { status: 400 })

  try {
    // Verify account exists
    const user = type === 'email'
      ? await getUserByEmail(identifier.toLowerCase().trim())
      : await getUserByMobile(identifier.trim())

    if (!user) {
      // Generic message to avoid user enumeration
      return NextResponse.json({ ok: true, message: 'If an account exists, an OTP has been sent.' })
    }

    const otpCode = generateOTP()
    await createOTP({ identifier: identifier.trim(), type, otpCode })

    if (type === 'email') {
      await sendOtpEmail({ to: identifier.trim(), otpCode, name: user.name })
    } else {
      await sendSmsOtp({ to: identifier.trim(), otpCode })
    }

    return NextResponse.json({ ok: true, message: 'OTP sent successfully.' })
  } catch (err) {
    console.error('Send OTP error:', err)
    return NextResponse.json({ error: 'Failed to send OTP. Please try again.' }, { status: 500 })
  }
}
