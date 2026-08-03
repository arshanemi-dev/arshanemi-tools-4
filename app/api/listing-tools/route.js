import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { listTemplates, createTemplateMeta, saveTemplateContent, ensureTrailingEmptyRow, detectDataType } from '@/lib/listingTemplates'
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
  try {
    const { payload, error } = await authorize(req)
    if (error) return error
    const companyId = payload.role === 'master_admin' ? undefined : (payload.companyId ?? null)
    const templates = await listTemplates({ companyId })
    return NextResponse.json({ templates })
  } catch (err) {
    // Any unhandled throw here (e.g. a Blob storage/env issue) previously
    // reached the client as a body-less error response, which crashes
    // `res.json()` with "Unexpected end of JSON input" — always return JSON.
    return NextResponse.json({ error: err.message || 'Failed to load templates' }, { status: 500 })
  }
}

// Body comes from TemplateSettingsWizard: { templateName, description,
// sourceFileName, sheets: [{sheetName, group, headers, rows}], dropdownReference }
export async function POST(req) {
  try {
    const { payload, error } = await authorize(req)
    if (error) return error

    const body = await req.json().catch(() => null)
    if (!body?.templateName?.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }
    if (!Array.isArray(body.sheets) || body.sheets.length === 0) {
      return NextResponse.json({ error: 'At least one mapped sheet is required' }, { status: 400 })
    }

    // Computed before createTemplateMeta on purpose: rowCounts only depends
    // on body.sheets, not on the template having been created yet. Baking it
    // into the one create write means there's no follow-up read-then-update
    // of the same templates-list row — that follow-up (a separate
    // updateTemplateMeta call right after create) used to race Vercel
    // Blob's read-after-write consistency: it re-reads the whole templates
    // list right after createTemplateMeta wrote it, and could get a stale
    // copy that didn't have the just-created row yet, throwing "Template
    // not found" on a template's very first save.
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
    const rowCounts = Object.fromEntries(normalizedSheets.map((s) => [s.group, countFilledRows(s.rows)]))

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
      rowCounts,
    })

    const content = await saveTemplateContent(meta.id, {
      templateId: meta.id,
      sheets: normalizedSheets,
      unmappedHeaders: [],
      dropdownReference: body.dropdownReference || { sheetName: null, columns: {} },
    })

    recordTemplateHistory(req, {
      templateId: meta.id,
      templateName: meta.templateName,
      sheetGroup: 'template',
      action: 'save',
      snapshotMeta: { rowCounts },
    })

    return NextResponse.json({ template: meta, content })
  } catch (err) {
    // Same reasoning as GET — createTemplateMeta/saveTemplateContent hit
    // Vercel Blob directly with no try/catch of their own (writeBlobJson
    // isn't wrapped like readBlobJson is), so a storage hiccup here used to
    // surface as a body-less response and a confusing client-side crash.
    return NextResponse.json({ error: err.message || 'Failed to save template' }, { status: 500 })
  }
}
