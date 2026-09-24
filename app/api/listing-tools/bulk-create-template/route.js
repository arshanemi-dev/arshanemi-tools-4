import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { createOneTemplate } from '@/lib/listingTemplateOps'

// Body: { templates: [{ clientId, templateName, ... same shape the
// singular POST /api/listing-tools takes }, ...] } — `clientId` is
// whatever the caller wants back to correlate a result to its own local
// state (BulkTemplateDesign.jsx sends the upload session's own file_...id).
// Every item is created independently via Promise.all — one item's error
// never fails the rest of the batch, it just shows up as `ok: false` in
// that item's own result entry.
export async function POST(req) {
  try {
    const payload = await getAuthPayload(req)
    if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const items = Array.isArray(body?.templates) ? body.templates : []
    if (items.length === 0) return NextResponse.json({ error: 'No templates to create' }, { status: 400 })

    const results = await Promise.all(items.map(async (item) => {
      try {
        const { template, content } = await createOneTemplate(req, payload, item)
        return { ok: true, clientId: item.clientId ?? null, template, content }
      } catch (err) {
        return { ok: false, clientId: item.clientId ?? null, error: err.message || 'Failed to create template' }
      }
    }))

    const created = results.filter((r) => r.ok).length
    return NextResponse.json({ created, failed: results.length - created, results })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Bulk create failed' }, { status: 500 })
  }
}
