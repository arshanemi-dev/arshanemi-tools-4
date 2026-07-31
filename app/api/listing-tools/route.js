import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { listTemplates, createTemplateMeta, updateTemplateMeta, saveTemplateContent, ensureTrailingEmptyRow, detectDataType } from '@/lib/listingTemplates'
import { recordTemplateHistory } from '@/lib/listingHistory'

async function authorize(req) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { payload }
}

function countFilledRows(rows) {
  return rows.filter((r) => Object.values(r).some((v) => String(v ?? '').trim())).length
}

// master_admin sees every company's templates (mirrors the settings-access
// grant model); every other role only ever sees its own company's — there
// is no cross-company sharing (see plan's "Other assumptions").
export async function GET(req) {
  const { payload, error } = await authorize(req)
  if (error) return error
  const companyId = payload.role === 'master_admin' ? undefined : (payload.companyId ?? null)
  const templates = await listTemplates({ companyId })
  return NextResponse.json({ templates })
}

// Body comes from TemplateSettingsWizard: { templateName, description,
// sourceFileName, sheets: [{sheetName, group, headers, rows}], dropdownReference }
export async function POST(req) {
  const { payload, error } = await authorize(req)
  if (error) return error

  const body = await req.json().catch(() => null)
  if (!body?.templateName?.trim()) {
    return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
  }
  if (!Array.isArray(body.sheets) || body.sheets.length === 0) {
    return NextResponse.json({ error: 'At least one mapped sheet is required' }, { status: 400 })
  }

  const meta = await createTemplateMeta({
    templateName: body.templateName,
    description: body.description,
    companyId: payload.companyId ?? null,
    ownerUserId: payload.userId,
    ownerUserName: payload.name,
    sourceFileName: body.sourceFileName,
    marketplaceName: body.marketplaceName,
    category: body.category,
    exportVersion: body.exportVersion,
    aiRules: body.aiRules,
  })

  const normalizedSheets = body.sheets.map((s, i) => {
    const headers = (s.headers || []).map((h) => ({ ...h, dataType: h.dataType || detectDataType(h.label) }))
    return {
      sheetName: s.sheetName,
      sheetIndex: s.sheetIndex ?? i,
      group: s.group,
      headers,
      rows: ensureTrailingEmptyRow(headers, s.rows || []),
    }
  })

  const content = await saveTemplateContent(meta.id, {
    templateId: meta.id,
    sheets: normalizedSheets,
    unmappedHeaders: [],
    dropdownReference: body.dropdownReference || { sheetName: null, columns: {} },
  })

  const rowCounts = Object.fromEntries(normalizedSheets.map((s) => [s.group, countFilledRows(s.rows)]))
  const updatedMeta = await updateTemplateMeta(meta.id, { rowCounts })

  recordTemplateHistory(req, {
    templateId: meta.id,
    templateName: meta.templateName,
    sheetGroup: 'template',
    action: 'save',
    snapshotMeta: { rowCounts },
  })

  return NextResponse.json({ template: updatedMeta, content })
}
