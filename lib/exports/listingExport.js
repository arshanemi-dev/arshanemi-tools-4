'use client'
// Client-side export generation — Excel via SheetJS (`xlsx`), PDF via
// jsPDF + jspdf-autotable. Both are dynamically imported so their bundles
// only load when a user actually clicks Download, not on every page visit.
//
// This runs entirely in the browser: the template content is already loaded
// client-side by the time Download is clickable, so the file itself never
// makes a server round trip — only SKU assignment (needs the server's SKU
// registry) and the billing gate call go over the network, and per this
// tool's billing decision the file always finishes generating and
// downloading regardless of how either of those resolve.
import { expandMultiSelectRows } from './expandMultiSelectRows'

const GROUP_LABELS = {
  design_system: 'Product details',
  compulsory: 'Compulsory',
  prefill: 'Prefill',
  optional: 'Optional',
}

function safeFilePart(name) {
  return String(name || 'listing').trim().replace(/[^a-z0-9\-_]+/gi, '-').slice(0, 60) || 'listing'
}

function sheetToAoa(sheet) {
  const headers = [...(sheet.headers || [])].sort((a, b) => a.order - b.order)
  const headerRow = headers.map((h) => h.label)
  // `aiFilled` (plan §14) is a bookkeeping key, not a header id — excluded so
  // it can never make an otherwise-blank row count as "filled" (which would
  // both export a stray blank row and, in countBillableRows below, overbill
  // an export that shouldn't count that row at all).
  const filledRows = (sheet.rows || []).filter((row) => Object.entries(row).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim()))
  // One row per Multi Select option (e.g. Variations "34, 35, 36" -> 3
  // rows) — only at export time, never in the on-screen grid. Shared by
  // Excel and PDF alike since both build off this same aoa.
  const dataRows = expandMultiSelectRows(headers, filledRows)
    .map((row) => headers.map((h) => row[h.id] ?? ''))
  return [headerRow, ...dataRows]
}

function sheetsForGroups(template, groups) {
  return (template.sheets || []).filter((s) => groups.includes(s.group))
}

export async function downloadExcel(template, { groups, filename } = {}) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const sheet of sheetsForGroups(template, groups || ['design_system', 'compulsory', 'prefill', 'optional'])) {
    const aoa = sheetToAoa(sheet)
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, (sheet.sheetName || GROUP_LABELS[sheet.group] || sheet.group).slice(0, 31))
  }
  XLSX.writeFile(wb, filename || `${safeFilePart(template.templateName)}.xlsx`)
}

export async function downloadPdf(template, { groups, filename } = {}) {
  const { jsPDF } = await import('jspdf')
  const autoTableModule = await import('jspdf-autotable')
  const autoTable = autoTableModule.default || autoTableModule
  const doc = new jsPDF({ orientation: 'landscape' })
  const sheets = sheetsForGroups(template, groups || ['design_system', 'compulsory', 'prefill', 'optional'])

  sheets.forEach((sheet, i) => {
    if (i > 0) doc.addPage()
    const [head, ...body] = sheetToAoa(sheet)
    doc.setFontSize(12)
    doc.text(sheet.sheetName || GROUP_LABELS[sheet.group] || sheet.group, 14, 12)
    autoTable(doc, {
      head: [head],
      body,
      startY: 16,
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [79, 70, 229] },
    })
  })

  doc.save(filename || `${safeFilePart(template.templateName)}.pdf`)
}

// Same job as downloadExcel, but when `meta` names a real original upload
// (sourceFileUrl + sourceSheetName — set on templates created after this
// existed, and only for real .xlsx uploads), it delegates to
// excelTemplateEngine's format-preserving builder instead — the *actual*
// original workbook, same sheets, same styling, just its data rows refreshed
// with the current app data, so the file that comes out looks exactly like
// the file that went in. Templates without a stored original file — old
// templates, or ones uploaded as legacy .xls — fall back to the plain
// generator below unchanged, so nothing regresses.
export async function downloadExcelSmart(template, meta, { groups, filename } = {}) {
  const effectiveGroups = groups || ['design_system', 'compulsory', 'prefill', 'optional']
  if (!meta?.sourceFileUrl || !meta?.sourceSheetName) {
    return downloadExcel(template, { groups: effectiveGroups, filename })
  }

  const sheets = sheetsForGroups(template, effectiveGroups)
  if (sheets.length === 0) return downloadExcel(template, { groups: effectiveGroups, filename })

  // Row i in every requested group is the same product (see
  // app/listing-tools/auto-details/page.js) — merge them into one combined row per product
  // *before* expanding Multi Select columns, so a product's variations still repeat every
  // group's own data identically across their expanded rows, not just Product Details' own
  // columns. Header ids are unique across the whole template, so a plain merge can't collide.
  const mergedHeaders = sheets.flatMap((s) => s.headers || [])
  const rowCount = Math.max(0, ...sheets.map((s) => (s.rows || []).length))
  const mergedRows = Array.from({ length: rowCount }, (_, i) => Object.assign({}, ...sheets.map((s) => s.rows?.[i] || {})))
  const expandedRows = expandMultiSelectRows(mergedHeaders, mergedRows)

  const { downloadFormatPreservingExcel } = await import('./excelTemplateEngine')
  await downloadFormatPreservingExcel({
    sourceFileUrl: meta.sourceFileUrl,
    sourceSheetName: meta.sourceSheetName,
    headers: mergedHeaders,
    rows: expandedRows,
    filename: filename || `${safeFilePart(meta.templateName || template.templateName)}.xlsx`,
  })
}

// Row count across the requested groups — the billable quantity (1 coin per
// product row, per the confirmed billing decision). Counts design_system
// rows as the unit of "a product row"; falls back to whichever group is
// requested when design_system isn't included. Counts the *expanded* row
// count (post Multi Select explosion) — matches what actually lands in the
// exported file, since each variation becomes its own real listing row.
export function countBillableRows(template, groups) {
  const primary = groups.includes('design_system') ? 'design_system' : groups[0]
  const sheet = (template.sheets || []).find((s) => s.group === primary)
  if (!sheet) return 0
  // `aiFilled` (plan §14) is a bookkeeping key, not a header id — excluded so
  // it can never make an otherwise-blank row count as "filled" (which would
  // both export a stray blank row and, in countBillableRows below, overbill
  // an export that shouldn't count that row at all).
  const filledRows = (sheet.rows || []).filter((row) => Object.entries(row).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim()))
  return expandMultiSelectRows(sheet.headers, filledRows).length
}
