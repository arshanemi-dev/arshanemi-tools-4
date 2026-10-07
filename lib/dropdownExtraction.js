// Dropdown-value extraction for the bulk mapping page (BulkTemplateDesign.jsx).
// Every fill-sheet header is checked against four independent sources, and
// the first one (in this priority order) that has values wins:
//   1. excel      — the column's own Excel list data-validation (what Excel
//                   itself enforces, so it's the most trustworthy)
//   2. validation — a matching header on the selected Validations sheet,
//                   read either Vertical (headers across one row, values down
//                   each column) or Horizontal (headers down one column,
//                   values across each row)
//   3. allowed    — an "Allowed Values" block on another sheet
//                   (Flipkart's Index sheet)
//   4. input      — repeated values in the fill sheet's own input rows
// Every source's count is kept per header (not just the winner's) so the
// Dropdown Values Debug panel can show where each list came from and where
// the sources disagree. Pure functions, no React — the page calls these
// from both its live extraction effect and its multi-file upload path.
import { createDropdownSourceProbe } from './sheetDataValidations'
import { isSheetHidden } from './sheetVisibility'

export const DROPDOWN_SOURCES = ['excel', 'validation', 'allowed', 'input']
export const DROPDOWN_SOURCE_META = {
  excel: { label: 'Excel dropdown', hint: "The column's own Excel data-validation list" },
  validation: { label: 'Validations sheet', hint: 'A matching header on the selected Validations sheet' },
  allowed: { label: 'Allowed values', hint: 'An "Allowed Values" block on another sheet' },
  input: { label: 'Input rows', hint: "Values repeated across the fill sheet's own input rows" },
}

const MAX_OPTION_LEN = 70
const MAX_VALUES = 2000
const SCAN_LINES = 12 // candidate header rows (vertical) / columns (horizontal) auto-detect tries
const VALIDATION_NAME_RE = /valid|drop\s*-?down|lookup|allowed|reference|list/i
const NOT_VALIDATION_NAME_RE = /sample|example|instruction|guide|help|read\s*me|demo/i
const FLAG_VALUE_RE = /^(mandatory|optional|required|compulsory|recommended|conditional(ly)?\s+mandatory)$/i
const NOTE_RE = /\b(please|e\.g\.|example|note)\b/i
const BRACKETED_RE = /\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g
const FLAG_WORD_RE = /\b(optional|mandatory|required|compulsory|recommended)\b/g
const SPELLING = { colour: 'color', colours: 'color' }

export function columnLetter(idx) {
  let n = idx + 1
  let s = ''
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) }
  return s
}

// "Select…", "Choose an option", "N/A", "--", "TBD", or the header's own
// name — filler a sheet has sitting in with the real options.
export function isPlaceholderValue(value, headerName = '') {
  if (value === undefined || value === null) return true
  const str = String(value).trim()
  if (str === '') return true
  if (headerName && str.toLowerCase() === headerName.trim().toLowerCase()) return true
  const isInstruction = /^(select|choose|enter|type|pick)(\s+\S+)*$/i.test(str)
  const isHeaderDefault = /^product\s+.*%$/i.test(str)
  const isNullMarker = /^(none|null|undefined|n[\/\s-]?a|tbd|-+|\.+)$/i.test(str)
  return isInstruction || isHeaderDefault || isNullMarker
}
// A real pick-list option: short, not filler, not a Mandatory/Optional flag.
function isOptionValue(text, header) {
  return text.length < MAX_OPTION_LEN && !isPlaceholderValue(text, header) && !FLAG_VALUE_RE.test(text)
}
// A description/instruction line sitting between a header and its values.
function isDescriptiveText(text) {
  return text.length >= 40 || isPlaceholderValue(text) || FLAG_VALUE_RE.test(text) || NOTE_RE.test(text)
}

// ---------- header-name matching ----------

function cleanHeaderText(text) {
  const first = String(text ?? '').replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).find(Boolean) || ''
  return first.replace(/\s*\*+\s*$/, '').replace(/\s*:\s*$/, '').trim()
}
const strictKey = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
function tokensOf(s) {
  return String(s ?? '').toLowerCase().replace(BRACKETED_RE, ' ').replace(FLAG_WORD_RE, ' ')
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    .map((t) => SPELLING[t] || (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t))
}
// Ignores case, punctuation, (bracketed notes), Mandatory/Optional words,
// plurals and colour/color — "Colours (Optional)" ≡ "color".
const looseKey = (s) => tokensOf(s).join('')

