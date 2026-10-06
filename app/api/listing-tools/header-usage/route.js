import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { listTemplates, getTemplateContent } from '@/lib/listingStore'

// Which fields the caller's own saved templates have — read by the bulk
// mapping page right before it deletes an Our Header, so it can warn when
// that header is already mapped into templates (BulkTemplateDesign.jsx's
// checkHeaderUsage). A template's fields are copies made from Our Headers
// at save time: each carries the Our Header's name, and — when saved by the
// mapping page since ids were kept — its id (`ourHeaderId`).
//
// Own templates only: Our Headers is a per-owner dictionary, so another
// owner's template having a field of the same name says nothing about this
// caller's header.
//
// → { templates: [{ id, templateName, headers: [{ label, ourHeaderId }] }],
//     unreadable }  — `unreadable` counts templates whose content couldn't
// be loaded, so the caller knows the answer isn't complete.

// Template content is one storage read each — a few at a time, not all at once.
const READS_AT_ONCE = 5

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }))
  return out
}

export async function GET(req) {
  try {
    const payload = await getAuthPayload(req)
    if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const metas = await listTemplates({ ownerUserId: payload.userId })
    let unreadable = 0
    const read = await mapLimit(metas, READS_AT_ONCE, async (meta) => {
      try {
        const content = await getTemplateContent(meta.id)
        const headers = (content.sheets || []).flatMap((s) => (s.headers || []).map((h) => ({ label: h.label, ourHeaderId: h.ourHeaderId || null })))
        return { id: meta.id, templateName: meta.templateName, headers }
      } catch {
        unreadable += 1
        return null
      }
    })
    return NextResponse.json({ templates: read.filter(Boolean), unreadable })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to check header usage' }, { status: 500 })
  }
}
