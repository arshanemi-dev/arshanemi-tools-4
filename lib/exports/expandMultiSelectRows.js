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
// Sequential per multi-select header, not a full cartesian product control
// — if a sheet somehow had two multi-valued Multi Select columns on the
// same row, each expands in turn (2 values x 2 values = 4 rows), which is
// the only sane generalization, but the real use case is one such column
// (e.g. "Variations") at a time.
export function expandMultiSelectRows(headers, rows) {
  const multiHeaders = (headers || []).filter((h) => h.dataType === 'multiselect')
  if (multiHeaders.length === 0) return rows || []

  let expanded = rows || []
  for (const h of multiHeaders) {
    expanded = expanded.flatMap((row) => {
      const options = String(row[h.id] || '').split(',').map((v) => v.trim()).filter(Boolean)
      if (options.length <= 1) return [row]
      return options.map((opt) => ({ ...row, [h.id]: opt }))
    })
  }
  return expanded
}
