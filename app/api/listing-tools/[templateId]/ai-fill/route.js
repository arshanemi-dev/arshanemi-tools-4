import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { getTemplateMeta, getTemplateContent, findSimilarRows } from '@/lib/listingTemplates'
import {
  computeFillTargets, computeVisionTargets, toTargetSpec, keyLabelsAndValues,
  buildCrossGroupFacts, buildPrompt, sanitizeGeneratedFields,
} from '@/lib/aiFillPrompt'
import { generateListingFields } from '@/lib/gemini'
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

// Re-fetches the row's already-hosted image URL server-side and
// base64-encodes it — no raw image bytes cross through client JS beyond the
// existing upload flow (plan §8).
async function fetchImageAsBase64(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not fetch image (${res.status})`)
  const mimeType = res.headers.get('content-type') || 'image/jpeg'
  const buf = Buffer.from(await res.arrayBuffer())
  return { base64: buf.toString('base64'), mimeType }
}

// POST body: { group, rowIndex, imageHeaderId? }. `imageHeaderId` present
// only for the image-triggered vision flow (plan §6) — its target list is
// narrowed to Brand/Highlights specifically, never "any empty text header".
// Returns { fields }. Does NOT persist — the client merges the result into
// row state and the existing debounced sheets/[group] PATCH saves it, same
// as any other cell edit (plan §4). Billing is the caller's responsibility
// (useAiFill.js fires runBillingGate before this ever gets called, per
// Decision #6 — this route never checks or decides coin cost itself).
export async function POST(req, { params }) {
  const { templateId } = await params
  const { error, meta } = await authorizeForTemplate(req, templateId)
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const { group, rowIndex, imageHeaderId } = body
  if (!group || rowIndex === undefined || rowIndex === null) {
    return NextResponse.json({ error: 'group and rowIndex are required' }, { status: 400 })
  }

  const content = await getTemplateContent(templateId)
  const sheet = content.sheets.find((s) => s.group === group)
  if (!sheet) return NextResponse.json({ error: 'Unknown sheet group' }, { status: 400 })
  const row = sheet.rows[rowIndex]
  if (!row) return NextResponse.json({ error: 'Row not found' }, { status: 404 })

  let targets
  let imagePart = null
  if (imageHeaderId) {
    const imageHeader = sheet.headers.find((h) => h.id === imageHeaderId && h.dataType === 'image')
    const imageUrl = imageHeader ? row[imageHeaderId] : null
    if (!imageHeader || !imageUrl) {
      return NextResponse.json({ error: 'No image to read on that row/header' }, { status: 400 })
    }
    targets = computeVisionTargets({ headers: sheet.headers, row })
    if (targets.length === 0) return NextResponse.json({ fields: {} })
    try {
      imagePart = await fetchImageAsBase64(imageUrl)
    } catch (err) {
      return NextResponse.json({ error: err.message || 'Could not read that image' }, { status: 502 })
    }
  } else {
    targets = computeFillTargets({ headers: sheet.headers, row })
    if (targets.length === 0) return NextResponse.json({ fields: {} })
  }

  const targetSpecs = targets.map((h) => toTargetSpec(h, { vision: !!imageHeaderId }))
  const { matchLabels, matchValues } = keyLabelsAndValues(sheet.headers, row)
  const similarRows = await findSimilarRows({ companyId: meta.companyId ?? null, group, matchLabels, matchValues })
  const crossGroupFacts = buildCrossGroupFacts({ templateContent: content, group, matchLabels, matchValues })

  const { systemInstruction, promptText } = buildPrompt({
    aiRules: meta.aiRules, headers: sheet.headers, row, targets: targetSpecs, similarRows, crossGroupFacts,
  })

  let raw
  try {
    raw = await generateListingFields({ systemInstruction, promptText, imagePart, targets: targetSpecs })
  } catch (err) {
    console.error('Gemini generateListingFields failed:', err)
    return NextResponse.json({ error: 'AI generation failed — try again' }, { status: 502 })
  }

  const fields = sanitizeGeneratedFields(raw, targetSpecs)

  recordTemplateHistory(req, {
    templateId, templateName: meta.templateName, sheetGroup: group,
    action: imageHeaderId ? 'ai_image_fill' : 'ai_fill',
    snapshotMeta: { rowIndex, fieldsFilled: Object.keys(fields) },
  })

  return NextResponse.json({ fields })
}
