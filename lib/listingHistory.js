import { authHeaderFrom } from './connect'

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || ''

// Fire-and-forget free-action history log to the hub's
// listing_template_history table (per plan §3a/§7d) — tools-4 has no
// relational DB of its own to hold this. Awaited (with a short timeout) so
// the write actually happens before a serverless function instance is
// recycled, but every failure is swallowed: a hub outage must never break a
// template save, which is the whole point of this being "free-action
// bookkeeping" rather than part of the save transaction itself.
export async function recordTemplateHistory(req, { templateId, templateName, sheetGroup, action = 'save', snapshotMeta }) {
  if (!ADMIN_URL) return
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    await fetch(`${ADMIN_URL}/api/listing-tools/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeaderFrom(req) ? { Authorization: authHeaderFrom(req) } : {}),
      },
      body: JSON.stringify({ templateId, templateName, sheetGroup, action, snapshotMeta }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
  } catch {
    // best-effort only — never surfaces to the caller
  }
}

// Bulk-upserts real row data (not just a save-event log) to the hub's
// listing_product_details_history / listing_prefill_details_history tables —
// a synced, queryable copy of what sheets/[group]/route.js just wrote to
// Blob JSON, which stays the source of truth for the live grid/auto-fill/
// export (see the migration's own header comment for the full rationale).
// Same best-effort, fire-and-forget contract as recordTemplateHistory above.
async function syncHistory(req, path, body) {
  if (!ADMIN_URL || !body.rows.length) return
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    await fetch(`${ADMIN_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeaderFrom(req) ? { Authorization: authHeaderFrom(req) } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
  } catch {
    // best-effort only — never surfaces to the caller
  }
}

// `rows`: [{ productNumber, rowData }] — already scoped by the caller to
// this request's own userId (design_system group only).
export async function syncProductDetailsHistory(req, { templateId, templateName, rows }) {
  await syncHistory(req, '/api/listing-tools/product-details-history', { templateId, templateName, rows })
}

// `rows`: [{ brand, rowData }] — already scoped by the caller to this
// request's own userId (prefill group only).
export async function syncPrefillDetailsHistory(req, { templateId, templateName, rows }) {
  await syncHistory(req, '/api/listing-tools/prefill-details-history', { templateId, templateName, rows })
}
