import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { updateOneTemplate } from '@/lib/listingTemplateOps'

// Body: { templates: [{ templateId, ... same shape the singular PATCH
// /api/listing-tools/[templateId] takes }, ...] }. Every item is updated
// independently via Promise.all — one item's error never fails the rest of
// the batch, it just shows up as `ok: false` in that item's own result
// entry. updateOneTemplate does its own per-template access check (same
// canAccessTemplate the singular route uses), so one item can't patch a
// template the caller doesn't own just by riding along in someone else's
// batch request.
export async function PATCH(req) {
  try {
    const payload = await getAuthPayload(req)
    if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const items = Array.isArray(body?.templates) ? body.templates : []
    if (items.length === 0) return NextResponse.json({ error: 'No templates to update' }, { status: 400 })

    const results = await Promise.all(items.map(async (item) => {
      const { templateId, ...rest } = item
      if (!templateId) return { ok: false, templateId: null, error: 'Missing templateId' }
      try {
        const { template, content } = await updateOneTemplate(req, payload, templateId, rest)
        return { ok: true, templateId, template, content }
      } catch (err) {
        return { ok: false, templateId, error: err.message || 'Failed to update template' }
      }
    }))

    const updated = results.filter((r) => r.ok).length
    return NextResponse.json({ updated, failed: results.length - updated, results })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Bulk update failed' }, { status: 500 })
  }
}
