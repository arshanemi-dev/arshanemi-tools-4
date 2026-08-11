import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { getTemplateMeta, getTemplateContent, canAccessTemplate } from '@/lib/listingTemplates'
import { runServerBillingGate } from '@/lib/serverBilling'

// Billing-only endpoint for Download/Export. The file itself is generated
// entirely client-side (lib/exports/listingExport.js's downloadExcel/
// downloadExcelSmart/downloadPdf — no server round trip for the actual
// bytes), so this is the one place the 'listing-export' coin charge can be
// guaranteed to fire the same way regardless of which page's Download
// button triggered it (Product Details, Prefill Details, Auto Listing all
// call this identically) — mirrors ai-fill-bulk/route.js's own move to
// server-side billing, for the same reason: a client-side-only pre-flight
// is one missed call site away from silently never charging anyone.
//
// Quantity is recomputed here from the server's own persisted content, never
// trusted from the client — same "server owns the count" rule ai-fill-bulk
// already follows. Body: { groups: string[] } — which sheet groups are being
// exported; defaults to all four if omitted.
//
// `aiFilled` (plan §14) is a bookkeeping key, not a header id — excluded so
// it can never make an otherwise-blank row count as "filled" (mirrors every
// other copy of this check across the app).
//
// Deliberately NOT expanded through expandMultiSelectRows here — that
// explodes one row into N rows (one per Multi Select option) for the
// *exported file*, which is correct for the file but wrong for billing:
// filling in one product row with a 4-option Multi Select field isn't 4
// billable products, it's 1. Billing counts what the user actually typed
// (real rows), not how many lines that expands to in the spreadsheet.
function countBillableRows(content, groups) {
  const primary = groups.includes('design_system') ? 'design_system' : groups[0]
  const sheet = (content.sheets || []).find((s) => s.group === primary)
  if (!sheet) return 0
  return (sheet.rows || []).filter((row) => Object.entries(row).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim())).length
}

export async function POST(req, { params }) {
  const { templateId } = await params
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = await getTemplateMeta(templateId)
  if (!meta) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  if (!canAccessTemplate(meta, payload)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const groups = Array.isArray(body.groups) && body.groups.length
    ? body.groups
    : ['design_system', 'compulsory', 'prefill', 'optional']

  const content = await getTemplateContent(templateId)
  const quantity = countBillableRows(content, groups) || 1

  const gate = await runServerBillingGate(req, { toolSlug: 'listing-tools', featureApiIdentifier: 'listing-export', quantity })
  if (gate.status === 'blocked') {
    return NextResponse.json({ blocked: true, reason: gate.reason, data: gate.data }, { status: 402 })
  }
  return NextResponse.json({ ok: true, quantity, ...gate.data })
}
