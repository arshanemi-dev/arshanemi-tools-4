import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { getTemplateMeta, getTemplateContent, saveTemplateContent, updateTemplateMeta, findSimilarRows } from '@/lib/listingTemplates'
import {
  computeRowFillTargets, toTargetSpec, keyLabelsAndValues,
  buildCrossGroupFacts, buildPrompt, sanitizeGeneratedFields,
} from '@/lib/aiFillPrompt'
import { generateListingFields, uploadImageForVision, deleteUploadedFile } from '@/lib/gemini'
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

// `aiFilled` (plan §14) is a bookkeeping key, not a header id.
function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || v === undefined || v === null || String(v).trim() === '')
}
function countFilledRows(rows) {
  return rows.filter((r) => Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim())).length
}

// Per-row eligibility for a whole group — computeRowFillTargets (shared
// with the client-side "AI Fill Up" preview modal) does the actual general-
// vs-vision dedup; this just applies it row by row and drops rows with
// nothing eligible.
function planGroup(sheet, headerIds) {
  const plans = []
  sheet.rows.forEach((row, rowIndex) => {
    if (isRowEmpty(row)) return
    const { generalTargets, visionTargets, imageUrl } = computeRowFillTargets({ headers: sheet.headers, row, requestedHeaderIds: headerIds })
    if (generalTargets.length === 0 && visionTargets.length === 0) return
    plans.push({ rowIndex, generalTargets, visionTargets, imageUrl })
  })
  return plans
}

