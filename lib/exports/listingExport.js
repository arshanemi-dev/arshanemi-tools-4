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
  design_system: 'Design details',
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
