// How a raw header cell off an uploaded marketplace sheet becomes a header
// label — shared by the bulk page's extraction (BulkTemplateDesign.jsx) and
// the export engine (lib/exports/excelTemplateEngine.js), which looks a
// field's mapped columns up by name in that same header row: both have to
// read a cell exactly the same way, or a column found at mapping time is
// missed at download time. Plain functions, no imports — safe on the client.

// Single-line cleanup only — collapses whitespace and trims. Used on its
// own for simple values (the I section row's note text), and as the final
// step inside splitHeaderCell below for the label/description it pulls
// apart.
export function cleanLabel(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim()
}

// Same idea as TemplateSettingsWizard.jsx's own splitHeaderCell — a header
// cell often carries a short title plus a longer instructional note, either
// on its own line (Alt+Enter/wrap-text, which SheetJS preserves as a literal
// \n) or with no line break at all, just run on after a "Please enter…"/
// "Note:" lead-in ("Product Name Please enter the product name. Note: Please
// avoid adding product features such as weight, dimension, price description
// here."). Both resolve to a short `label` with the note captured separately
// as `description` — feeds the SAME target as the I section row's own note
// (see the bulk page's extraction), and wins over it when both are present,
// since an in-cell note is more specific to this exact column than a row
// shared across every column.
const NOTE_LEAD_IN = /\s+(please\s+(?:enter|select|provide|choose|fill|add|note)\b|note\s*:|instructions?\s*:)/i
export function splitHeaderCell(raw) {
  const normalized = String(raw ?? '').replace(/ /g, ' ').replace(/\r\n/g, '\n')
  const lines = normalized.split('\n').map((l) => cleanLabel(l)).filter(Boolean)
  if (lines.length > 1) {
    return { label: lines[0], description: lines.slice(1).join(' ') }
  }
  const single = cleanLabel(normalized)
  const match = single.match(NOTE_LEAD_IN)
  if (match && match.index > 0) {
    return { label: single.slice(0, match.index).trim(), description: single.slice(match.index).trim() }
  }
  return { label: single, description: '' }
}

// A marketplace sheet can use one header name on several columns (Amazon:
// "Other Image URL" ×8, "Bullet Point" ×5, …). Each of those is its own
// column to map and fill, so each needs its own name: the first column keeps
// the name as written, every later one gets the next number after it —
// "Other Image URL", "Other Image URL 2", "Other Image URL 3". Names that
// appear once are never touched.
//
// `labels` — the header row's labels in sheet order, repeats included (same
// name = same text ignoring case). Returns the unique names, same length and
// order. A number the sheet already uses for a real header is skipped
// ("Image", "Image", "Image 2" → "Image", "Image 3", "Image 2"), so a made-up
// name never takes a real one.
export function numberRepeatedLabels(labels) {
  const taken = new Set(labels.map((l) => l.toLowerCase()))
  const lastNumber = new Map()
  return labels.map((label) => {
    const key = label.toLowerCase()
    if (!lastNumber.has(key)) { lastNumber.set(key, 1); return label }
    let n = lastNumber.get(key) + 1
    while (taken.has(`${key} ${n}`)) n += 1
    lastNumber.set(key, n)
    taken.add(`${key} ${n}`)
    return `${label} ${n}`
  })
}
