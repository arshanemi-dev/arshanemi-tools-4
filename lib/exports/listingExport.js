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
  const hasSku = sheet.group === 'design_system'
  const cols = hasSku ? [...headerRow, 'SKU'] : headerRow
  const dataRows = (sheet.rows || [])
    .filter((row) => Object.values(row).some((v) => String(v ?? '').trim()))
    .map((row) => {
      const cells = headers.map((h) => row[h.id] ?? '')
      return hasSku ? [...cells, row.sku ?? ''] : cells
    })
  return [cols, ...dataRows]
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
// excelTemplateEngine's format-preserving builder instead: one output sheet
// per requested group, styled like the original Product Data Sheet's real
// columns, plus every other original sheet (e.g. Dropdown Reference) carried
// over unchanged. Templates without a stored original file — old templates,
// or ones uploaded as legacy .xls — fall back to the plain generator below
// unchanged, so nothing regresses. Not used for the cross-template aggregate
// "Product Details"/"Prefill Details" exports (product-details/page.js's
// handleExportAll etc.), which combine rows from multiple templates and have
// no single source file to honor — those keep calling downloadExcel directly.
export async function downloadExcelSmart(template, meta, { groups, filename } = {}) {
  const effectiveGroups = groups || ['design_system', 'compulsory', 'prefill', 'optional']
  if (!meta?.sourceFileUrl || !meta?.sourceSheetName) {
    return downloadExcel(template, { groups: effectiveGroups, filename })
  }

  const { downloadFormatPreservingExcel } = await import('./excelTemplateEngine')
  const groupSheets = sheetsForGroups(template, effectiveGroups).map((sheet) => ({
    group: sheet.group,
    sheetLabel: sheet.sheetName || GROUP_LABELS[sheet.group] || sheet.group,
    headers: sheet.headers,
    rows: sheet.rows,
    includeSku: sheet.group === 'design_system',
  }))
  if (groupSheets.length === 0) return downloadExcel(template, { groups: effectiveGroups, filename })

  await downloadFormatPreservingExcel({
    sourceFileUrl: meta.sourceFileUrl,
    sourceSheetName: meta.sourceSheetName,
    groupSheets,
    filename: filename || `${safeFilePart(meta.templateName || template.templateName)}.xlsx`,
  })
}

// Row count across the requested groups — the billable quantity (1 coin per
// product row, per the confirmed billing decision). Counts design_system
// rows as the unit of "a product row"; falls back to whichever group is
// requested when design_system isn't included.
export function countBillableRows(template, groups) {
  const primary = groups.includes('design_system') ? 'design_system' : groups[0]
  const sheet = (template.sheets || []).find((s) => s.group === primary)
  if (!sheet) return 0
  return (sheet.rows || []).filter((row) => Object.values(row).some((v) => String(v ?? '').trim())).length
}
