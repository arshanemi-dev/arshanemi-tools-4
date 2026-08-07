// Connected-header lookup — shared by every page that fills in sheet data
// (Auto Listing's per-template workspace, Product Details, Prefill Details).
//
// Two rules, both resolved by the same function:
//  - Rule A (implicit, every sheet): a sheet's own `isUniqueKeyPart` header,
//    set to a value matching an existing row already in that *same* sheet,
//    auto-fills the rest of the row from that matching row — e.g. typing an
//    existing Product Number into Product Details itself pulls in that
//    product's known Size/Cost/Highlights/Brand/Images.
//  - Rule B (explicit, cross-group): a header with `linkedGroup`/
//    `linkedHeaderId` set, pointing at *another* group's own unique-key
//    header, becomes a lookup keyed off that group's existing rows — e.g.
//    Compulsory's own "Product Number" (linked to Product Details' Product
//    Number) fills every other Compulsory header that's linked to some
//    Product Details column.
//
// Header objects here are the *persisted* shape (`group`, not the wizard's
// in-memory `groupId`) — this runs against `content.sheets` at fill time,
// not against TemplateSettingsWizard's local `fields` state.

function resolveTarget(header, sheetsByGroup) {
  if (header.linkedGroup && header.linkedHeaderId) {
    const targetSheet = sheetsByGroup[header.linkedGroup]
    const targetHeader = targetSheet?.headers.find((h) => h.id === header.linkedHeaderId)
    if (targetHeader?.isUniqueKeyPart) {
      return { group: header.linkedGroup, keyHeaderId: targetHeader.id, sheet: targetSheet, isSelfLookup: false }
    }
    return null
  }
  if (header.isUniqueKeyPart) {
    const group = header.group
    return { group, keyHeaderId: header.id, sheet: sheetsByGroup[group], isSelfLookup: true }
  }
  return null
}

// Distinct existing values of the header's lookup target's key column — the
// browsable suggestion list for that cell. `null` when this header isn't a
// picker at all, or there's nothing yet to suggest (e.g. the very first row).
export function selectorOptionsFor(header, sheetsByGroup) {
  const target = resolveTarget(header, sheetsByGroup)
  if (!target?.sheet) return null
  const values = [...new Set(
    target.sheet.rows.map((r) => String(r[target.keyHeaderId] ?? '').trim()).filter(Boolean)
  )]
  return values.length ? values : null
}

// Called when a cell's value changes. Returns `{[headerId]: value, ...}` of
// extra fields to merge into the same row, or `null` if the new value
// doesn't match an existing record (e.g. it's a brand-new key — nothing to
// fill from, which is expected and not an error).
export function resolveLinkedFill(headers, changedHeaderId, changedValue, rowIndex, sheetsByGroup) {
  const changedHeader = headers.find((h) => h.id === changedHeaderId)
  if (!changedHeader) return null
  const value = String(changedValue ?? '').trim()
  if (!value) return null

  const target = resolveTarget(changedHeader, sheetsByGroup)
  if (!target?.sheet) return null

  const matchedRow = target.sheet.rows.find((r, i) => {
    if (target.isSelfLookup && i === rowIndex) return false
    return String(r[target.keyHeaderId] ?? '').trim() === value
  })
  if (!matchedRow) return null

  // Formula-type headers are never a write target here — copying a matched row's raw (possibly
  // stale, computed-elsewhere) value into a formula cell would bypass its own formula entirely.
  // formula.js's recomputeFormulas recalculates it fresh from whatever this fill just resolved
  // for its OWN referenced fields instead.
  const extra = {}
  if (target.isSelfLookup) {
    for (const h of headers) {
      if (h.id === changedHeaderId || h.dataType === 'formula') continue
      if (h.id in matchedRow) extra[h.id] = matchedRow[h.id]
    }
  } else {
    for (const h of headers) {
      if (h.id === changedHeaderId || h.dataType === 'formula') continue
      if (h.linkedGroup !== target.group || !h.linkedHeaderId) continue
      if (h.linkedHeaderId in matchedRow) extra[h.id] = matchedRow[h.linkedHeaderId]
    }
  }
  return Object.keys(extra).length ? extra : null
}