async function fetchImageBlob(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not fetch image (${res.status})`)
  const mimeType = res.headers.get('content-type') || 'image/jpeg'
  const blob = await res.blob()
  return { blob, mimeType }
}

// One Gemini call per row — general (text/dropdown) targets and vision
// (Brand/Highlights) targets combined into a single request when both apply
// (plan §12), never re-uploading the image per field. The uploaded Gemini
// file (if any) is always deleted right after, success or failure.
async function processRow({ sheet, plan, aiRules, templateContent, group, companyId }) {
  const { rowIndex, generalTargets, visionTargets, imageUrl } = plan
  const row = sheet.rows[rowIndex]
  const targetSpecs = [
    ...generalTargets.map((h) => toTargetSpec(h)),
    ...visionTargets.map((h) => toTargetSpec(h, { vision: true })),
  ]
  if (targetSpecs.length === 0) return { rowIndex, fields: {} }

  const { matchLabels, matchValues } = keyLabelsAndValues(sheet.headers, row)
  const [similarRows] = await Promise.all([findSimilarRows({ companyId, group, matchLabels, matchValues })])
  const crossGroupFacts = buildCrossGroupFacts({ templateContent, group, matchLabels, matchValues })
  const { systemInstruction, promptText } = buildPrompt({ aiRules, headers: sheet.headers, row, targets: targetSpecs, similarRows, crossGroupFacts })

  let imagePart = null
  let uploadedFileName = null
  try {
    if (visionTargets.length > 0 && imageUrl) {
      const { blob, mimeType } = await fetchImageBlob(imageUrl)
      const file = await uploadImageForVision(blob, mimeType)
      imagePart = { fileUri: file.uri, mimeType: file.mimeType }
      uploadedFileName = file.name
    }
    const raw = await generateListingFields({ systemInstruction, promptText, imagePart, targets: targetSpecs })
    return { rowIndex, fields: sanitizeGeneratedFields(raw, targetSpecs) }
  } catch (err) {
    return { rowIndex, error: err.message || 'AI generation failed' }
  } finally {
    if (uploadedFileName) await deleteUploadedFile(uploadedFileName)
  }
}

// POST body: { selections: [{ group, headerIds, rows? }], dryRun?, persist? }.
// dryRun=true: no Gemini calls, no persistence — just the row counts the
// client needs to run its two pre-flight billing-gate calls (plan §13).
//
// `rows` (optional, per selection) lets a caller hand over row data
// directly instead of this route reading `sheet.rows` from Blob storage —
// used by the Auto Listing workspace (app/listing-tools/auto-details), whose
// rows live purely in client-side session state until an explicit
// Save/Download, never auto-persisted. Headers/schema/dropdown rules always
// come from the server's own stored sheet regardless (never trusted from
// the client) — only the row *values* can be client-provided.
//
// `persist` (default true) controls whether a successful run writes back to
// Blob JSON at all. Product Details/Prefill Details never set this (their
// rows are already the server's own persisted copy, so filling them and
// saving is the same "edit" every other cell edit on those pages already
// does). Auto Listing explicitly sets `persist: false` — the whole point of
// that page is nothing reaches the database before an explicit Save/
// Download, and AI Fill Up must not silently violate that. Either way, the
// response always includes each row's resolved `fields` so the caller can
// merge them into whatever local state it's keeping (Blob-backed content or
// client-only session rows) — persistence and "where do the results go" are
// independent concerns.
export async function POST(req, { params }) {
  const { templateId } = await params
  const { error, meta: initialMeta } = await authorizeForTemplate(req, templateId)
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const selections = Array.isArray(body.selections) ? body.selections : null
  if (!selections?.length) return NextResponse.json({ error: 'selections[] is required' }, { status: 400 })
  const persist = body.persist !== false

  const content = await getTemplateContent(templateId)
  const companyId = initialMeta.companyId ?? null

  // Recompute plans for every selection up front — shared by dryRun and the
  // real run so their row counts can never drift apart.
  const groupPlans = []
  for (const sel of selections) {
    const sheet = content.sheets.find((s) => s.group === sel.group)
    if (!sheet) continue
    const sourceRows = Array.isArray(sel.rows) ? sel.rows : sheet.rows
    const effectiveSheet = { ...sheet, rows: sourceRows }
    const plans = planGroup(effectiveSheet, Array.isArray(sel.headerIds) ? sel.headerIds : null)
    if (plans.length > 0) groupPlans.push({ group: sel.group, sheet: effectiveSheet, plans })
  }

  if (body.dryRun) {
    let textFillRowCount = 0
    let imageFillRowCount = 0
    for (const { plans } of groupPlans) {
      for (const p of plans) {
        if (p.generalTargets.length > 0) textFillRowCount++
        if (p.visionTargets.length > 0) imageFillRowCount++
      }
    }
    return NextResponse.json({ textFillRowCount, imageFillRowCount })
  }

  let meta = initialMeta
  const results = []
  for (const { group, sheet, plans } of groupPlans) {
    const nextRows = [...sheet.rows]
    let filledRows = 0
    let skippedRows = 0
    const errors = []
    const rowResults = []

    for (const plan of plans) {
      const result = await processRow({ sheet, plan, aiRules: meta.aiRules, templateContent: content, group, companyId })
      if (result.error) { errors.push({ rowIndex: result.rowIndex, message: result.error }); skippedRows++; continue }
      if (Object.keys(result.fields).length === 0) { skippedRows++; continue }
      const row = nextRows[result.rowIndex]
      // Defense in depth: computeRowFillTargets already excludes any header
      // that has a value at plan time, but this re-checks the row's
      // *current* value right before merging too — nothing here can ever
      // overwrite a field that's already filled, no matter what Gemini
      // returned.
      const toApply = Object.fromEntries(Object.entries(result.fields).filter(([k]) => !String(row[k] ?? '').trim()))
      if (Object.keys(toApply).length === 0) { skippedRows++; continue }
      rowResults.push({ rowIndex: result.rowIndex, fields: toApply })
      if (persist) {
        const nextAiFilled = Array.from(new Set([...(row.aiFilled || []), ...Object.keys(toApply)]))
        nextRows[result.rowIndex] = { ...row, ...toApply, aiFilled: nextAiFilled }
      }
      filledRows++
    }

    if (persist && filledRows > 0) {
      const sheetIndex = content.sheets.findIndex((s) => s.group === group)
      content.sheets[sheetIndex] = { ...content.sheets[sheetIndex], rows: nextRows }
      await saveTemplateContent(templateId, content)
      meta = await updateTemplateMeta(templateId, {
        version: (meta.version || 1) + 1,
        rowCounts: { ...meta.rowCounts, [group]: countFilledRows(nextRows) },
      })
    }
    if (filledRows > 0) {
      recordTemplateHistory(req, {
        templateId, templateName: meta.templateName, sheetGroup: group,
        action: persist ? 'ai_autofill_bulk' : 'ai_autofill_bulk_preview',
        snapshotMeta: { filledRows, skippedRows, errorCount: errors.length },
      })
    }

    results.push({ group, filledRows, skippedRows, errors, rows: rowResults })
  }

  return NextResponse.json({ results })
}