function keySets(labels) {
  return { strict: new Set(labels.map(strictKey).filter(Boolean)), loose: new Set(labels.map(looseKey).filter(Boolean)) }
}

// One side's words appearing as a contiguous run inside the other's —
// "Sleeve Length" in "Sleeve Length Type". Score = how much of the longer
// name that run covers; 0 when there's no such run.
function containmentScore(a, b) {
  if (!a.length || !b.length) return 0
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.join('').length < 4) return 0
  for (let i = 0; i + short.length <= long.length; i++) {
    if (short.every((t, j) => long[i + j] === t)) return short.length / long.length
  }
  return 0
}

// productLabels → Validations-sheet column, one-to-one, strongest evidence
// first: exact (case/punctuation-insensitive) → normalized (looseKey) →
// fuzzy (containment ≥ 0.5, skipped when two candidates tie).
// Returns Map(label → { column, matchType }).
export function matchValidationColumns(productLabels, columns) {
  const out = new Map()
  const claimed = new Set()
  const passes = [
    ['exact', (label, col) => strictKey(label) === col.key],
    ['normalized', (label, col) => !!col.loose && looseKey(label) === col.loose],
  ]
  for (const [matchType, test] of passes) {
    for (const label of productLabels) {
      if (out.has(label)) continue
      const col = columns.find((c) => !claimed.has(c.key) && test(label, c))
      if (col) { out.set(label, { column: col, matchType }); claimed.add(col.key) }
    }
  }
  const pairs = []
  for (const label of productLabels) {
    if (out.has(label)) continue
    const lt = tokensOf(label)
    for (const col of columns) {
      if (claimed.has(col.key)) continue
      const score = containmentScore(lt, col.tokens)
      if (score >= 0.5) pairs.push({ label, col, score })
    }
  }
  pairs.sort((a, b) => b.score - a.score)
  for (const p of pairs) {
    if (out.has(p.label) || claimed.has(p.col.key)) continue
    const tied = pairs.some((q) => q !== p && q.score === p.score
      && ((q.label === p.label && !claimed.has(q.col.key)) || (q.col.key === p.col.key && !out.has(q.label))))
    if (tied) continue
    out.set(p.label, { column: p.col, matchType: 'fuzzy' })
    claimed.add(p.col.key)
  }
  return out
}

// ---------- Validations sheet reading ----------

// Every non-blank cell once, row-major — O(filled cells) however large the
// sheet's !ref claims to be, and indexed by row and column so each layout
// candidate below doesn't re-walk the raw sheet. Cached per worksheet.
const gridCache = new WeakMap()
function gridOf(XLSX, ws) {
  if (!ws) return { cells: [], byRow: new Map(), byCol: new Map(), byKey: new Map(), merges: [], mergeTopLeft: new Set() }
  const hit = gridCache.get(ws)
  if (hit) return hit
  const cells = []
  for (const addr of Object.keys(ws)) {
    if (addr[0] === '!') continue
    const cell = ws[addr]
    if (!cell || cell.t === 'e' || cell.t === 'z' || cell.v === undefined || cell.v === null) continue
    const text = String(cell.w ?? cell.v).replace(/ /g, ' ').trim()
    if (!text) continue
    const { r, c } = XLSX.utils.decode_cell(addr)
    cells.push({ r, c, text })
  }
  cells.sort((a, b) => a.r - b.r || a.c - b.c)
  const byRow = new Map()
  const byCol = new Map()
  for (const cell of cells) {
    if (!byRow.has(cell.r)) byRow.set(cell.r, [])
    byRow.get(cell.r).push(cell)
    if (!byCol.has(cell.c)) byCol.set(cell.c, [])
    byCol.get(cell.c).push(cell)
  }
  // Merged ranges (SheetJS ws['!merges']) that really span 2+ cells — only
  // their top-left cell carries the text. See readLayout for how they're read.
  const merges = (ws['!merges'] || []).filter((m) => m.s.r !== m.e.r || m.s.c !== m.e.c)
  const mergeTopLeft = new Set(merges.map((m) => `${m.s.r},${m.s.c}`))
  const byKey = new Map(cells.map((x) => [`${x.r},${x.c}`, x]))
  const grid = { cells, byRow, byCol, byKey, merges, mergeTopLeft }
  gridCache.set(ws, grid)
  return grid
}

