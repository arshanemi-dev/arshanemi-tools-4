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
