import { proxyMapping } from '@/lib/listingMappingProxy'
import { getTemplateMeta } from '@/lib/listingStore'
import { countHeaders } from '@/lib/templateLogDiff'

// What a version captures beyond its header structure — the template's
// name/rules/categories as they stood at save time. The Template Settings
// list shows these on each older version row (instead of today's values).
const SNAPSHOT_META_KEYS = [
  'templateName', 'finalName', 'description', 'marketplaceName',
  'category1', 'category2', 'category3', 'category4', 'category5', 'category6',
  'exportVersion', 'aiRules',
]

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  return proxyMapping(req, `/api/listing-tools/versions?${searchParams.toString()}`)
}

// Stamps snapshot.meta (plus templateName/templateNumber/marketplaceName
// for the hub's log entry) here, server-side, so every caller gets it without having to build
// it — callers only send { templateId, snapshot: { sheets } }. Best-effort:
// right after a create, the template store can still serve a stale list
// without the new row (see listingTemplateOps.js's createOneTemplate), in
// which case the version just goes through with headerCount only and the
// list falls back to the template's current values — identical anyway for
// a brand-new template's first version.
export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const meta = body.templateId ? await getTemplateMeta(body.templateId).catch(() => null) : null
  const captured = meta ? Object.fromEntries(SNAPSHOT_META_KEYS.map((k) => [k, meta[k] ?? null])) : {}
  const enriched = {
    ...body,
    templateName: body.templateName || meta?.templateName || null,
    templateNumber: body.templateNumber || meta?.templateNumber || null,
    marketplaceName: body.marketplaceName || meta?.marketplaceName || null,
    snapshot: {
      ...(body.snapshot || {}),
      meta: { ...captured, headerCount: countHeaders(body.snapshot?.sheets), ...(body.snapshot?.meta || {}) },
    },
  }
  return proxyMapping(req, '/api/listing-tools/versions', { method: 'POST', body: enriched })
}
