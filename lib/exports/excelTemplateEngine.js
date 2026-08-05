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
import { HEADER_ROW_INDEX, GROUP_LABEL_ROW_INDEX, DATA_START_ROW_EXCEL } from '@/lib/listingSheetLayout'

const GROUP_LABELS = { design_system: 'Product details', compulsory: 'Compulsory', prefill: 'Prefill', optional: 'Optional' }
const HEADER_EXCEL_ROW = HEADER_ROW_INDEX + 1

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

// Copies one worksheet into `targetWorkbook` completely unchanged — values,
// styles, column widths, row heights, merges. Used for every sheet in the
// original upload that isn't the Product Data Sheet (e.g. the Dropdown
// Reference sheet) — those ride along in every export exactly as uploaded.
function cloneWorksheetVerbatim(targetWorkbook, sourceWs) {
  const ws = targetWorkbook.addWorksheet(String(sourceWs.name || 'Sheet').slice(0, 31))
  sourceWs.columns?.forEach((c, i) => { if (c?.width) ws.getColumn(i + 1).width = c.width })
  sourceWs.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (row.height) ws.getRow(rowNumber).height = row.height
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const target = ws.getCell(rowNumber, colNumber)
      target.value = cell.value
      copyCellStyle(cell, target)
    })
  })
  for (const range of sourceWs.model?.merges || []) {
    try { ws.mergeCells(range) } catch { /* malformed/duplicate range in the source file — skip rather than fail the whole export */ }
  }
}

const GROUP_LABEL_EXCEL_ROW = GROUP_LABEL_ROW_INDEX + 1

// True original left-to-right order — not the app's per-group `order` field,
// which is just array position and could drift from the source file if a
// header was ever manually dragged between groups. Headers with no
// sourceColIndex (manually added in the wizard, never existed in the
// original file) sort after every real column, in their own relative order.
function bySourceSequence(a, b) {
  const ai = a.sourceColIndex, bi = b.sourceColIndex
  if (ai == null && bi == null) return (a.order ?? 0) - (b.order ?? 0)
  if (ai == null) return 1
  if (bi == null) return -1
  return ai - bi
}

// Builds one output workbook: one sheet per requested group, each a faithful
// crop of the original Product Data Sheet down to just that group's columns
// — same title row, same group-label row, same header row (values, styling,
// column widths all copied straight from the source), same left-to-right
// column sequence — with that group's current rows filled in starting where
// real data started in the original. Every other original sheet (e.g. the
// Dropdown Reference sheet) is carried over verbatim. `groupSheets`:
// [{ group, sheetLabel, headers, rows, includeSku }].
export async function buildFormatPreservingWorkbook({ sourceFileUrl, sourceSheetName, groupSheets }) {
  const ExcelJS = await loadExcelJS()
  const original = await loadOriginalWorkbook(sourceFileUrl)
  const originalWs = original.getWorksheet(sourceSheetName) || original.worksheets[0]
  const output = new ExcelJS.Workbook()

  for (const { group, sheetLabel, headers, rows, includeSku } of groupSheets) {
    const ws = output.addWorksheet(String(sheetLabel || GROUP_LABELS[group] || group).slice(0, 31))
    const sortedHeaders = [...(headers || [])].sort(bySourceSequence)
    const filledRows = nonEmptyRows(rows)
    const skuCol = sortedHeaders.length + 1
    const lastCol = includeSku ? skuCol : sortedHeaders.length

    // Row 1 (title) + the group-label row above the real headers — copied
    // from whichever of this group's columns still exists in the source
    // file, then re-merged across the full width of this sheet so it reads
    // as one banner, exactly like the original.
    const firstSourceCol = sortedHeaders.find((h) => h.sourceColIndex != null)?.sourceColIndex
    if (originalWs && firstSourceCol != null && lastCol > 0) {
      const titleSource = originalWs.getCell(1, firstSourceCol + 1)
      const titleCell = ws.getCell(1, 1)
      titleCell.value = titleSource.value ?? sheetLabel
      copyCellStyle(titleSource, titleCell)
      if (lastCol > 1) ws.mergeCells(1, 1, 1, lastCol)

      const groupLabelSource = originalWs.getCell(GROUP_LABEL_EXCEL_ROW, firstSourceCol + 1)
      const groupLabelCell = ws.getCell(GROUP_LABEL_EXCEL_ROW, 1)
      groupLabelCell.value = groupLabelSource.value ?? sheetLabel
      copyCellStyle(groupLabelSource, groupLabelCell)
      if (lastCol > 1) ws.mergeCells(GROUP_LABEL_EXCEL_ROW, 1, GROUP_LABEL_EXCEL_ROW, lastCol)
    }

    sortedHeaders.forEach((h, i) => {
      const col = i + 1
      const headerCell = ws.getCell(HEADER_EXCEL_ROW, col)
      headerCell.value = h.label
      if (originalWs && h.sourceColIndex != null) {
        copyCellStyle(originalWs.getCell(HEADER_EXCEL_ROW, h.sourceColIndex + 1), headerCell)
        const width = originalWs.getColumn(h.sourceColIndex + 1).width
        if (width) ws.getColumn(col).width = width
      } else {
        headerCell.font = { bold: true }
      }
    })
    if (includeSku) {
      const skuCell = ws.getCell(HEADER_EXCEL_ROW, skuCol)
      skuCell.value = 'SKU'
      skuCell.font = { bold: true }
    }

    filledRows.forEach((row, rowIdx) => {
      const excelRow = DATA_START_ROW_EXCEL + rowIdx
      sortedHeaders.forEach((h, i) => {
        const col = i + 1
        const cell = ws.getCell(excelRow, col)
        if (originalWs && h.sourceColIndex != null) {
          copyCellStyle(originalWs.getCell(DATA_START_ROW_EXCEL, h.sourceColIndex + 1), cell)
        }
        cell.value = row[h.id] ?? ''
      })
      if (includeSku) ws.getCell(excelRow, skuCol).value = row.sku ?? ''
    })
  }

  original.eachSheet((sourceWs) => {
    if (sourceWs === originalWs) return
    cloneWorksheetVerbatim(output, sourceWs)
  })

  return output
}

export async function downloadFormatPreservingExcel({ sourceFileUrl, sourceSheetName, groupSheets, filename }) {
  const workbook = await buildFormatPreservingWorkbook({ sourceFileUrl, sourceSheetName, groupSheets })
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
