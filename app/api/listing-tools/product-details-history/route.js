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
// Client-callable delete for one product's mirrored hub row — the write-side counterpart to the
// read-only GET above. Product Details' own delete already reaches this indirectly (via the
// sheets/[group] PATCH route's own before/after key diff), but Auto Details' delete is
// session-only and never hits that route at all, so it needs a direct way to clean up the hub
// mirror too — otherwise a product pulled into session via Product Group auto-fill (this same
// route's own `groupName` branch) would keep resurfacing after being "deleted" from the session.
// Idempotent: deleting a product number that was never actually synced here is just a 0-row
// no-op on the hub side.
export async function DELETE(req) {
  const payload = await getAuthPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const templateId = sp.get('templateId')
  const productNumber = sp.get('productNumber')
  if (!templateId || !productNumber) {
    return NextResponse.json({ error: 'templateId and productNumber are required' }, { status: 400 })
  }
  const qs = new URLSearchParams({ templateId, productNumber }).toString()
  const { status, data } = await proxyAdminCall(`/api/listing-tools/product-details-history?${qs}`, {
    method: 'DELETE',
    authHeader: authHeaderFrom(req),
  })
  return NextResponse.json(data, { status })
}

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
