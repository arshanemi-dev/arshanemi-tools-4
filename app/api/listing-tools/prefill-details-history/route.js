import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { proxyAdminCall, authHeaderFrom } from '@/lib/connect'

// Read-only proxy to the hub's listing_prefill_details_history table — real
// per-brand rows (write side: lib/listingHistory.js's syncPrefillDetailsHistory,
// fired from the /export route's merge step, see
// scripts/listing_product_prefill_history_migration.sql). Same
// forward-the-caller's-own-token idiom as history/route.js. `templateId` is
// optional — omitted, the hub returns this user's Prefill Details saves
// across every template they own, which is what app/listing-tools/history's
// cross-template view uses.
export async function GET(req) {
  const payload = await getAuthPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const templateId = req.nextUrl.searchParams.get('templateId')
  const path = `/api/listing-tools/prefill-details-history${templateId ? `?templateId=${encodeURIComponent(templateId)}` : ''}`
  const { status, data } = await proxyAdminCall(path, { authHeader: authHeaderFrom(req) })
  return NextResponse.json(data, { status })
}