// Builds the `pickerOptions` map SheetGrid expects ({[headerId]: string[]}),
// skipping headers with nothing to suggest.
export function buildPickerOptions(headers, sheetsByGroup) {
  const out = {}
  for (const h of headers) {
    const options = selectorOptionsFor(h, sheetsByGroup)
    if (options) out[h.id] = options
  }
  return out
}

// Only meaningful in a workspace where multiple groups' "current" rows are
// being filled in side-by-side for one new listing (see
// app/listing-tools/auto-details/page.js) — every group is one logical
// sheet of the same set of products, so filling in a header that other
// headers are connected to should always fan out to every one of those
// children, the same way, regardless of which group happens to be the
// source. Product Details is the most common source (every default
// connector — Compulsory/Optional's Product Number, Prefill's Brand — links
// back to it), but nothing here assumes that: pass whichever group's row
// just changed as `sourceGroup` and this finds every header in every
// *other* group connected to it — either explicitly (`linkedGroup`/
// `linkedHeaderId`, Rule B) or, for a header with no explicit connection at
// all, implicitly by sharing the exact same label as one of the source
// group's own headers (e.g. both groups happening to have their own
// "Highlights" column) — "all Headers fields" auto-fill without needing
// every single matching field wired up by hand in Advanced Settings first.
// An explicit link always wins over the implicit label fallback for a
// given header; the fallback only ever looks at headers with no
// `linkedGroup` set at all, so it can never silently override an
// intentional connection to some *other* group.
//
// Takes `sourceRow`'s *current full state* directly — not a separate
// lookup — and fans out whatever's already filled in it. This deliberately
// does NOT require that row to match an already-saved record (an earlier
// version called resolveLinkedFill internally and bailed out unless it
// did, which meant a brand-new product being typed for the first time —
// the normal case in Auto Listing — never propagated anywhere, since
// there's nothing existing yet to "match"). Whatever's typed right now —
// new or a re-picked existing record — is what gets propagated; call this
// with the row *after* Rule A's own same-sheet resolution has already been
// merged in, so a picked existing record's full resolved row (not just the
// one field that changed) propagates too. Returns
// `{[group]: {[headerId]: value}}` to merge into each other group's own
// current row, or `null` if there's nothing (yet) to send.
export function propagateFromGroup(sourceGroup, sourceRow, sheetsByGroup) {
  const sourceHeaders = sheetsByGroup[sourceGroup]?.headers || []
  const sourceByLabel = new Map(
    sourceHeaders.map((h) => [h.label?.trim().toLowerCase(), h]).filter(([label]) => label)
  )

  const updates = {}
  for (const [group, sheet] of Object.entries(sheetsByGroup)) {
    if (group === sourceGroup) continue
    for (const h of sheet.headers) {
      // Same reasoning as resolveLinkedFill above — a formula-type target recomputes its own
      // value from whatever lands in its OWN referenced fields, it's never a copy destination.
      if (h.dataType === 'formula') continue
      let sourceHeaderId = null
      if (h.linkedGroup === sourceGroup && h.linkedHeaderId) {
        sourceHeaderId = h.linkedHeaderId
      } else if (!h.linkedGroup) {
        sourceHeaderId = sourceByLabel.get(h.label?.trim().toLowerCase())?.id || null
      }
      if (!sourceHeaderId) continue
      const value = sourceRow?.[sourceHeaderId]
      if (value === undefined || value === null || String(value).trim() === '') continue
      updates[group] = updates[group] || {}
      updates[group][h.id] = value
    }
  }
  return Object.keys(updates).length ? updates : null
}
