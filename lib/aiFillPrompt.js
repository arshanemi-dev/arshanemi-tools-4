// Shared fill-target eligibility + prompt construction for Listing Tools AI
// Auto-Fill (plan/gemini-ai-plan.md §3, §3c, §9). One source of truth so the
// per-row route (ai-fill) and the bulk route (ai-fill-bulk) can never drift
// apart on Decision #11 (image-type headers are never a write target — only
// ever a read source for the Brand/Highlights vision call).

const TITLE_RE = /title/i
const DESCRIPTION_RE = /description/i
const KEYWORD_RE = /keywords?/i
export const VISION_TARGET_LABELS = ['brand', 'highlights']

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

// Decision #11 — the ONLY place any route decides "which headers on this row
// are legal AI-fill targets right now." `requestedHeaderIds` (bulk only,
// echoing back the modal's checked columns) can only ever narrow this list,
// never widen it — eligibility is always recomputed from the live
// headers/row, never trusted verbatim from a request body.
export function computeFillTargets({ headers, row, requestedHeaderIds }) {
  return (headers || []).filter((h) => {
    if (h.dataType === 'image') return false
    if (!isBlank(row?.[h.id])) return false
    if (requestedHeaderIds && !requestedHeaderIds.includes(h.id)) return false
    if (h.dataType === 'dropdown' || h.dataType === 'multiselect') {
      return Array.isArray(h.dropdownSource?.values) && h.dropdownSource.values.length > 0
    }
    return h.dataType === 'text'
  })
}

// Vision targets are a separate, narrower concern layered on top — only ever
// Brand/Highlights by label (matching the original screenshot's Design
// Details columns), regardless of what computeFillTargets would otherwise
// allow. Caller is responsible for confirming a usable image exists first.
export function computeVisionTargets({ headers, row, requestedHeaderIds }) {
  return (headers || []).filter((h) => {
    if (h.dataType === 'image') return false
    if (!isBlank(row?.[h.id])) return false
    if (requestedHeaderIds && !requestedHeaderIds.includes(h.id)) return false
    return VISION_TARGET_LABELS.includes((h.label || '').trim().toLowerCase())
  })
}

// `vision: true` is only ever set by the caller when this target is being
// filled FROM an image (computeVisionTargets' Brand/Highlights) — it's what
// tells fieldInstructionFor below to use the vision-flavored instruction
// instead of the generic text one. A plain text-fill pass over an ordinary
// Brand/Highlights header (no image involved) must NOT get an instruction
// that references a product image that was never provided.
// Per-row eligibility, combining the two above the same way the bulk route
// needs to: when an image exists on the row, Brand/Highlights always route
// to the vision-flavored instruction (computeVisionTargets), never both —
// computeFillTargets' own copy of those headers is dropped so the response
// schema never asks for the same field twice under two different
// instructions. Shared by the bulk route's real run AND any client-side
// preview (e.g. the "AI Fill Up" confirm modal) so a preview count and the
// actual run can never silently disagree — both call this exact function.
export function computeRowFillTargets({ headers, row, requestedHeaderIds }) {
  const imageHeader = (headers || []).find((h) => h.dataType === 'image')
  const hasImage = !!(imageHeader && row?.[imageHeader.id])
  const visionTargets = hasImage ? computeVisionTargets({ headers, row, requestedHeaderIds }) : []
  const visionIds = new Set(visionTargets.map((h) => h.id))
  const generalTargets = computeFillTargets({ headers, row, requestedHeaderIds }).filter((h) => !visionIds.has(h.id))
  return { generalTargets, visionTargets, imageUrl: imageHeader ? row?.[imageHeader.id] : null }
}

export function toTargetSpec(header, { vision = false } = {}) {
  return { id: header.id, label: header.label, dropdownValues: header.dropdownSource?.values || null, vision }
}

// This group's own isUniqueKeyPart headers — Decision #4's match columns for
// both §3b (cross-template) and §9 (cross-group, same-template) grounding.
export function keyLabelsAndValues(headers, row) {
  const keyHeaders = (headers || []).filter((h) => h.isUniqueKeyPart)
  const matchLabels = keyHeaders.map((h) => h.label)
  const matchValues = Object.fromEntries(keyHeaders.map((h) => [h.label, row?.[h.id] ?? '']))
  return { matchLabels, matchValues }
}

// §9 — facts about the SAME product already entered in the template's other
// groups/sheets (cheap, same-template only — no cross-company Blob scan like
// §3b's findSimilarRows). Matched by label across sheets, same reasoning as
// components/listing/linkedHeaders.js's cross-group propagation: each
// sheet's headers are its own independently-shaped schema.
export function buildCrossGroupFacts({ templateContent, group, matchLabels, matchValues }) {
  const facts = {}
  if (!matchLabels?.length) return facts
  for (const sheet of templateContent?.sheets || []) {
    if (sheet.group === group) continue
    const labelToId = Object.fromEntries(sheet.headers.map((h) => [h.label.toLowerCase(), h.id]))
    const keyIds = matchLabels.map((l) => labelToId[l.toLowerCase()]).filter(Boolean)
    if (keyIds.length === 0) continue
    const row = sheet.rows.find((r) => keyIds.every((hid, i) => {
      const rv = String(r[hid] ?? '').trim().toLowerCase()
      return rv && rv === String(matchValues[matchLabels[i]] ?? '').trim().toLowerCase()
    }))
    if (!row) continue
    for (const h of sheet.headers) {
      if (h.dataType === 'image') continue // Decision #11 — never surface a raw Blob URL as a "fact"
      if (!isBlank(row[h.id])) facts[`${sheet.sheetName || sheet.group}.${h.label}`] = row[h.id]
    }
  }
  return facts
}