// Vertical: headers sit on a ROW, each header's values run down its column.
// Horizontal: headers sit in a COLUMN, each header's values run across its row.
// `line` is the row/column index a cell sits on along the header axis;
// `slot` is which header a value belongs to.
const axis = (orientation) => (orientation === 'horizontal'
  ? { line: (x) => x.c, slot: (x) => x.r, lines: 'byCol' }
  : { line: (x) => x.r, slot: (x) => x.c, lines: 'byRow' })

// A merged range in line/slot terms (see axis above).
const mergeSpan = (orientation, m) => (orientation === 'horizontal'
  ? { line0: m.s.c, line1: m.e.c, slot0: m.s.r, slot1: m.e.r }
  : { line0: m.s.r, line1: m.e.r, slot0: m.s.c, slot1: m.e.c })
function mergeAt(grid, orientation, line, slot) {
  for (const m of grid.merges) {
    const s = mergeSpan(orientation, m)
    if (line >= s.line0 && line <= s.line1 && slot >= s.slot0 && slot <= s.slot1) return s
  }
  return null
}
const cellAt = (grid, orientation, line, slot) => grid.byKey.get(orientation === 'horizontal' ? `${slot},${line}` : `${line},${slot}`)

// One slot's header, merged cells handled:
// - a merge spanning SEVERAL slots on the header line (e.g. "MEN" merged over
//   Young / Old / Baby — Vertical: across columns, Horizontal: down rows) is
//   a group label, never a header: skip past its last line and read the next
//   row (Vertical) / column (Horizontal) — again and again while that's a
//   group merge too;
// - a merge inside this ONE slot is still its own header, just taller/wider:
//   read its first cell, values start after it ends.
// → { cell, top, last }: the header cell (or undefined), the line it's read
//   from, and the last line it occupies.
function resolveHeaderCell(grid, orientation, headerLine, slot) {
  let line = headerLine
  for (let guard = 0; guard < SCAN_LINES; guard++) {
    const m = mergeAt(grid, orientation, line, slot)
    if (!m) return { cell: cellAt(grid, orientation, line, slot), top: line, last: line }
    if (m.slot0 !== m.slot1) { line = m.line1 + 1; continue }
    return { cell: cellAt(grid, orientation, m.line0, slot), top: m.line0, last: m.line1 }
  }
  return { cell: undefined, top: line, last: line }
}

// `startSlot` (0-based) skips every slot before it — the brand's Start
// column (Vertical) / row (Horizontal), constants/sheetDefaults.js.
function readLayout(grid, { orientation, headerLine, valuesLine, startSlot = 0 }) {
  const ax = axis(orientation)
  // Every slot with a header-line cell, plus every slot a merge covers on
  // that line (a merge's other cells hold no text of their own).
  const slots = new Set((grid[ax.lines].get(headerLine) || []).map(ax.slot))
  for (const m of grid.merges) {
    const sp = mergeSpan(orientation, m)
    if (headerLine < sp.line0 || headerLine > sp.line1) continue
    for (let k = sp.slot0; k <= sp.slot1 && k - sp.slot0 < 500; k++) slots.add(k)
  }
  const heads = new Map() // slot → { name, from }
  for (const slot of slots) {
    if (slot < startSlot) continue
    const { cell, top, last } = resolveHeaderCell(grid, orientation, headerLine, slot)
    const name = cell ? cleanHeaderText(cell.text) : ''
    if (!name || /^\d+(\.\d+)?$/.test(name)) continue
    // Values keep the sheet's own header→values distance when the header had
    // to move down/right past a group label — and always start after the
    // header cell itself. Unmerged headers: exactly valuesLine, as before.
    heads.set(slot, { name, from: Math.max(valuesLine + (top - headerLine), last + 1) })
  }
  if (!heads.size) return []
  const raw = new Map([...heads.keys()].map((s) => [s, []]))
  for (const cell of grid.cells) {
    const head = heads.get(ax.slot(cell))
    if (!head || ax.line(cell) < head.from) continue
    if (grid.mergeTopLeft.has(`${cell.r},${cell.c}`)) continue // merged cells are never values
    const list = raw.get(ax.slot(cell))
    if (list.length < MAX_VALUES * 2) list.push(cell.text)
  }
  // Same header twice on the sheet → one list with both sets of values.
  const byKey = new Map()
  for (const [slot, { name }] of heads) {
    const key = strictKey(name)
    if (!key) continue
    const values = raw.get(slot).filter((v) => isOptionValue(v, name))
    const entry = byKey.get(key)
    if (entry) entry.values.push(...values)
    else byKey.set(key, { name, key, loose: looseKey(name), tokens: tokensOf(name), line: slot, values })
  }
  return [...byKey.values()].map((e) => ({ ...e, values: [...new Set(e.values)].slice(0, MAX_VALUES) }))
}

