// "History" backfill — a group's own already-saved rows in this same template act as its
// history, matched by whichever header(s) are flagged `isUniqueKeyPart` (the exact same
// composite key lib/listingTemplates.js's findDuplicateKeys() already uses to reject duplicates
// at save time: Product Number for design_system, Product Number + Brand for prefill). No new
// storage — `sheetsByGroup[group].rows` is the template's content as fetched once on load, so a
// still-in-progress row from the current fill session is never matched against itself.
//
// Fill-only-blank, never overwrite — same rule lib/listingTemplates.js's assignSkusToRows uses.
// Formula-type headers are excluded entirely (see backfillEmptyFields below) — formula.js's
// recomputeFormulas now always recalculates them fresh instead, so they're never a copy
// destination here.
//
// The match itself (findGroupKeyMatch) is always looked up on every change, never gated behind
// "does this row still have a blank field" — a matched group's own row only ever backfills what's
// blank, but the caller (auto-details/page.js) also uses a match to compulsorily cascade into
// every *other* group (Rule 1), which still needs to fire even once this group's own row is
// already fully typed.

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

function keyHeadersFor(group, sheetsByGroup) {
  return (sheetsByGroup[group]?.headers || []).filter((h) => h.isUniqueKeyPart)
}

function keyValueFor(keyHeaders, row) {
  if (keyHeaders.length === 0) return null
  const parts = keyHeaders.map((h) => String(row?.[h.id] ?? '').trim().toLowerCase())
  if (parts.some((p) => !p)) return null // every key part must be filled to match/search on
  return parts.join('::')
}

// Matches this row's current key value(s) against that same group's own previously-saved rows.
// Returns the matched row, or null (no key set on this group, key not fully typed yet, or no
// existing row shares it).
export function findGroupKeyMatch(group, row, sheetsByGroup) {
  const keyHeaders = keyHeadersFor(group, sheetsByGroup)
  const value = keyValueFor(keyHeaders, row)
  if (!value) return null
  const rows = sheetsByGroup[group]?.rows || []
  return rows.find((r) => keyValueFor(keyHeaders, r) === value) || null
}

// Fields present on `matchedRow` that fill `row`'s still-blank cells only — matched/known fields
// get filled, anything the history doesn't have (or that's already typed) stays as-is. Formula
// headers are skipped: copying a historical *result* would freeze it at whatever it computed to
// back then, instead of recalculating from this row's own (possibly different) inputs —
// formula.js's recomputeFormulas is what actually fills them, from this row's real values.
export function backfillEmptyFields(headers, row, matchedRow) {
  if (!matchedRow) return null
  const extra = {}
  for (const h of headers || []) {
    if (h.dataType === 'formula') continue
    if (!isBlank(row?.[h.id])) continue
    if (isBlank(matchedRow[h.id])) continue
    extra[h.id] = matchedRow[h.id]
  }
  return Object.keys(extra).length ? extra : null
}
