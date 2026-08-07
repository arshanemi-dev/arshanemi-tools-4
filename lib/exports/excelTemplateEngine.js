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
import { DATA_START_ROW_EXCEL } from '@/lib/listingSheetLayout'

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

function nonEmptyRows(rows) {
  return (rows || []).filter((row) => Object.values(row).some((v) => String(v ?? '').trim()))
}

// The real original workbook, mutated in place and returned as-is — every sheet it started
// with, still exactly that many sheets, byte-for-byte styling untouched (title row, group-label
// banner row, header row, column widths, merges, every *other* sheet like a Dropdown Reference
// sheet) — the only thing that changes is the Product Data Sheet's own data rows (from
// DATA_START_ROW_EXCEL down), cleared and replaced with the current app data. One output row per
// product, each header written into the exact original column its own `sourceColIndex` came
// from — a header with no `sourceColIndex` (a default baseline column or one manually added in
// the wizard, never part of the uploaded file) is skipped entirely, so nothing lands in a column
// the original never had. `headers`/`rows` are expected to already be the merged, Multi-Select-
// expanded combination of whichever groups the caller requested (see listingExport.js's
// downloadExcelSmart) — this function itself has no notion of "groups" at all anymore.
export async function buildFormatPreservingWorkbook({ sourceFileUrl, sourceSheetName, headers, rows }) {
  const original = await loadOriginalWorkbook(sourceFileUrl)
  const originalWs = original.getWorksheet(sourceSheetName) || original.worksheets[0]
  if (!originalWs) return original

  const mappedHeaders = (headers || []).filter((h) => h.sourceColIndex != null)
  const filledRows = nonEmptyRows(rows)

  // Each mapped column's own real data-row style (row 4, the original's first data row) —
  // snapshotted before anything is cleared, then reapplied to every row this writes, so the
  // exported look is the same whether the original had 100 pre-formatted blank rows or none.
  const columnStyles = new Map(mappedHeaders.map((h) => [h.id, originalWs.getCell(DATA_START_ROW_EXCEL, h.sourceColIndex + 1)]))

  const clearThrough = Math.max(originalWs.rowCount || 0, DATA_START_ROW_EXCEL - 1 + filledRows.length)
  for (let r = DATA_START_ROW_EXCEL; r <= clearThrough; r++) {
    originalWs.getRow(r).eachCell({ includeEmpty: true }, (cell) => { cell.value = null })
  }

  filledRows.forEach((row, rowIdx) => {
    const excelRow = DATA_START_ROW_EXCEL + rowIdx
    for (const h of mappedHeaders) {
      const cell = originalWs.getCell(excelRow, h.sourceColIndex + 1)
      copyCellStyle(columnStyles.get(h.id), cell)
      cell.value = row[h.id] ?? ''
    }
  })

  return original
}

export async function downloadFormatPreservingExcel({ sourceFileUrl, sourceSheetName, headers, rows, filename }) {
  const workbook = await buildFormatPreservingWorkbook({ sourceFileUrl, sourceSheetName, headers, rows })
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
