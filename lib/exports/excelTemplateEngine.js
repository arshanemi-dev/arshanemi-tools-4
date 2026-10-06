// Shared engine behind both the "Excel Formats" viewer (details page) and
// the format-preserving export path (lib/exports/listingExport.js's
// downloadExcelSmart) — both need to open the *original* uploaded workbook
// with full styling intact, which the `xlsx` package already used elsewhere
// in this app can't reliably do (SheetJS Community Edition doesn't support
// reading/writing cell colors/fonts — see the write-up in
// lib/listingSheetLayout.js's sibling comments). ExcelJS does, so it's used
// here specifically, dynamically imported so its bundle only loads when a
// user actually opens the Excel Formats tab or clicks a Download button —
// same lazy-load pattern the rest of this feature already uses for `xlsx`
// and `jspdf`.
import { HEADER_ROW_INDEX, DATA_START_ROW_EXCEL, DEFAULT_SHEET_ROWS, detectMarketplaceSheetDefaults } from '@/lib/listingSheetLayout'
import { cleanLabel, splitHeaderCell } from '@/lib/sheetHeaderLabel'

function safeFilePart(name) {
  return String(name || 'listing').trim().replace(/[^a-z0-9\-_]+/gi, '-').slice(0, 60) || 'listing'
}

// ExcelJS ships as CommonJS — bundlers (webpack, same as this app's existing
// `const XLSX = await import('xlsx')` calls) flatten its named exports onto
// the dynamic import's namespace object, but that's a bundler-specific
// interop behavior, not something plain ESM guarantees. Falling back to
// `.default` covers any runtime where it isn't flattened.
async function loadExcelJS() {
  const mod = await import('exceljs')
  return mod.Workbook ? mod : mod.default
}

export async function loadOriginalWorkbook(url) {
  const ExcelJS = await loadExcelJS()
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not fetch the original file')
  const buffer = await res.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  return workbook
}

// ARGB ("AARRGGBB") → CSS color, the format every ExcelJS color object uses.
export function argbToCss(argb) {
  if (!argb || typeof argb !== 'string' || argb.length < 6) return null
  const hex = argb.length === 8 ? argb.slice(2) : argb
  const alphaHex = argb.length === 8 ? argb.slice(0, 2) : 'FF'
  const alpha = parseInt(alphaHex, 16) / 255
  if (!Number.isFinite(alpha) || alpha >= 0.999) return `#${hex}`
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
}

function cloneVal(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v))
}

// Copies the 4 style facets ExcelJS exposes per cell — deep-cloned so two
// cells never end up sharing (and accidentally mutating) the same object.
export function copyCellStyle(sourceCell, targetCell) {
  if (!sourceCell) return
  if (sourceCell.font) targetCell.font = cloneVal(sourceCell.font)
  if (sourceCell.fill) targetCell.fill = cloneVal(sourceCell.fill)
  if (sourceCell.border) targetCell.border = cloneVal(sourceCell.border)
  if (sourceCell.alignment) targetCell.alignment = cloneVal(sourceCell.alignment)
  if (sourceCell.numFmt) targetCell.numFmt = sourceCell.numFmt
}

const BORDER_WIDTH_CSS = { thin: '1px', hair: '1px', medium: '2px', thick: '3px', double: '3px' }

function borderSideCss(side) {
  if (!side || !side.style) return null
  const width = BORDER_WIDTH_CSS[side.style] || '1px'
  const style = side.style === 'double' ? 'double' : side.style === 'dashed' ? 'dashed' : side.style === 'dotted' ? 'dotted' : 'solid'
  const color = argbToCss(side.color?.argb) || '#94a3b8'
  return `${width} ${style} ${color}`
}

// Turns one ExcelJS cell's style into a React-ready inline style object
// (camelCase keys) for the read-only HTML viewer (ExcelFormatsView.jsx).
export function cellStyleObject(cell) {
  const style = {}
  const font = cell.font
  if (font) {
    if (font.bold) style.fontWeight = 700
    if (font.italic) style.fontStyle = 'italic'
    if (font.underline) style.textDecoration = 'underline'
    else if (font.strike) style.textDecoration = 'line-through'
    if (font.size) style.fontSize = `${font.size}px`
    const color = argbToCss(font.color?.argb)
    if (color) style.color = color
  }
  const fill = cell.fill
  if (fill?.type === 'pattern' && fill.pattern === 'solid') {
    const bg = argbToCss(fill.fgColor?.argb)
    if (bg) style.backgroundColor = bg
  }
  const border = cell.border
  if (border) {
    const top = borderSideCss(border.top); if (top) style.borderTop = top
    const bottom = borderSideCss(border.bottom); if (bottom) style.borderBottom = bottom
    const left = borderSideCss(border.left); if (left) style.borderLeft = left
    const right = borderSideCss(border.right); if (right) style.borderRight = right
  }
  const align = cell.alignment
  if (align?.horizontal) style.textAlign = ['center', 'right', 'left'].includes(align.horizontal) ? align.horizontal : 'left'
  if (align?.vertical) style.verticalAlign = align.vertical === 'middle' ? 'middle' : align.vertical === 'bottom' ? 'bottom' : 'top'
  if (align?.wrapText) style.whiteSpace = 'pre-wrap'
  return style
}

