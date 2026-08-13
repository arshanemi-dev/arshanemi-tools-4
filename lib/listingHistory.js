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

// Snapshots a row keyed by header LABEL, not id — ids are generated per-template
// (hdr_..._default_N) and never portable across templates. Label is the only
// cross-template-stable identifier a saved row_data snapshot can be matched back
// against later (see the Auto Details Group selector, historyFill.js's
// rowFromLabelKeyed, the inverse of this). Formula headers are skipped — same
// "never a copy source" rule as backfillEmptyFields/propagateFromGroup.
// Bookkeeping keys (userId, aiFilled, sku) aren't header ids and pass through
// unchanged so existing consumers (history/page.js's row_data.sku) keep working.
export function toLabelKeyedRow(headers, row) {
  const out = { userId: row.userId, aiFilled: row.aiFilled || [], sku: row.sku }
  for (const h of headers) {
    if (h.dataType === 'formula' || !h.label) continue
    out[h.label] = row[h.id]
  }
  return out
}

// `rows`: [{ productNumber, rowData, groupName }] — already scoped by the caller
// to this request's own userId (design_system group only). `rowData` is
// label-keyed (see toLabelKeyedRow above); `groupName` is the row's Product Group
// value, if the template has that default header — see listing_product_groups_migration.sql.
export async function syncProductDetailsHistory(req, { templateId, templateName, rows }) {
  await syncHistory(req, '/api/listing-tools/product-details-history', { templateId, templateName, rows })
}

// `rows`: [{ brand, rowData }] — already scoped by the caller to this
// request's own userId (prefill group only).
export async function syncPrefillDetailsHistory(req, { templateId, templateName, rows }) {
  await syncHistory(req, '/api/listing-tools/prefill-details-history', { templateId, templateName, rows })
}
