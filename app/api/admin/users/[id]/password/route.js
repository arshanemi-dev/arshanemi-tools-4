import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getStaffFromRequest } from '@/lib/auth'
import { getUserById, updateUserPassword } from '@/lib/db'
import { validatePassword } from '@/lib/validation'
import { IS_CONNECT, proxyAdminCall, authHeaderFrom } from '@/lib/connect'

// Direct administrator-set password reset — no OTP. Distinct from the
// self-service OTP-gated flow used on the Profile page and admin login.
export async function PATCH(req, { params }) {
  const staff = await getStaffFromRequest(req)
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (IS_CONNECT) {
    const body = await req.json()
    const { status, data } = await proxyAdminCall(`/api/admin/users/${id}/password`, { method: 'PATCH', body, authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const target = await getUserById(id)
  if (!target || target.role === 'master_admin') {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (staff.role === 'admin' && target.company_id !== staff.companyId) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { password } = await req.json()
  const pwError = validatePassword(password)
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    await updateUserPassword(target.id, passwordHash)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin set-password error:', err)
    return NextResponse.json({ error: 'Could not update password' }, { status: 500 })
  }
}
