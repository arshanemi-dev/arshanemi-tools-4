import { NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { proxyAdminCall, authHeaderFrom } from '@/lib/connect'

// master_admin only, both verbs — powers TemplateAccessPanel. Per-user
// Template Settings grants live on the hub (arshanemi-admin-pannels), not
// here, same "forward the caller's own token, let the hub re-check and
// persist" idiom as app/api/listing-tools/assignments/route.js. Replaces the
// old app/api/admin/listing-tools-config route, which stored a role-blanket
// {admin,user} toggle in this app's own local Blob singleton that nothing
// ever actually read.
export async function GET(req) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { status, data } = await proxyAdminCall('/api/admin/listing-template-access', { authHeader: authHeaderFrom(req) })
  return NextResponse.json(data, { status })
}

// Body: { [userId]: boolean }
export async function PUT(req) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { status, data } = await proxyAdminCall('/api/admin/listing-template-access', {
    method: 'PUT',
    body,
    authHeader: authHeaderFrom(req),
  })
  return NextResponse.json(data, { status })
}
