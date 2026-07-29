import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { verifyOTP, updateUser, getCompanyById, getUserByEmail, getUserByMobile } from '@/lib/db'
import { serializeProfile } from '@/lib/profile'
import { IS_CONNECT, proxyAuthCall, authHeaderFrom } from '@/lib/connect'

// Verifies the OTP sent by /api/auth/send-contact-otp for a NEW email/mobile,
// then applies it to the logged-in user's own account.
export async function POST(req) {
  if (IS_CONNECT) {
    const body = await req.json()
    const { status, data } = await proxyAuthCall('/api/auth/verify-contact-change', { body, authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const payload = await getUserFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, value, otpCode } = await req.json()
  if (!['email', 'mobile'].includes(type)) {
    return NextResponse.json({ error: 'Type must be email or mobile' }, { status: 400 })
  }
  const identifier = value?.trim()
  if (!identifier || !otpCode) {
    return NextResponse.json({ error: 'Value and OTP are required' }, { status: 400 })
  }

  try {
    const normalized = type === 'email' ? identifier.toLowerCase() : identifier
    const purpose = type === 'email' ? 'change_email' : 'change_mobile'

    const valid = await verifyOTP({ identifier: normalized, otpCode: otpCode.trim(), purpose })
    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired OTP. Please request a new one.' }, { status: 400 })
    }

    // Re-check uniqueness right before applying — closes the gap where
    // someone else could have claimed it during the OTP window.
    const existing = type === 'email' ? await getUserByEmail(normalized) : await getUserByMobile(normalized)
    if (existing && existing.id !== payload.userId) {
      return NextResponse.json({ error: `This ${type} is already in use by another account` }, { status: 409 })
    }

    const updated = await updateUser(payload.userId, { [type]: normalized })
    const company = updated.company_id ? await getCompanyById(updated.company_id) : null
    return NextResponse.json(serializeProfile(updated, company))
  } catch (err) {
    console.error('Verify contact-change error:', err)
    return NextResponse.json({ error: 'Could not update. Please try again.' }, { status: 500 })
  }
}
