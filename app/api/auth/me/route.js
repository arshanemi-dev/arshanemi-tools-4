import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getUserById, getCompanyById, updateUser, getLatestWalletExpiry } from '@/lib/db'
import { serializeProfile } from '@/lib/profile'
import { IS_CONNECT, proxyAuthCall, authHeaderFrom } from '@/lib/connect'

// Current user's own profile — any authenticated role (master_admin, admin, user).
export async function GET(req) {
  if (IS_CONNECT) {
    const { status, data } = await proxyAuthCall('/api/auth/me', { method: 'GET', authHeader: authHeaderFrom(req) })
    const res = NextResponse.json(data, { status })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

  const payload = await getUserFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserById(payload.userId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const [company, walletExpiresAt] = await Promise.all([
    user.company_id ? getCompanyById(user.company_id) : null,
    getLatestWalletExpiry(user.id),
  ])

  const res = NextResponse.json(serializeProfile(user, company, walletExpiresAt))
  res.headers.set('Cache-Control', 'no-store')
  return res
}

// Self-service profile edit — name, invoicing details (business name, GST
// number) and address only. Email and mobile require OTP verification of the
// NEW value (see /api/auth/send-contact-otp + /api/auth/verify-contact-change)
// rather than a direct edit here. Role, company, active status, OTP
// requirement and wallet credits stay admin-managed (Admin → Users), never
// editable by the account owner.
export async function PATCH(req) {
  if (IS_CONNECT) {
    const body = await req.json()
    const { status, data } = await proxyAuthCall('/api/auth/me', { method: 'PATCH', body, authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const payload = await getUserFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const patch = {}

  if ('name' in body) {
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    patch.name = body.name.trim()
  }
  if ('address1' in body) patch.address1 = body.address1
  if ('address2' in body) patch.address2 = body.address2
  if ('addressCity' in body) patch.addressCity = body.addressCity
  if ('addressState' in body) patch.addressState = body.addressState
  if ('addressCountry' in body) patch.addressCountry = body.addressCountry
  if ('addressPincode' in body) patch.addressPincode = body.addressPincode
  if ('businessName' in body) patch.businessName = body.businessName
  if ('gstNumber' in body) patch.gstNumber = body.gstNumber

  try {
    const updated = await updateUser(payload.userId, patch)
    const [company, walletExpiresAt] = await Promise.all([
      updated.company_id ? getCompanyById(updated.company_id) : null,
      getLatestWalletExpiry(updated.id),
    ])
    return NextResponse.json(serializeProfile(updated, company, walletExpiresAt))
  } catch (err) {
    console.error('Self-edit profile error:', err)
    return NextResponse.json({ error: err.message || 'Could not update profile' }, { status: 500 })
  }
}
