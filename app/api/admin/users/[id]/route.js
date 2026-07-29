import { NextResponse } from 'next/server'
import { getStaffFromRequest } from '@/lib/auth'
import { getUserById, updateUser, deleteUser, getUserByEmail, getUserByMobile, getCompanyById } from '@/lib/db'
import { IS_CONNECT, proxyAdminCall, authHeaderFrom } from '@/lib/connect'

// Loads the target user and enforces company scoping for the 'admin' role.
// Admins only ever manage plain 'user' accounts — never master_admin, and
// never a fellow 'admin', matching what they can see in the Users list.
// Returns { user } or { error, status } (error already NextResponse-ready).
async function loadScopedTarget(staff, id) {
  const target = await getUserById(id)
  if (!target || target.role === 'master_admin') {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  }
  if (staff.role === 'admin' && (target.company_id !== staff.companyId || target.role !== 'user')) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  }
  return { user: target }
}

export async function PATCH(req, { params }) {
  const staff = await getStaffFromRequest(req)
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall(`/api/admin/users/${id}`, { method: 'PATCH', body, authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const { user: target, error } = await loadScopedTarget(staff, id)
  if (error) return error

  const patch = {}
  if ('name' in body) patch.name = body.name?.trim()
  if ('mobile' in body) patch.mobile = body.mobile?.trim() || null
  if ('isActive' in body) patch.isActive = !!body.isActive
  if ('otpEnabled' in body) patch.otpEnabled = !!body.otpEnabled
  if ('address1' in body) patch.address1 = body.address1?.trim() || null
  if ('address2' in body) patch.address2 = body.address2?.trim() || null
  if ('walletCreditsTotal' in body) patch.walletCreditsTotal = Math.max(0, +body.walletCreditsTotal || 0)
  if ('walletCreditsUsed' in body) patch.walletCreditsUsed = Math.max(0, +body.walletCreditsUsed || 0)

  if ('email' in body) {
    const email = body.email ? body.email.toLowerCase().trim() : null
    if (email) {
      const existing = await getUserByEmail(email)
      if (existing && existing.id !== target.id) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
      }
    }
    patch.email = email
  }

  // Role and company are locked for the company-scoped 'admin' role — only
  // master_admin may reassign either.
  if (staff.role === 'master_admin') {
    if ('role' in body) {
      if (!['admin', 'user'].includes(body.role)) {
        return NextResponse.json({ error: 'Role must be admin or user' }, { status: 400 })
      }
      patch.role = body.role
    }
    if ('companyId' in body) {
      const company = await getCompanyById(body.companyId)
      if (!company) return NextResponse.json({ error: 'Selected company does not exist' }, { status: 400 })
      patch.companyId = body.companyId
    }
  }

  try {
    const updated = await updateUser(target.id, patch)
    return NextResponse.json({
      id: updated.id, name: updated.name, email: updated.email, mobile: updated.mobile,
      role: updated.role, companyId: updated.company_id, isActive: updated.is_active,
      otpEnabled: updated.otp_enabled, address1: updated.address1, address2: updated.address2,
      walletCreditsTotal: updated.wallet_credits_total, walletCreditsUsed: updated.wallet_credits_used,
      createdAt: updated.created_at,
    })
  } catch (err) {
    console.error('Update user error:', err)
    return NextResponse.json({ error: err.message || 'Could not update user' }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  const staff = await getStaffFromRequest(req)
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (id === staff.userId) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall(`/api/admin/users/${id}`, { method: 'DELETE', authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const { user: target, error } = await loadScopedTarget(staff, id)
  if (error) return error

  await deleteUser(target.id)
  return NextResponse.json({ ok: true })
}
