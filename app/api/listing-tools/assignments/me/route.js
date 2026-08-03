import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { proxyAdminCall, authHeaderFrom } from '@/lib/connect'

// Self-service counterpart to ../route.js (which is staff-only): any
// authenticated role can read/write their own "my templates" selection.
// Same forward-the-caller's-own-token idiom — the hub re-derives the user
// from that token server-side, this route never trusts a client-supplied id.
export async function GET(req) {
  const payload = await getAuthPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { status, data } = await proxyAdminCall('/api/listing-tools/assignments/me', { authHeader: authHeaderFrom(req) })
  return NextResponse.json(data, { status })
}

export async function PUT(req) {
  const payload = await getAuthPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { status, data } = await proxyAdminCall('/api/listing-tools/assignments/me', {
    method: 'PUT',
    body,
    authHeader: authHeaderFrom(req),
  })
  return NextResponse.json(data, { status })
}
