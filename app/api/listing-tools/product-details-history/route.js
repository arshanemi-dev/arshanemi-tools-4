import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { proxyAdminCall, authHeaderFrom } from '@/lib/connect'

// Read-only proxy to the hub's listing_product_details_history table — real
// per-product-number rows (write side: lib/listingHistory.js's
// syncProductDetailsHistory, fired from the /export route's merge step, see
// scripts/listing_product_prefill_history_migration.sql). Same
// forward-the-caller's-own-token idiom as history/route.js. `templateId` is
// optional — omitted, the hub returns this user's Product Details saves
// across every template they own, which is what app/listing-tools/history's
// cross-template view uses.
//
// `groupsOnly`/`groupName` are the same Product Group lookups the Auto
// Details page's group selector needs (distinct group names, then a
// group's member product numbers + their default row data) — forwarded
// straight through to the hub's listing_product_groups-backed branches, see
// scripts/listing_product_groups_migration.sql.
export async function GET(req) {
  const payload = await getAuthPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const forward = new URLSearchParams()
  for (const key of ['templateId', 'groupsOnly', 'groupName']) {
    const v = sp.get(key)
    if (v) forward.set(key, v)
  }
  const qs = forward.toString()
  const path = `/api/listing-tools/product-details-history${qs ? `?${qs}` : ''}`
  const { status, data } = await proxyAdminCall(path, { authHeader: authHeaderFrom(req) })
  return NextResponse.json(data, { status })
}