export function readValidationSheet(XLSX, wb, layout) {
  if (!layout?.sheetName) return []
  return readLayout(gridOf(XLSX, wb?.Sheets?.[layout.sheetName]), layout)
}

// First line after the header that holds real values — skips a
// description / "Mandatory" / "Please select…" line sitting in between
// (Meesho's Validation sheet: header row 1, notes row 2, values from row 3).
function firstValuesLine(grid, orientation, headerLine) {
  const ax = axis(orientation)
  const headSlots = new Set((grid[ax.lines].get(headerLine) || []).map(ax.slot))
  for (let line = headerLine + 1; line <= headerLine + 3; line++) {
    const onLine = (grid[ax.lines].get(line) || []).filter((x) => headSlots.has(ax.slot(x)))
    if (!onLine.length) continue
    const descriptive = onLine.filter((x) => isDescriptiveText(x.text)).length
    if (descriptive * 2 < onLine.length) return line
  }
  return headerLine + 1
}

function scoreColumns(columns, keys) {
  const score = { lists: 0, matched: 0, values: 0 }
  for (const col of columns) {
    if (col.values.length < 2) continue
    score.lists += 1
    score.values += col.values.length
    if (keys.strict.has(col.key) || keys.loose.has(col.loose)) score.matched += 1
  }
  return score
}
const betterScore = (a, b) => (a.matched !== b.matched ? a.matched > b.matched : a.lists > b.lists)
function rankBeats(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

// Best { orientation, headerLine, valuesLine } (all 0-based) for one sheet,
// scored by how many of the fill sheet's own headers it matches, then how
// many real lists it yields. `hint` (the marketplace rule's layout) is tried
// first and keeps ties. Horizontal only wins with STRICTLY more matches —
// read sideways, any ordinary vertical sheet also "yields lists" (one per
// row), so without matches to go on, vertical is the safe default.
// `orientation` forces one orientation (the toggle), picking the best lines for it.
export function detectValidationLayout(XLSX, wb, sheetName, productLabels = [], { orientation = null, hint = null } = {}) {
  const grid = gridOf(XLSX, wb?.Sheets?.[sheetName])
  const keys = keySets(productLabels)
  const best = {}
  const consider = (layout) => {
    const score = scoreColumns(readLayout(grid, layout), keys)
    const cur = best[layout.orientation]
    if (!cur || betterScore(score, cur.score)) best[layout.orientation] = { layout, score }
  }
  if (hint && (!orientation || hint.orientation === orientation)) consider(hint)
  for (const o of orientation ? [orientation] : ['vertical', 'horizontal']) {
    const lines = grid[axis(o).lines]
    for (let h = 0; h < SCAN_LINES; h++) {
      if (lines.has(h)) consider({ orientation: o, headerLine: h, valuesLine: firstValuesLine(grid, o, h) })
    }
  }
  const v = best.vertical
  const h = best.horizontal
  const pick = h && (!v || h.score.matched > v.score.matched) ? h : v
  if (!pick) return { orientation: orientation || 'vertical', headerLine: 0, valuesLine: 1, score: { lists: 0, matched: 0, values: 0 } }
  return { ...pick.layout, score: pick.score }
}

// Upload-time pick of which sheet (if any) is the Validations sheet — every
// sheet but the fill sheet is scored with detectValidationLayout; a sheet
// qualifies with 2+ matched headers, or a validation-ish name plus some
// evidence. Sample/instruction sheets are skipped — a filled sample copy of
// the fill sheet "matches" every header and would pass its example data off
// as dropdown options. Returns { sheetName, orientation, headerLine,
// valuesLine } or null.
export function autoPickValidationSheet(XLSX, wb, { dataSheetName, productLabels = [], hintSheetName = '', hintLayout = null }) {
  let best = null
  for (const name of wb?.SheetNames || []) {
    // Hidden sheets are never considered (sheetVisibility.js) — only Excel's
    // own dropdown lists may still point into one.
    if (name === dataSheetName || isSheetHidden(wb, name)) continue
    const named = VALIDATION_NAME_RE.test(name)
    if (!named && NOT_VALIDATION_NAME_RE.test(name)) continue
    const layout = detectValidationLayout(XLSX, wb, name, productLabels, { hint: name === hintSheetName ? hintLayout : null })
    const { matched, lists } = layout.score
    if (!(matched >= 2 || (named && (matched >= 1 || lists >= 2)))) continue
    const rank = [matched, named ? 1 : 0, lists]
    if (!best || rankBeats(rank, best.rank)) best = { rank, sheetName: name, layout }
  }
  if (!best) return null
  const { orientation, headerLine, valuesLine } = best.layout
  return { sheetName: best.sheetName, orientation, headerLine, valuesLine }
}

// The Validations-sheet layout one extraction pass should actually use,
// resolved against the fill sheet's headers as JUST read — so fixing the
// fill sheet's Header Row re-aligns the Validations sheet too, instead of
// leaving a layout detected against the wrong headers. Only what the user
// hasn't overridden is auto:
//   sheetMode  'auto'   → pick the sheet (autoPickValidationSheet)
//              'pinned' → use sheetName ('' = None)
//   layoutMode 'auto'        → detect orientation + lines
//              'orientation' → keep the toggled orientation, detect lines
//              'manual'      → use the typed lines + start slot as-is
// Only 'manual' keeps a start slot — a column number doesn't carry over to
// a detected (maybe re-oriented) layout, so every other mode reads from 0.
// Returns { sheetName, orientation, headerLine, valuesLine, startSlot } (0-based) or null.
export function resolveValidationLayout(XLSX, wb, {
  dataSheetName, productLabels = [], hintSheetName = '', hintLayout = null,
  sheetMode = 'auto', sheetName = '', layoutMode = 'auto', orientation = 'vertical', headerLine = 0, valuesLine = 1, startSlot = 0,
}) {
  if (sheetMode !== 'pinned') {
    return autoPickValidationSheet(XLSX, wb, { dataSheetName, productLabels, hintSheetName, hintLayout })
  }
  if (!sheetName || !wb?.Sheets?.[sheetName]) return null
  if (layoutMode === 'manual') return { sheetName, orientation, headerLine, valuesLine, startSlot }
  const hint = sheetName === hintSheetName ? hintLayout : null
  const forced = layoutMode === 'orientation' ? orientation : null
  const detected = detectValidationLayout(XLSX, wb, sheetName, productLabels, { orientation: forced, hint })
  return { sheetName, orientation: detected.orientation, headerLine: detected.headerLine, valuesLine: detected.valuesLine }
}

// ---------- input rows ----------

// A column counts as a dropdown off its own filled input rows when values
// repeat (2-20 distinct, fewer distinct than filled) rather than reading
// like free text — and aren't all plain numbers (a quantity/price column
// repeats too, but it's typed, not picked). `filled` (every distinct value,
// dropdown or not) is kept for the debug panel's "input values outside the
// list" check.
export function detectInputRowValues(dataRows, colIdx, headerLabel) {
  const raw = []
  for (const row of dataRows) {
    const v = row?.[colIdx]
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (s && isOptionValue(s, headerLabel)) raw.push(s)
  }
  const filled = [...new Set(raw)]
  const repeats = raw.length >= 2 && filled.length >= 2 && filled.length <= 20 && filled.length < raw.length
  const allNumeric = filled.every((v) => /^-?\d+(\.\d+)?$/.test(v))
  return { values: repeats && !allNumeric ? filled : null, filled }
}

// ---------- the whole pass ----------

// headerCells: [{ label, sheetLabel?, colIdx }] — the fill sheet's cleaned
// headers, one per column, with their real column index (from
// dataStartColIdx on, only for the report). `label` is unique; `sheetLabel`
// is the name as the sheet writes it, which differs only on a repeated
// column ("Other Image URL 2" → "Other Image URL", lib/sheetHeaderLabel.js's
// numberRepeatedLabels). A repeated column is the same field as the first,
// so everything found by NAME (Validations sheet, Allowed Values) is looked
// up by sheetLabel and shared; only what's read off the column itself (its
// Excel list, its input rows) is its own.
// hiddenHeaders: [{ label, colIdx }], the headers skipped for sitting in
// a column Excel hides (lib/sheetVisibility.js's isColumnHidden) — never
// probed or matched here, only carried onto the report so the debug panel
// can name them. validation: { sheetName, orientation, headerLine,
// valuesLine, startSlot? } (0-based) or null. multiValue: { sources,
// separator } — the marketplace's "several values in one cell" rule
// (constants/sheetDefaults.js's multiValueRuleFor), or nothing.
// Returns { columns: { [label]: { sheetName, columnName, values, source,
// multiSeparator? } }, report } — `columns` is what mapping/saving consumes,
// `report` feeds DropdownDebugPanel. `multiSeparator` is only on a column
// whose winning source is one of multiValue.sources: it's what makes that
// column a Multi Select written into one cell.
export function extractDropdownColumns(XLSX, wb, { dataSheetName, headerCells, hiddenHeaders = [], headerRowIdx, dataRows, dataStartIdx, dataStartColIdx = 0, validation, multiValue }) {
  // One name per field, in the first column's own spelling — what the
  // name-based sources are matched against (see sheetLabel above).
  const nameByKey = new Map()
  for (const h of headerCells) {
    const key = (h.sheetLabel || h.label).toLowerCase()
    if (!nameByKey.has(key)) nameByKey.set(key, h.sheetLabel || h.label)
  }
  const names = [...nameByKey.values()]
  const probe = createDropdownSourceProbe(XLSX, wb, dataSheetName, names)
  const vColumns = validation?.sheetName ? readValidationSheet(XLSX, wb, validation) : []
  const matches = matchValidationColumns(names, vColumns)
  const columns = {}
  const headers = []
  for (const { label, sheetLabel, colIdx } of headerCells) {
    const name = nameByKey.get((sheetLabel || label).toLowerCase())
    const { excel, allowed: allowedRaw } = probe(colIdx, name, headerRowIdx)
    // An Allowed Values block can carry a stray "Mandatory"/"Select…" line.
    const allowed = allowedRaw ? allowedRaw.filter((v) => isOptionValue(v, name)) : null
    const match = matches.get(name) || null
    // A fuzzy name match has to bring a real list (2+) to be trusted.
    const minValues = match?.matchType === 'fuzzy' ? 2 : 1
    const validationValues = match && match.column.values.length >= minValues ? match.column.values : null
    const input = detectInputRowValues(dataRows, colIdx, name)
    const candidates = { excel, validation: validationValues, allowed, input: input.values }
    const source = DROPDOWN_SOURCES.find((s) => candidates[s]?.length) || null
    const values = source ? candidates[source] : []
    const multiSeparator = source && multiValue?.separator && multiValue.sources?.includes(source) ? multiValue.separator : ''
    if (source) {
      const fromValidation = source === 'validation'
      columns[label] = {
        sheetName: fromValidation ? validation.sheetName : dataSheetName,
        columnName: fromValidation ? match.column.name : label,
        values,
        source,
        ...(multiSeparator ? { multiSeparator } : {}),
      }
    }
    const inList = new Set(values.map((v) => v.toLowerCase()))
    headers.push({
      label,
      colIdx,
      source,
      multiSeparator,
      values,
      counts: Object.fromEntries(DROPDOWN_SOURCES.map((s) => [s, candidates[s]?.length || 0])),
      validationColumn: match ? { name: match.column.name, matchType: match.matchType, count: match.column.values.length } : null,
      filledCount: input.filled.length,
      outsideList: source && source !== 'input' ? input.filled.filter((v) => !inList.has(v.toLowerCase())) : [],
    })
  }
  const matchedKeys = new Set([...matches.values()].map((m) => m.column.key))
  return {
    columns,
    report: {
      dataSheetName,
      headerRowIdx,
      dataStartIdx,
      dataStartColIdx,
      validation: validation?.sheetName
        // Counted per header (not per name) — it's shown as "N of <headers> matched".
        ? { ...validation, startSlot: validation.startSlot || 0, columnsFound: vColumns.length, matched: headers.filter((h) => h.validationColumn).length }
        : null,
      headers,
      hiddenHeaders,
      unmatchedValidation: vColumns.filter((c) => !matchedKeys.has(c.key)).map((c) => ({ name: c.name, line: c.line, values: c.values })),
    },
  }
}
