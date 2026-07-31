import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import {
  getTemplateMeta, getTemplateContent, saveTemplateContent, updateTemplateMeta,
  ensureTrailingEmptyRow, findDuplicateKeys, GROUPS,
} from '@/lib/listingTemplates'
import { recordTemplateHistory } from '@/lib/listingHistory'

async function authorizeForTemplate(req, templateId) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const meta = await getTemplateMeta(templateId)
  if (!meta) return { error: NextResponse.json({ error: 'Template not found' }, { status: 404 }) }
  const inScope = payload.role === 'master_admin' || meta.companyId === (payload.companyId ?? null)
  if (!inScope) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  return { payload, meta }
}

function countFilledRows(rows) {
  return rows.filter((r) => Object.values(r).some((v) => String(v ?? '').trim())).length
}

// Debounced autosave target — one PATCH per sheet group (design_system /
// compulsory / prefill / optional). Body: { headers, rows }. Rejects with
// 409 on a duplicate templateName+designNumber (design_system) or
// templateName+brandName (prefill) — whichever header is flagged
// isUniqueKeyPart in that group.
export async function PATCH(req, { params }) {
  const { templateId, group } = await params
  if (!GROUPS.includes(group)) {
    return NextResponse.json({ error: 'Unknown sheet group' }, { status: 400 })
  }
  const { error, meta } = await authorizeForTemplate(req, templateId)
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const headers = Array.isArray(body.headers) ? body.headers : null
  const rows = Array.isArray(body.rows) ? body.rows : null
  if (!rows) return NextResponse.json({ error: 'rows[] is required' }, { status: 400 })

  const content = await getTemplateContent(templateId)
  const existing = content.sheets.find((s) => s.group === group)
  const effectiveHeaders = headers || existing?.headers || []

  const duplicates = findDuplicateKeys(meta.templateName, effectiveHeaders, rows)
  if (duplicates.length > 0) {
    return NextResponse.json({
      error: 'duplicate_key',
      message: `"${duplicates[0].label}" already exists in this template`,
      duplicates,
    }, { status: 409 })
  }

  const normalizedRows = ensureTrailingEmptyRow(effectiveHeaders, rows)
  const sheetIndex = content.sheets.findIndex((s) => s.group === group)
  const nextSheet = { ...(existing || {}), sheetName: existing?.sheetName, group, headers: effectiveHeaders, rows: normalizedRows }
  if (sheetIndex === -1) content.sheets.push(nextSheet)
  else content.sheets[sheetIndex] = nextSheet

  await saveTemplateContent(templateId, content)
  const updatedMeta = await updateTemplateMeta(templateId, {
    version: (meta.version || 1) + 1,
    rowCounts: { ...meta.rowCounts, [group]: countFilledRows(normalizedRows) },
  })

  recordTemplateHistory(req, {
    templateId, templateName: meta.templateName, sheetGroup: group, action: 'save',
    snapshotMeta: { rowCount: countFilledRows(normalizedRows) },
  })

  return NextResponse.json({ sheet: nextSheet, template: updatedMeta })
}
