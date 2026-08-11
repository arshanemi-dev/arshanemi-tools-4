import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import {
  getTemplateMeta, getTemplateContent, saveTemplateContent, updateTemplateMeta,
  ensureTrailingEmptyRow, upsertRowsByOwner, GROUPS, canAccessTemplate,
} from '@/lib/listingTemplates'
import { recordTemplateHistory } from '@/lib/listingHistory'

async function authorizeForTemplate(req, templateId) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const meta = await getTemplateMeta(templateId)
  if (!meta) return { error: NextResponse.json({ error: 'Template not found' }, { status: 404 }) }
  if (!canAccessTemplate(meta, payload)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  return { payload, meta }
}

// `aiFilled` (plan §14) is a bookkeeping key, not a header id — excluded so
// it can never make an otherwise-blank row count as "filled".
function countFilledRows(rows) {
  return rows.filter((r) => Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim())).length
}

// Debounced autosave target — one PATCH per sheet group (design_system /
// compulsory / prefill / optional). Body: { headers, rows }. Bulk upserts by
// whichever header is flagged isUniqueKeyPart in that group (Product Number
// for design_system, Brand for prefill): a submitted row whose key matches
// an already-saved row **owned by the same user** updates that row in
// place; anything else is created new — never rejected with a 409. See
// upsertRowsByOwner's own comment for the per-user scoping rules.
export async function PATCH(req, { params }) {
  const { templateId, group } = await params
  if (!GROUPS.includes(group)) {
    return NextResponse.json({ error: 'Unknown sheet group' }, { status: 400 })
  }
  const { error, meta, payload } = await authorizeForTemplate(req, templateId)
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const headers = Array.isArray(body.headers) ? body.headers : null
  const rows = Array.isArray(body.rows) ? body.rows : null
  if (!rows) return NextResponse.json({ error: 'rows[] is required' }, { status: 400 })

  const content = await getTemplateContent(templateId)
  const existing = content.sheets.find((s) => s.group === group)
  const effectiveHeaders = headers || existing?.headers || []

  const upserted = upsertRowsByOwner(payload.userId, effectiveHeaders, rows)
  const normalizedRows = ensureTrailingEmptyRow(effectiveHeaders, upserted)
  const sheetIndex = content.sheets.findIndex((s) => s.group === group)
  const nextSheet = { ...(existing || {}), sheetName: existing?.sheetName, group, headers: effectiveHeaders, rows: normalizedRows }
  if (sheetIndex === -1) content.sheets.push(nextSheet)
  else content.sheets[sheetIndex] = nextSheet

  await saveTemplateContent(templateId, content)
  const updatedMeta = await updateTemplateMeta(templateId, {
    version: (meta.version || 1) + 1,
    rowCounts: { ...meta.rowCounts, [group]: countFilledRows(normalizedRows) },
  })

  await recordTemplateHistory(req, {
    templateId, templateName: meta.templateName, sheetGroup: group, action: 'save',
    snapshotMeta: { rowCount: countFilledRows(normalizedRows) },
  })

  return NextResponse.json({ sheet: nextSheet, template: updatedMeta })
}
