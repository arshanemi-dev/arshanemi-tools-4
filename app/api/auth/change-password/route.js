import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUserFromRequest } from '@/lib/auth'
import { getUserById, updateUserPassword, verifyOTP } from '@/lib/db'
import { validatePassword } from '@/lib/validation'
import { IS_CONNECT, proxyAuthCall, authHeaderFrom } from '@/lib/connect'

// Logged-in self-service password change — requires BOTH the current
// password (something you know) AND a fresh OTP to an on-file email/mobile
// (something you have), verified and applied in one call. Distinct from
// /api/auth/reset-password, which is the "forgot password" flow and
// deliberately doesn't know the old password.
export async function POST(req) {
  if (IS_CONNECT) {
    const body = await req.json()
    const { status, data } = await proxyAuthCall('/api/auth/change-password', { body, authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const payload = await getUserFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { oldPassword, newPassword, otpCode, identifier } = await req.json()
  if (!oldPassword || !newPassword || !otpCode || !identifier) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const pwError = validatePassword(newPassword)
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

  try {
    const user = await getUserById(payload.userId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const oldMatch = await bcrypt.compare(oldPassword, user.password_hash)
    if (!oldMatch) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })

    const valid = await verifyOTP({ identifier: identifier.trim(), otpCode: otpCode.trim(), purpose: 'reset_password' })
    if (!valid) return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 })

    const newHash = await bcrypt.hash(newPassword, 10)
    await updateUserPassword(user.id, newHash)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Change password error:', err)
    return NextResponse.json({ error: 'Could not change password. Please try again.' }, { status: 500 })
  }
}