// Rows with a value in at least one of these headers. Anything else a saved row carries —
// bookkeeping keys (`aiFilled`, `userId`, `sku`), or a cell not keyed by a header id at all —
// can't land in a column, so a row with nothing but those would only add a blank line.
function rowsWithValues(headers, rows) {
  return (rows || []).filter((row) => headers.some((h) => String(row?.[h.id] ?? '').trim()))
}

// The 0-based columns a header was saved with — every marketplace column mapped onto it on the
// bulk mapping page (`sourceColumns`, see components/listing/bulkTemplateSheets.js), or the one
// column the older wizard recorded (`sourceColIndex`).
function savedColumnsOf(header) {
  if (Array.isArray(header.sourceColumns) && header.sourceColumns.length) {
    return [...new Set(header.sourceColumns.map((c) => c.colIndex).filter(Number.isInteger))]
  }
  return Number.isInteger(header.sourceColIndex) ? [header.sourceColIndex] : []
}

// Which rows of the original sheet hold its column headers and its first product row (1-based
// Excel rows). The mapping page saves them on each header (`sourceRows`). Older templates have
// none: one from the wizard always used the fixed layout (lib/listingSheetLayout.js), and one
// saved by the mapping page before it stored anything about the sheet falls back to its
// marketplace's usual rows (constants/sheetDefaults.js) — the same defaults its upload started on.
function resolveSourceRows(headers, marketplaceName) {
  const saved = headers.find((h) => Number.isInteger(h.sourceRows?.dataStart))?.sourceRows
  if (saved) return { header: Number.isInteger(saved.header) ? saved.header : saved.dataStart - 1, dataStart: saved.dataStart }
  if (headers.some((h) => Number.isInteger(h.sourceColIndex))) {
    return { header: HEADER_ROW_INDEX + 1, dataStart: DATA_START_ROW_EXCEL }
  }
  const rule = detectMarketplaceSheetDefaults([], marketplaceName || '')
  const header = Number(rule.dataHeaderRow) || HEADER_ROW_INDEX + 1
  return { header, dataStart: Math.max(header + 1, Number(rule.dropdownDataStartRow) || DEFAULT_SHEET_ROWS.DROPDOWN_DATA_START_ROW) }
}

// The original sheet's own header row as label → 0-based column, read the same way the mapping
// page reads it (splitHeaderCell), first column wins for a repeated name.
function headerRowColumns(ws, headerRow) {
  const byLabel = new Map()
  ws.getRow(headerRow).eachCell((cell, colNumber) => {
    const key = splitHeaderCell(cell.text).label.toLowerCase()
    if (key && !byLabel.has(key)) byLabel.set(key, colNumber - 1)
  })
  return byLabel
}

// [{ header, cols }] — every header that has somewhere to go, with the 0-based column(s) its
// value is written into. A header mapped onto several marketplace columns gets all of them, so
// one value typed on the fill page lands in each. Columns saved on the header are used as-is.
// A header without any is looked up by NAME in the sheet's header row instead — by the
// marketplace column names it was mapped from when it has them, or (only for a template where no
// header has a saved column at all, i.e. one saved before the mapping was kept) by its own label.
// Anything still unresolved — a default baseline column, one added by hand — is skipped, so
// nothing lands in a column the original never had. A column is only ever given to one header.
function resolveTargets(headers, ws, sourceRows) {
  const claimed = new Set()
  const targets = []
  const claim = (header, cols) => {
    const free = cols.filter((c) => !claimed.has(c))
    if (free.length === 0) return
    free.forEach((c) => claimed.add(c))
    targets.push({ header, cols: free })
  }

  const unplaced = []
  for (const h of headers) {
    const cols = savedColumnsOf(h)
    if (cols.length) claim(h, cols)
    else unplaced.push(h)
  }

  const noneSaved = targets.length === 0
  const byName = unplaced
    .map((h) => ({ header: h, names: Array.isArray(h.sheetHeaders) && h.sheetHeaders.length ? h.sheetHeaders : (noneSaved ? [h.label] : []) }))
    .filter((entry) => entry.names.length > 0)
  if (byName.length > 0) {
    const colByLabel = headerRowColumns(ws, sourceRows.header)
    for (const { header, names } of byName) {
      const cols = names.map((name) => colByLabel.get(cleanLabel(name).toLowerCase())).filter((c) => c != null)
      claim(header, [...new Set(cols)])
    }
  }
  return targets
}

