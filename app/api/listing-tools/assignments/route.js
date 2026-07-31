import { NextResponse } from 'next/server'
import { getStaffFromRequest } from '@/lib/auth'
import { proxyAdminCall, authHeaderFrom } from '@/lib/connect'

// Per-user template grants live in the hub (admin-pannels), not here — this
// app has no relational DB to hold them and history/grants are meant to
// survive even if a template is later renamed or deleted locally. This
// route only forwards the caller's own admin-panel-issued token so the hub
// can re-check master_admin/admin authorization itself server-side.
export async function GET(req) {
  const staff = await getStaffFromRequest(req)
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { status, data } = await proxyAdminCall('/api/listing-tools/assignments', { authHeader: authHeaderFrom(req) })
  return NextResponse.json(data, { status })
}

export async function PUT(req) {
  const staff = await getStaffFromRequest(req)
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { status, data } = await proxyAdminCall('/api/listing-tools/assignments', {
    method: 'PUT',
    body,
    authHeader: authHeaderFrom(req),
  })
  return NextResponse.json(data, { status })
}