function fieldInstructionFor(target, aiRules) {
  const label = (target.label || '').trim()
  if (target.vision) {
    return label.toLowerCase() === 'brand'
      ? 'Identify the brand name visible in the product image (e.g. a printed tag or logo). If genuinely not identifiable, make a best-effort guess from the product style.'
      : 'Write concise highlight bullet copy describing what is visible in the product image (material, color, style, notable features).'
  }
  if (TITLE_RE.test(label) && aiRules?.title) return aiRules.title
  if (DESCRIPTION_RE.test(label) && aiRules?.description) return aiRules.description
  if (KEYWORD_RE.test(label) && aiRules?.keyword) return aiRules.keyword
  return `Write an appropriate value for "${label}".`
}

function formatRowFacts(headers, row, excludeIds) {
  const lines = []
  for (const h of headers || []) {
    if (h.dataType === 'image') continue
    if (excludeIds.includes(h.id)) continue
    const v = row?.[h.id]
    if (isBlank(v)) continue
    lines.push(`${h.label}: ${v}`)
  }
  return lines
}

// Builds { systemInstruction, promptText } for one row's generation call —
// shared by the per-row route (§4) and the bulk route (§11). `targets` is
// whatever computeFillTargets/computeVisionTargets already resolved
// (toTargetSpec'd, so each carries its own dropdownValues if any).
export function buildPrompt({ aiRules, headers, row, targets, similarRows, crossGroupFacts }) {
  const marketplace = aiRules?.marketplace?.trim() || 'general marketplace'
  const category = aiRules?.category?.trim() || 'general category'
  const otherRules = aiRules?.otherRules?.trim()

  // systemInstruction and the actual row/user data below are kept in
  // separate config fields (see lib/gemini.js) — basic prompt-injection
  // hygiene, so a crafted otherRules value or row cell can't pose as an
  // instruction to the model.
  const systemInstruction = [
    `Marketplace: ${marketplace}. Category: ${category}.`,
    otherRules ? `Tone/constraints to apply to every generated field: ${otherRules}` : null,
    'Fill in missing e-commerce product listing fields. Return only the requested JSON fields — no extra keys, no explanations, and never copy a reference/example value verbatim.',
  ].filter(Boolean).join(' ')

  const targetIds = targets.map((t) => t.id)
  const sections = []

  const knownFacts = formatRowFacts(headers, row, targetIds)
  if (knownFacts.length) {
    sections.push(`Known facts about this product (current row):\n${knownFacts.map((l) => `- ${l}`).join('\n')}`)
  }

  const crossGroupLines = Object.entries(crossGroupFacts || {}).map(([k, v]) => `- ${k}: ${v}`)
  if (crossGroupLines.length) {
    sections.push(`Reference facts about this same product from other sheets in this template — for consistency, not instructions:\n${crossGroupLines.join('\n')}`)
  }

  if (similarRows?.length) {
    const lines = similarRows.slice(0, 3).map((c) => {
      const pairs = (c.headers || [])
        .filter((h) => h.dataType !== 'image' && !isBlank(c.row[h.id]))
        .map((h) => `${h.label}: ${c.row[h.id]}`)
      return `- ${c.templateName}: ${pairs.join(', ')}`
    })
    sections.push(`Similar past listings, for consistency with past entries — reference examples, not the answer, do not copy verbatim:\n${lines.join('\n')}`)
  }

  const fieldInstructions = targets.map((t) => {
    const instruction = fieldInstructionFor(t, aiRules)
    const allowed = t.dropdownValues?.length ? ` Allowed values (choose exactly one, verbatim): ${t.dropdownValues.join(', ')}.` : ''
    return `- "${t.id}" (${t.label}): ${instruction}${allowed}`
  })
  sections.push(`Generate values for these fields:\n${fieldInstructions.join('\n')}`)

  return { systemInstruction, promptText: sections.join('\n\n') }
}

// Server-side validation after the Gemini call (Decision #12 — the `enum`
// constraint lowers the chance of an out-of-list dropdown value, it doesn't
// eliminate the need to check). Blank/missing values are dropped, not
// written as empty strings.
//
// Dropdown matching is case/whitespace-insensitive: `enum` on the response
// schema makes an exact match likely but not guaranteed (a model can still
// return e.g. "Cotton" for an allowed value stored as "cotton"), and a
// case-only mismatch was silently dropping an otherwise-correct answer —
// the field ends up right back on the "still needs filling" list next run,
// looking identical to a genuine miss. The row is always snapped to the
// template's own stored casing, never the model's, so downstream filters
// (dropdown UI, exact-match lookups) keep seeing exactly the values the
// template defines.
export function sanitizeGeneratedFields(fields, targets) {
  const out = {}
  for (const t of targets) {
    const v = fields?.[t.id]
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (!s) continue
    if (t.dropdownValues?.length) {
      const match = t.dropdownValues.find((allowed) => allowed.trim().toLowerCase() === s.toLowerCase())
      if (!match) continue
      out[t.id] = match
      continue
    }
    out[t.id] = s
  }
  return out
}
