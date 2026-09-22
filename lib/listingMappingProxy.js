// Thin-proxy helper for every route under app/api/listing-tools/mapping/**,
// /versions/**, /logs — this app never holds Supabase credentials directly,
// so the mass-mapping/versioning tables live in the hub
// (arshanemi-admin-pannels) and these routes just forward onto its matching
// /api/listing-tools/** route (see the hub's lib/db.js "Listing Tools
// mapping" section). Wraps lib/connect.js's proxyAdminCall so every route
// file here is a one-line call instead of repeating the {ok,status,data} →
// NextResponse dance 13 times.
import { NextResponse } from 'next/server'
import { proxyAdminCall, authHeaderFrom } from './connect'

export async function proxyMapping(req, path, { method = 'GET', body } = {}) {
  const { ok, status, data } = await proxyAdminCall(path, { method, body, authHeader: authHeaderFrom(req) })
  return NextResponse.json(data, { status: ok ? status : status || 500 })
}
