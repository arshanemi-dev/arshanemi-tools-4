import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { proxyAdminCall, authHeaderFrom } from '@/lib/connect'

// Read-only proxy to the hub's listing_template_history table (write side is
// lib/listingHistory.js's fire-and-forget recordTemplateHistory, called from
// every sheet PATCH/DELETE) — same forward-the-caller's-own-token idiom as
// assignments/me/route.js. Powers TemplateHistoryPanel.jsx on Product
// Details / Prefill Details.
export async function GET(req) {
  const payload = await getAuthPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const templateId = req.nextUrl.searchParams.get('templateId')
  const path = `/api/listing-tools/history${templateId ? `?templateId=${encodeURIComponent(templateId)}` : ''}`
  const { status, data } = await proxyAdminCall(path, { authHeader: authHeaderFrom(req) })
  return NextResponse.json(data, { status })
}
