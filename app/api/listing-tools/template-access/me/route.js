import { NextResponse } from 'next/server'
import { getBearerToken, verifyToken } from '@/lib/auth'
import { fetchTemplateSettingsAllowed } from '@/lib/listingTemplateAccess'

// Client-callable counterpart to lib/listingTemplateAccess.js's
// fetchTemplateSettingsAllowed — the server layouts that already hold a raw
// cookie token call that helper directly; this exists so
// components/listing/ListingToolsShell.jsx can re-check the same thing
// client-side once a cross-app SSO handoff has landed tokens in
// localStorage instead of a cookie (see app/listing-tools/layout.js).
export async function GET(req) {
  const bearer = getBearerToken(req)
  const cookieToken = req.cookies.get('barmeto-token')?.value || req.cookies.get('admin-token')?.value
  const token = bearer || cookieToken
  const payload = token ? await verifyToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = payload.role === 'master_admin' ? true : await fetchTemplateSettingsAllowed(token, payload.role)
  return NextResponse.json({ allowed })
}
