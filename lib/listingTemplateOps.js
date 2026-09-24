// Shared single-template create/update logic — used by both the singular
// routes (app/api/listing-tools/route.js POST, [templateId]/route.js PATCH)
// and the bulk ones (bulk-create-template, bulk-update-template), so a fix
// here fixes both call sites instead of two near-identical copies drifting
// apart. Each function throws on failure (caller decides how to report it —
// a single 4xx for the singular routes, one `results[i].error` entry that
// doesn't fail the rest of the batch for the bulk routes).
import {
  createTemplateMeta, updateTemplateMeta, saveTemplateContent, getTemplateMeta, getTemplateContent, canAccessTemplate,
} from '@/lib/listingStore'
import { ensureTrailingEmptyRow, detectDataType, GROUPS } from '@/lib/listingTemplates'
import { recordTemplateHistory, recordTemplateLog } from '@/lib/listingHistory'
import { buildTemplateCreateLog, buildTemplateUpdateLog } from '@/lib/templateLogDiff'

// `aiFilled` (plan §14) is a bookkeeping key, not a header id — excluded so
// it can never make an otherwise-blank row count as "filled".
function countFilledRows(rows) {
  return rows.filter((r) => Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim())).length
}

// Body shape: { templateName, description, sourceFileName, sourceFileUrl,
// sourceSheetName, marketplaceName, category1-6, exportVersion, finalName,
// aiRules, sheets: [{sheetName, sheetIndex, group, headers, rows}],
// dropdownReference }.
export async function createOneTemplate(req, payload, body) {
  if (!body?.templateName?.trim()) throw new Error('Template name is required')
  if (!Array.isArray(body.sheets) || body.sheets.length === 0) throw new Error('At least one mapped sheet is required')

  // Computed before createTemplateMeta on purpose — see the original
  // route's own comment: baking rowCounts into the one create write avoids
  // a follow-up read-then-update racing Vercel Blob's read-after-write
  // consistency on a template's very first save.
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
    ownerRole: payload.role,
    sourceFileName: body.sourceFileName,
    sourceFileUrl: body.sourceFileUrl,
    sourceSheetName: body.sourceSheetName,
    marketplaceName: body.marketplaceName,
    category1: body.category1,
    category2: body.category2,
    category3: body.category3,
    category4: body.category4,
    category5: body.category5,
    category6: body.category6,
    exportVersion: body.exportVersion,
    finalName: body.finalName,
    aiRules: body.aiRules,
    rowCounts,
  })

  const content = await saveTemplateContent(meta.id, {
    templateId: meta.id,
    sheets: normalizedSheets,
    unmappedHeaders: [],
    dropdownReference: body.dropdownReference || { sheetName: null, columns: {} },
  })

  await recordTemplateHistory(req, {
    templateId: meta.id,
    templateName: meta.templateName,
    sheetGroup: 'template',
    action: 'save',
    snapshotMeta: { rowCounts },
  })
  // Template Logs audit entry — best-effort, same contract as the history
  // write above (never fails the save).
  await recordTemplateLog(req, meta.id, buildTemplateCreateLog(meta, normalizedSheets))

  return { template: meta, content }
}

// Body shape: same fields as createOneTemplate, all optional (only sent
// keys get patched) — plus `sheets` in the wizard's structure-edit shape
// (no `rows`, see the original route's own comment on why rows are never
// touched here).
export async function updateOneTemplate(req, payload, templateId, body) {
  const meta = await getTemplateMeta(templateId)
  if (!meta) throw new Error('Template not found')
  if (!canAccessTemplate(meta, payload)) throw new Error('Unauthorized for this template')

  const patch = {}
  if ('templateName' in body) patch.templateName = body.templateName
  if ('description' in body) patch.description = body.description
  if ('marketplaceName' in body) patch.marketplaceName = body.marketplaceName?.trim() || ''
  if ('category1' in body) patch.category1 = body.category1?.trim() || ''
  if ('category2' in body) patch.category2 = body.category2?.trim() || ''
  if ('category3' in body) patch.category3 = body.category3?.trim() || ''
  if ('category4' in body) patch.category4 = body.category4?.trim() || ''
  if ('category5' in body) patch.category5 = body.category5?.trim() || ''
  if ('category6' in body) patch.category6 = body.category6?.trim() || ''
  if ('exportVersion' in body) patch.exportVersion = body.exportVersion?.trim() || ''
  if ('aiRules' in body) patch.aiRules = body.aiRules
  if ('isAllowedToShow' in body) patch.isAllowedToShow = !!body.isAllowedToShow
  if ('finalName' in body) {
    patch.finalName = body.finalName?.trim() || ''
  } else if ('marketplaceName' in body || 'category1' in body || 'exportVersion' in body) {
    const mp = 'marketplaceName' in body ? body.marketplaceName : meta.marketplaceName
    const cat = 'category1' in body ? body.category1 : meta.category1
    const ver = 'exportVersion' in body ? body.exportVersion : meta.exportVersion
    patch.finalName = [mp, cat, ver].map((s) => s?.trim()).filter(Boolean).join('_')
  }

  let content
  let headerDiff = {} // { beforeSheets, afterSheets } for the Template Logs entry, structure edits only
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
    headerDiff = { beforeSheets: existing.sheets, afterSheets: normalizedSheets }
  }

  const updated = await updateTemplateMeta(templateId, patch)

  await recordTemplateHistory(req, {
    templateId, templateName: updated.templateName, sheetGroup: 'template', action: 'save',
    snapshotMeta: { renamed: 'templateName' in body, structureEdited: Array.isArray(body.sheets) },
  })
  // Template Logs audit entry — null (nothing written) when the PATCH
  // didn't actually change anything, e.g. bulk-save re-sending an
  // untouched template.
  await recordTemplateLog(req, templateId, buildTemplateUpdateLog(meta, updated, headerDiff))

  return { template: updated, ...(content ? { content } : {}) }
}
