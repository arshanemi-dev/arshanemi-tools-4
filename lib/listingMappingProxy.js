// Thin-proxy helper for every route under app/api/listing-tools/mapping/**,
// /versions/**, /logs — this app never holds Supabase credentials directly,
// so the mass-mapping/versioning tables live in the hub
// (arshanemi-admin-pannels) and these routes just forward onto its matching
// /api/listing-tools/** route (see the hub's lib/db.js "Listing Tools
// mapping" section). Wraps lib/connect.js's proxyAdminCall so every route
// file here is a one-line call instead of repeating the {ok,status,data} →
// NextResponse dance 13 times.
//
// Every one of these routes belongs to the Template Settings section, so the
// forward only happens for someone that section is enabled for (see
// lib/listingTemplateAccess.js) — the page-level gate alone never stopped a
// direct API call.
import { NextResponse } from 'next/server'
import { getAuthPayload } from './auth'
import { proxyAdminCall, authHeaderFrom } from './connect'
import { requestMayUseTemplateSettings, TEMPLATE_SETTINGS_DENIED } from './listingTemplateAccess'

export async function proxyMapping(req, path, { method = 'GET', body } = {}) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requestMayUseTemplateSettings(req, payload))) {
    return NextResponse.json({ error: TEMPLATE_SETTINGS_DENIED }, { status: 403 })
  }
  const { ok, status, data } = await proxyAdminCall(path, { method, body, authHeader: authHeaderFrom(req) })
  return NextResponse.json(data, { status: ok ? status : status || 500 })
}
