import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import {
  getTemplateMeta, getTemplateContent, updateTemplateMeta, deleteTemplate,
  saveTemplateContent, ensureTrailingEmptyRow, detectDataType, GROUPS, templateBadgeFor,
} from '@/lib/listingTemplates'
import { recordTemplateHistory } from '@/lib/listingHistory'
import { proxyAdminCall, authHeaderFrom } from '@/lib/connect'

async function authorizeForTemplate(req, templateId) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const meta = await getTemplateMeta(templateId)
  if (!meta) return { error: NextResponse.json({ error: 'Template not found' }, { status: 404 }) }
  const inScope = payload.role === 'master_admin' || meta.companyId === (payload.companyId ?? null)
  if (!inScope) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  return { payload, meta }
}

export async function GET(req, { params }) {
  try {
    const { templateId } = await params
    const { error, meta, payload } = await authorizeForTemplate(req, templateId)
    if (error) return error
    const content = await getTemplateContent(templateId)
    return NextResponse.json({ template: { ...meta, viewerBadge: templateBadgeFor(meta, payload) }, content })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to load template' }, { status: 500 })
  }
}

// Body from the simple rename case (AutoListingRow etc.): { templateName,
// description }. Body from Template Settings' wizard editing a template's
// structure: also includes marketplaceName, category, exportVersion,
// aiRules, sheets: [{group, sheetName, sheetIndex, headers}] (no rows — the
// wizard never touches row data, see the sheets-handling block below).
export async function PATCH(req, { params }) {
  try {
    const { templateId } = await params
    const { error, meta } = await authorizeForTemplate(req, templateId)
    if (error) return error

    const body = await req.json().catch(() => ({}))
    const patch = {}
    if ('templateName' in body) patch.templateName = body.templateName
    if ('description' in body) patch.description = body.description
    if ('marketplaceName' in body) patch.marketplaceName = body.marketplaceName?.trim() || ''
    if ('category' in body) patch.category = body.category?.trim() || ''
    if ('exportVersion' in body) patch.exportVersion = body.exportVersion?.trim() || ''
    if ('aiRules' in body) patch.aiRules = body.aiRules
    if ('isAllowedToShow' in body) patch.isAllowedToShow = !!body.isAllowedToShow
    if ('marketplaceName' in body || 'category' in body || 'exportVersion' in body) {
      const mp = 'marketplaceName' in body ? body.marketplaceName : meta.marketplaceName
      const cat = 'category' in body ? body.category : meta.category
      const ver = 'exportVersion' in body ? body.exportVersion : meta.exportVersion
      patch.finalName = [mp, cat, ver].map((s) => s?.trim()).filter(Boolean).join('_')
    }

    let content
    // A structure edit from Template Settings' wizard — replaces each
    // group's headers metadata but always keeps that group's *existing*
    // rows untouched. Headers just describe what to fill in; rows are real
    // product data owned by Auto Listing / Product Details / Prefill
    // Details / Choose Your Template, which this wizard never edits. Every
    // one of the 4 groups is always written (never filtered out for having
    // 0 headers right now, unlike the create route) so a group's existing
    // rows are never dropped just because its headers were temporarily
    // empty mid-edit (e.g. while a header is being dragged to another
    // group in the Kanban board).
    if (Array.isArray(body.sheets)) {
      const existing = await getTemplateContent(templateId)
      const bySheetGroup = Object.fromEntries(body.sheets.map((s) => [s.group, s]))
      const normalizedSheets = GROUPS.map((group, i) => {
        const incoming = bySheetGroup[group]
        const existingSheet = existing.sheets.find((s) => s.group === group)
        const headers = incoming
          ? incoming.headers.map((h) => ({ ...h, dataType: h.dataType || detectDataType(h.label) }))
          : (existingSheet?.headers || [])
        return {
          sheetName: incoming?.sheetName || existingSheet?.sheetName,
          sheetIndex: incoming?.sheetIndex ?? i,
          group,
          headers,
          rows: ensureTrailingEmptyRow(headers, existingSheet?.rows || []),
        }
      })
      content = await saveTemplateContent(templateId, {
        templateId,
        sheets: normalizedSheets,
        unmappedHeaders: [],
        dropdownReference: body.dropdownReference || existing.dropdownReference,
      })
    }

    const updated = await updateTemplateMeta(templateId, patch)

    recordTemplateHistory(req, {
      templateId, templateName: updated.templateName, sheetGroup: 'template', action: 'save',
      snapshotMeta: { renamed: 'templateName' in body, structureEdited: Array.isArray(body.sheets) },
    })

    return NextResponse.json({ template: updated, ...(content ? { content } : {}) })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  try {
    const { templateId } = await params
    const { error, meta } = await authorizeForTemplate(req, templateId)
    if (error) return error

    await deleteTemplate(templateId)

    // "My Template" assignments live on the hub in their own table with no
    // FK back to this template — clean them up here so a deleted template
    // doesn't linger in anyone's sidebar/picker. Best-effort: the template
    // is already gone at this point regardless of whether this succeeds,
    // and Choose Your Template already only renders assignments that match
    // a still-existing template, so a failed cleanup here just leaves a
    // harmless orphan row rather than a broken page.
    try {
      await proxyAdminCall(`/api/listing-tools/assignments?templateId=${encodeURIComponent(templateId)}`, {
        method: 'DELETE',
        authHeader: authHeaderFrom(req),
      })
    } catch { /* non-fatal, see comment above */ }

    recordTemplateHistory(req, { templateId, templateName: meta.templateName, sheetGroup: 'template', action: 'delete' })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to delete template' }, { status: 500 })
  }
}
