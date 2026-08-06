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

  const extra = {}
  if (target.isSelfLookup) {
    for (const h of headers) {
      if (h.id === changedHeaderId) continue
      if (h.id in matchedRow) extra[h.id] = matchedRow[h.id]
    }
  } else {
    for (const h of headers) {
      if (h.id === changedHeaderId) continue
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
// app/listing-tools/auto-details/page.js) — Product Details' own unique-key
// header is the one true picker (Rule A); every other group's own copy of
// that connector (e.g. Compulsory/Optional's "Product Number", Prefill's
// "Brand") is a disabled, read-only mirror (see the `disabled` header flag)
// that only ever gets its value from here, never from being clicked into
// directly. Call this alongside resolveLinkedFill whenever the *design_system*
// group's own row changes — once its own row resolves against an existing
// product (Rule A), this fans that resolved row out to every other group's
// headers linked to design_system, returning `{[group]: {[headerId]: value}}`
// to merge into each of their own current rows.
export function propagateFromDesignSystem(changedHeaderId, changedValue, rowIndex, sheetsByGroup) {
  const designSheet = sheetsByGroup.design_system
  if (!designSheet) return null
  const resolved = resolveLinkedFill(designSheet.headers, changedHeaderId, changedValue, rowIndex, sheetsByGroup)
  if (!resolved) return null
  const fullRow = { [changedHeaderId]: changedValue, ...resolved }

  const updates = {}
  for (const [group, sheet] of Object.entries(sheetsByGroup)) {
    if (group === 'design_system') continue
    for (const h of sheet.headers) {
      if (h.linkedGroup !== 'design_system' || !h.linkedHeaderId) continue
      if (h.linkedHeaderId in fullRow) {
        updates[group] = updates[group] || {}
        updates[group][h.id] = fullRow[h.linkedHeaderId]
      }
    }
  }
  return Object.keys(updates).length ? updates : null
}
