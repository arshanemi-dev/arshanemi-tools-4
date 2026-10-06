import { formulaReferencesHeader } from '@/components/listing/formula'

// Multi Select cells store every picked option as one comma-joined string
// in a single row cell (components/listing/MultiSelectCell.jsx,
// SheetGrid.jsx) — the grid itself always shows exactly one row per
// product, easy to browse and edit. Only at export time does a
// multi-valued cell explode into one row per option, each a full copy of
// that row's other fields (Cost, Brand, Images, ...) — marketplaces need a
// separate listing row per variation/SKU, not one row with "34, 35, 36"
// jammed into a cell. Shared by both downloadExcel/downloadPdf's shared
// sheetToAoa (listingExport.js) and the format-preserving export
// (excelTemplateEngine.js), so plain, smart, and PDF exports all agree.
//
// The exception is a Multi Select the marketplace's own sheet made — a
// header carrying `multiValueSeparator` (see
// components/listing/bulkTemplateSheets.js; Flipkart's reference-sheet-only
// lists, "::"). That column is ONE cell the marketplace reads several
// values out of, so its picks stay in the product's row, re-joined with
// that separator ("Cotton, Silk" → "Cotton::Silk"), and never add rows.
//
// Index-aligned across every multi-valued Multi Select column at once — not a cartesian
// product. When a row has more than one such column, column i's row N pairs with every other
// active column's own Nth option, because together they describe N *created* variants (e.g.
// Variations "34, 35" + Color "Red, Blue" picked as two matched pairs -> exactly 2 rows, 34/Red
// and 35/Blue — never a 2x2=4-row cross product of combinations the user never actually
// created). A column with fewer options than the longest active one holds its last option for
// the remaining rows rather than being silently dropped once its own list runs out.
//
// A Formula header whose formula references one of these columns (formula.js's evaluateFormula
// already computes it as its own comma-joined multi-value, one segment per option, in the same
// order — see formula.js's findMultiValueRef) fans out the same way, paired by that same row
// index against whichever active column it actually references. A formula header whose current
// value doesn't have exactly one segment per option for that column (e.g. it was computed before
// this pairing existed, or the user typed over it directly) is left untouched — same joined
// string on every expanded row, the old behavior — rather than guessing at a mismatched pairing.

function optionsOf(value) {
  return String(value || '').split(',').map((v) => v.trim()).filter(Boolean)
}

export function expandMultiSelectRows(headers, rows) {
  const allMulti = (headers || []).filter((h) => h.dataType === 'multiselect')
  const oneCellHeaders = allMulti.filter((h) => h.multiValueSeparator)
  const multiHeaders = allMulti.filter((h) => !h.multiValueSeparator)
  if (allMulti.length === 0) return rows || []

  // Re-joins each one-cell Multi Select's picks with its own separator.
  const joinOneCell = (row) => {
    if (oneCellHeaders.length === 0) return row
    let next = row
    for (const h of oneCellHeaders) {
      const options = optionsOf(row[h.id])
      if (options.length < 2) continue
      if (next === row) next = { ...row }
      next[h.id] = options.join(h.multiValueSeparator)
    }
    return next
  }
  if (multiHeaders.length === 0) return (rows || []).map(joinOneCell)

  const formulaHeaders = (headers || []).filter((f) => f.dataType === 'formula' && f.formula)

  return (rows || []).flatMap((row) => {
    const active = multiHeaders
      .map((h) => ({ header: h, options: optionsOf(row[h.id]) }))
      .filter((p) => p.options.length > 1)
    if (active.length === 0) return [joinOneCell(row)]

    const count = Math.max(...active.map((p) => p.options.length))

    const linked = formulaHeaders
      .map((f) => {
        const driver = active.find((p) => formulaReferencesHeader(f.formula, p.header, headers))
        if (!driver) return null
        const parts = optionsOf(row[f.id])
        return parts.length === driver.options.length ? { header: f, parts } : null
      })
      .filter(Boolean)

    const base = joinOneCell(row)
    return Array.from({ length: count }, (_, i) => {
      const next = { ...base }
      for (const { header, options } of active) next[header.id] = options[i] ?? options[options.length - 1]
      for (const { header, parts } of linked) next[header.id] = parts[i] ?? parts[parts.length - 1]
      return next
    })
  })
}
