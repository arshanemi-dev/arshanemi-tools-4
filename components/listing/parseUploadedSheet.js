// Shared "Upload Sheet" / "Upload Old Sheet" parser — matches an uploaded
// .xlsx's first sheet columns to the current grid's headers by label text
// (case-insensitive), so re-uploading an updated copy of the same sheet
// slots straight into the existing header ids without the user re-mapping
// anything. Columns with no matching header are silently dropped.
export async function parseUploadedSheetRows(file, headers) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const [headerRow, ...dataRows] = aoa
  const labelToId = Object.fromEntries(headers.map((h) => [String(h.label).trim().toLowerCase(), h.id]))

  return dataRows
    .filter((r) => (r || []).some((v) => String(v ?? '').trim()))
    .map((r) => {
      const row = {}
      ;(headerRow || []).forEach((label, i) => {
        const id = labelToId[String(label ?? '').trim().toLowerCase()]
        if (id) row[id] = r[i] ?? ''
      })
      return row
    })
}

// "Upload Old Sheet" on the single-template workspace re-uploads one sheet
// without the user telling us which of the 3 non-Design-System groups it
// belongs to — picks whichever group's headers overlap the uploaded file's
// header row the most, rather than requiring a group picker for what's
// meant to be a quick re-sync action.
export async function importIntoBestMatchingGroup(file, sheets) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const [headerRow, ...dataRows] = aoa
  const uploadedLabels = new Set((headerRow || []).map((l) => String(l).trim().toLowerCase()))

  let bestGroup = null
  let bestScore = 0
  for (const sheet of sheets) {
    const score = sheet.headers.filter((h) => uploadedLabels.has(String(h.label).trim().toLowerCase())).length
    if (score > bestScore) { bestScore = score; bestGroup = sheet.group }
  }
  if (!bestGroup) return null

  const targetSheet = sheets.find((s) => s.group === bestGroup)
  const labelToId = Object.fromEntries(targetSheet.headers.map((h) => [String(h.label).trim().toLowerCase(), h.id]))
  const rows = dataRows
    .filter((r) => (r || []).some((v) => String(v ?? '').trim()))
    .map((r) => {
      const row = {}
      ;(headerRow || []).forEach((label, i) => {
        const id = labelToId[String(label ?? '').trim().toLowerCase()]
        if (id) row[id] = r[i] ?? ''
      })
      return row
    })
  return { group: bestGroup, rows }
}