// The real original workbook, mutated in place and returned as-is — every sheet it started
// with, still exactly that many sheets, byte-for-byte styling untouched (title row, group-label
// banner row, header row, column widths, merges, every *other* sheet like a Dropdown Reference
// sheet) — the only thing that changes is the Product Data Sheet's own data rows (from its first
// product row down, see resolveSourceRows), cleared and replaced with the current app data. One
// output row per product, each header written into the original column(s) it belongs to (see
// resolveTargets). `headers`/`rows` are expected to already be the merged, Multi-Select-expanded
// combination of whichever groups the caller requested (see listingExport.js's
// downloadExcelSmart) — this function itself has no notion of "groups" at all anymore.
//
// Returns null — nothing touched — when not one header has a column in that sheet: clearing its
// rows and writing nothing back would hand over an empty file.
export async function buildFormatPreservingWorkbook({ sourceFileUrl, sourceSheetName, headers, rows, marketplaceName }) {
  const original = await loadOriginalWorkbook(sourceFileUrl)
  const originalWs = original.getWorksheet(sourceSheetName) || original.worksheets[0]
  if (!originalWs) return null

  const allHeaders = headers || []
  const sourceRows = resolveSourceRows(allHeaders, marketplaceName)
  const targets = resolveTargets(allHeaders, originalWs, sourceRows)
  if (targets.length === 0) return null
  const filledRows = rowsWithValues(allHeaders, rows)
  const firstRow = sourceRows.dataStart

  // Each target column's own real data-row style (the original's first product row) —
  // snapshotted before anything is cleared, then reapplied to every row this writes, so the
  // exported look is the same whether the original had 100 pre-formatted blank rows or none.
  const columnStyles = new Map(targets.flatMap((t) => t.cols).map((c) => [c, originalWs.getCell(firstRow, c + 1)]))

  const clearThrough = Math.max(originalWs.rowCount || 0, firstRow - 1 + filledRows.length)
  for (let r = firstRow; r <= clearThrough; r++) {
    originalWs.getRow(r).eachCell({ includeEmpty: true }, (cell) => { cell.value = null })
  }

  filledRows.forEach((row, rowIdx) => {
    const excelRow = firstRow + rowIdx
    for (const { header, cols } of targets) {
      for (const c of cols) {
        const cell = originalWs.getCell(excelRow, c + 1)
        copyCellStyle(columnStyles.get(c), cell)
        cell.value = row[header.id] ?? ''
      }
    }
  })

  return original
}

// false (and no download) when buildFormatPreservingWorkbook had nothing to write into — the
// caller falls back to the plain export so the data still comes out.
export async function downloadFormatPreservingExcel({ sourceFileUrl, sourceSheetName, headers, rows, marketplaceName, filename }) {
  const workbook = await buildFormatPreservingWorkbook({ sourceFileUrl, sourceSheetName, headers, rows, marketplaceName })
  if (!workbook) return false
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `${safeFilePart('listing')}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return true
}

// ─── Read-only viewer model (Excel Formats tab) ────────────────────────────

function colLetterToIndex(letters) {
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function parseRange(range) {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(String(range || ''))
  if (!m) return null
  return { left: colLetterToIndex(m[1]), top: Number(m[2]), right: colLetterToIndex(m[3]), bottom: Number(m[4]) }
}

// Sheets can be huge (e.g. a reference sheet with thousands of SKU rows) —
// the viewer is for eyeballing layout/formatting, not scrolling through
// every row, so it caps how much gets rendered.
const MAX_VIEWER_ROWS = 500
const MAX_VIEWER_COLS = 100

function buildSheetModel(ws) {
  const merges = (ws.model?.merges || []).map(parseRange).filter(Boolean)
  const covered = new Set()
  const spanAt = new Map()
  merges.forEach(({ top, left, bottom, right }) => {
    spanAt.set(`${top},${left}`, { rowSpan: bottom - top + 1, colSpan: right - left + 1 })
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        if (r === top && c === left) continue
        covered.add(`${r},${c}`)
      }
    }
  })

  const rowCount = Math.min(ws.rowCount || 0, MAX_VIEWER_ROWS)
  const colCount = Math.min(ws.columnCount || 0, MAX_VIEWER_COLS)
  const colWidths = []
  for (let c = 1; c <= colCount; c++) {
    const w = ws.getColumn(c).width
    colWidths.push(w ? Math.round(w * 7 + 5) : 80)
  }

  const rows = []
  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r)
    const height = row.height ? Math.round(row.height * 1.333) : null
    const cells = []
    for (let c = 1; c <= colCount; c++) {
      if (covered.has(`${r},${c}`)) continue
      const cell = ws.getCell(r, c)
      const span = spanAt.get(`${r},${c}`)
      cells.push({
        key: `${r}-${c}`,
        value: cell.text ?? (cell.value == null ? '' : String(cell.value)),
        rowSpan: span?.rowSpan || 1,
        colSpan: span?.colSpan || 1,
        style: cellStyleObject(cell),
      })
    }
    rows.push({ key: r, height, cells })
  }

  return {
    name: ws.name,
    rows,
    colWidths,
    truncated: (ws.rowCount || 0) > MAX_VIEWER_ROWS || (ws.columnCount || 0) > MAX_VIEWER_COLS,
  }
}

// One sheet-model per original sheet, in original tab order — feeds
// components/listing/ExcelFormatsView.jsx's sheet tabs + table.
export async function buildViewerModel(sourceFileUrl) {
  const workbook = await loadOriginalWorkbook(sourceFileUrl)
  return workbook.worksheets.map(buildSheetModel)
}
