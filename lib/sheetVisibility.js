// Excel can hide worksheets — Hidden 1 = normal hidden (right-click a tab →
// Unhide), 2 = "very hidden" (only reachable from the VBA editor). SheetJS's
// wb.SheetNames lists EVERY sheet regardless, so marketplace templates showed
// more sheets in our pickers than Excel's own tab bar does (their lookup /
// list sheets are usually hidden). The flag lives in wb.Workbook.Sheets[i]
// .Hidden, same order as SheetNames; missing metadata = visible
// (docs.sheetjs.com/docs/csf/features/visibility).
//
// Hidden sheets are never considered: not listed, not counted as a "Sheet
// No", not auto-picked, not scanned for values. The single exception is a
// fill-sheet column's own Excel dropdown whose list lives on a hidden sheet
// (Meesho/Flipkart do this) — those values are still resolved, see
// sheetDataValidations.js readRange.

export function isSheetHidden(wb, name) {
  const idx = wb?.SheetNames?.indexOf(name) ?? -1
  return idx >= 0 && !!wb?.Workbook?.Sheets?.[idx]?.Hidden
}

// Every sheet Excel hides, in workbook order → [{ name, veryHidden }] —
// shown to the user next to the sheet pickers so they can tell which extra
// sheets the file carries (and why they aren't in the list).
export function hiddenSheets(wb) {
  const names = wb?.SheetNames || []
  const meta = wb?.Workbook?.Sheets || []
  if (visibleSheetNames(wb).length === names.length) return []
  return names.flatMap((name, i) => (meta[i]?.Hidden ? [{ name, veryHidden: meta[i].Hidden === 2 }] : []))
}

export function visibleSheetNames(wb) {
  const names = wb?.SheetNames || []
  const meta = wb?.Workbook?.Sheets || []
  const visible = names.filter((_, i) => !meta[i]?.Hidden)
  // Excel never saves a workbook with zero visible sheets; if the metadata
  // somehow says so, fall back to every sheet rather than showing nothing.
  return visible.length ? visible : names
}

// Excel can hide COLUMNS too (Hide, or a collapsed outline group). SheetJS
// only loads that when the file is read with { cellStyles: true } — without
// it ws['!cols'] is never set and nothing reads as hidden. The flag is
// ws['!cols'][c].hidden, indexed by the real 0-based sheet column, same for
// .xlsx / .xlsb / .xls (docs.sheetjs.com/docs/csf/features/colprops).
//
// A header sitting in a hidden column is never considered either: not
// listed, not mapped, not scanned for dropdown values — see
// extractSessionSheet in BulkTemplateDesign.jsx, which skips it and only
// names it in the debug panel's Headers tab.
export function isColumnHidden(ws, colIdx) {
  // return true;
  return !!ws?.['!cols']?.[colIdx]?.hidden
}
