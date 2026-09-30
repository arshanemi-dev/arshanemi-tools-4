// Reads a workbook's real Excel "List" data-validation dropdowns straight
// out of the raw file — SheetJS Community Edition parses cells but drops
// data validations entirely, so a marketplace template whose fill rows are
// still EMPTY (every column has a dropdown on its rows, nothing picked yet)
// had nothing for the old value-repetition heuristic to find. Handles both:
//   - .xls (BIFF8, e.g. Flipkart): DV records in each sheet substream, list
//     sources as an inline string, a same-/other-sheet range, or a named range
//   - .xlsx (e.g. Meesho): <dataValidation> + x14 extLst <x14:dataValidation>
// List sources that live on other (usually hidden) sheets are read back off
// the already-parsed `wb.Sheets`. INDIRECT-style dependent lists can't be
// resolved statically and are skipped.
//
// Returns { [sheetName]: { [colIdx]: [{ values, firstRow, lastRow }] } }
// (0-based rows/cols). Never throws — a file it can't read just yields {}.

export function readDataValidationLists(XLSX, buf, wb) {
  try {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    const cfb = XLSX.CFB.read(bytes, { type: 'array' })
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
    return isZip ? readXlsx(XLSX, cfb, wb) : readXls(XLSX, cfb, wb)
  } catch {
    return {}
  }
}

// Picks the validation list covering data rows below the header for one
// column — null when that column has no list dropdown.
export function pickColumnValidationList(lists, sheetName, colIdx, headerRowIdx) {
  const entries = lists?.[sheetName]?.[colIdx]
  if (!entries || !entries.length) return null
  const hit = entries.find((e) => e.lastRow > headerRowIdx && e.values.length) || null
  return hit ? hit.values : null
}

// One probe per extraction pass: (colIdx, label, headerRowIdx) →
// { excel, allowed } (each values|null), both reported separately so the
// caller (lib/dropdownExtraction.js) can rank them against its other
// sources and show where each header's values actually came from.
// - excel: the column's real Excel list validation (wb.dataValidationLists,
//   set at upload via readDataValidationLists)
// - allowed: an "Allowed Values" block on another sheet — a cell equal to the
//   header label with the options listed under it (Flipkart's Index sheet;
//   this is where multi-select columns keep theirs, since Excel can't
//   validate multi-select). A block whose values are themselves header
//   labels (e.g. Flipkart's hidden MatchingAttributes sheet) is an attribute
//   list, not options, and is skipped. Blocks on a row naming this data
//   sheet win.
const SAMPLE_SHEET_RE = /sample|example|demo/i

export function createDropdownSourceProbe(XLSX, wb, sheetName, headerLabels) {
  const lists = wb?.dataValidationLists || {}
  const headerSet = new Set(headerLabels.map((h) => String(h || '').trim().toLowerCase()).filter(Boolean))
  const sheetKey = String(sheetName || '').trim().toLowerCase()
  let allowed = null
  function buildAllowed() {
    allowed = {}
    for (const name of wb?.SheetNames || []) {
      // A filled Sample/Example copy of the fill sheet repeats every header
      // label with example data under it — not options.
      if (name === sheetName || SAMPLE_SHEET_RE.test(name)) continue
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 })
      aoa.forEach((row, r) => {
        if (!row) return
        const rowNamesSheet = sheetKey && row.some((v) => String(v ?? '').trim().toLowerCase() === sheetKey)
        row.forEach((v, c) => {
          const key = String(v ?? '').split('\n')[0].trim().toLowerCase()
          if (!key || !headerSet.has(key)) return
          const values = []
          for (let rr = r + 1; rr < aoa.length && values.length < 2000; rr++) {
            const x = aoa[rr]?.[c]
            if (x === undefined || x === null || String(x).trim() === '') break
            values.push(String(x).trim())
          }
          if (values.length < 2) return
          if (values.some((x) => x.length >= 70 || headerSet.has(x.toLowerCase()))) return
          const prev = allowed[key]
          if (!prev || (rowNamesSheet && !prev.rowNamesSheet)) allowed[key] = { values: [...new Set(values)], rowNamesSheet }
        })
      })
    }
  }
  return function probe(colIdx, label, headerRowIdx) {
    if (!allowed) buildAllowed()
    return {
      excel: pickColumnValidationList(lists, sheetName, colIdx, headerRowIdx),
      allowed: allowed[String(label || '').trim().toLowerCase()]?.values || null,
    }
  }
}

// ---------- shared ----------

function addEntry(out, sheetName, ranges, values) {
  const clean = [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))]
  if (!clean.length) return
  const bySheet = out[sheetName] || (out[sheetName] = {})
  for (const { c1, c2, r1, r2 } of ranges) {
    for (let c = c1; c <= Math.min(c2, c1 + 16383); c++) {
      ;(bySheet[c] || (bySheet[c] = [])).push({ values: clean, firstRow: r1, lastRow: r2 })
    }
  }
}

// Reads cell values off an already-parsed sheet. readDown = an OFFSET-style
// dynamic list anchored at one cell — keep reading down until the first blank.
function readRange(XLSX, wb, sheetName, r1, c1, r2, c2, readDown = false) {
  const ws = wb.Sheets[sheetName]
  if (!ws || !ws['!ref']) return []
  const bounds = XLSX.utils.decode_range(ws['!ref'])
  const lastRow = readDown ? bounds.e.r : Math.min(r2, bounds.e.r)
  const lastCol = Math.min(c2, bounds.e.c)
  const values = []
  for (let r = r1; r <= lastRow; r++) {
    let rowHasValue = false
    for (let c = c1; c <= lastCol; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (!cell || cell.v === undefined || cell.v === null || String(cell.v).trim() === '') continue
      values.push(cell.w !== undefined ? cell.w : String(cell.v))
      rowHasValue = true
    }
    if (readDown && !rowHasValue) break
  }
  return values
}

// CFB.find only matches a nested zip path when it's rooted ("/xl/…");
// a bare name ("Workbook") matches by basename.
function contentOf(XLSX, cfb, path) {
  const entry = XLSX.CFB.find(cfb, path.includes('/') && !path.startsWith('/') ? `/${path}` : path)
  return entry && entry.content ? entry.content : null
}

// ---------- .xlsx ----------

function decodeXml(s) {
  return String(s)
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

function attr(attrs, name) {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)
  return m ? decodeXml(m[1]) : null
}

function colToIdx(letters) {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

// "A5:A1000 C5 D:D" → [{c1,c2,r1,r2}]
function parseSqref(sqref) {
  const out = []
  for (const tok of String(sqref || '').trim().split(/\s+/)) {
    const m = /^\$?([A-Z]+)\$?(\d*)(?::\$?([A-Z]+)\$?(\d*))?$/i.exec(tok)
    if (!m) continue
    const c1 = colToIdx(m[1])
    const c2 = m[3] ? colToIdx(m[3]) : c1
    const r1 = m[2] ? Number(m[2]) - 1 : 0
    const r2 = m[4] ? Number(m[4]) - 1 : (m[3] ? 1048575 : (m[2] ? r1 : 1048575))
    out.push({ c1: Math.min(c1, c2), c2: Math.max(c1, c2), r1, r2 })
  }
  return out
}

const REF_RE = /^(?:(?:'((?:[^']|'')+)'|([^!'"(),\s]+))!)?\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/i

function resolveXlsxFormula(XLSX, wb, formula, ownSheet, names, depth = 0) {
  if (depth > 4) return []
  let f = decodeXml(formula).trim().replace(/^=/, '')
  if (!f) return []
  // Inline list: "Yes,No"
  if (f.startsWith('"') && f.endsWith('"')) {
    return f.slice(1, -1).replace(/""/g, '"').split(',')
  }
  const ref = REF_RE.exec(f)
  if (ref) {
    const sheet = ref[1] ? ref[1].replace(/''/g, "'") : (ref[2] || ownSheet)
    const c1 = colToIdx(ref[3]); const r1 = Number(ref[4]) - 1
    const c2 = ref[5] ? colToIdx(ref[5]) : c1; const r2 = ref[6] ? Number(ref[6]) - 1 : r1
    return readRange(XLSX, wb, sheet, r1, c1, r2, c2)
  }
  // Named range (sheet-scoped first, then workbook-scoped)
  if (/^[A-Za-z_\\][\w.\\]*$/.test(f)) {
    const key = f.toLowerCase()
    const target = names.find((n) => n.name === key && n.sheet === ownSheet) || names.find((n) => n.name === key && !n.sheet)
    return target ? resolveXlsxFormula(XLSX, wb, target.formula, ownSheet, names, depth + 1) : []
  }
  // INDIRECT("Name") with a literal
  const ind = /^INDIRECT\(\s*"([^"]+)"\s*\)$/i.exec(f)
  if (ind) return resolveXlsxFormula(XLSX, wb, ind[1], ownSheet, names, depth + 1)
  // OFFSET(Sheet!$A$1, …) dynamic list — read down from the anchor
  const off = /^OFFSET\(\s*([^,]+),/i.exec(f)
  if (off) {
    const a = REF_RE.exec(off[1].trim())
    if (a) {
      const sheet = a[1] ? a[1].replace(/''/g, "'") : (a[2] || ownSheet)
      const c = colToIdx(a[3]); const r = Number(a[4]) - 1
      return readRange(XLSX, wb, sheet, r, c, r, c, true)
    }
  }
  return []
}

function readXlsx(XLSX, cfb, wb) {
  const dec = new TextDecoder('utf-8')
  const wbXml = contentOf(XLSX, cfb, 'xl/workbook.xml')
  const relsXml = contentOf(XLSX, cfb, 'xl/_rels/workbook.xml.rels')
  if (!wbXml || !relsXml) return {}
  const wbStr = dec.decode(wbXml)
  const relsStr = dec.decode(relsXml)

  const rels = {}
  for (const m of relsStr.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = attr(m[1], 'Id'); const target = attr(m[1], 'Target')
    if (id && target) rels[id] = target.startsWith('/') ? target.slice(1) : `xl/${target}`
  }
  const sheets = []
  for (const m of wbStr.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    sheets.push({ name: attr(m[1], 'name'), rid: attr(m[1], 'r:id') })
  }
  const names = []
  for (const m of wbStr.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)) {
    const local = attr(m[1], 'localSheetId')
    names.push({
      name: (attr(m[1], 'name') || '').toLowerCase(),
      sheet: local !== null ? sheets[Number(local)]?.name || null : null,
      formula: m[2],
    })
  }

  const out = {}
  for (const sheet of sheets) {
    const path = rels[sheet.rid]
    const data = path && contentOf(XLSX, cfb, path)
    if (!data) continue
    const xml = dec.decode(data)
    if (!/dataValidation/.test(xml)) continue
    const re = /<((?:\w+:)?)dataValidation\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1dataValidation>)/g
    for (const m of xml.matchAll(re)) {
      const attrs = m[2]; const body = m[3] || ''
      if (attr(attrs, 'type') !== 'list') continue
      const f1 = /<(?:\w+:)?formula1>\s*(?:<(?:\w+:)?f>([\s\S]*?)<\/(?:\w+:)?f>|([\s\S]*?))\s*<\/(?:\w+:)?formula1>/.exec(body)
      const formula = f1 ? (f1[1] ?? f1[2] ?? '') : ''
      const sqref = attr(attrs, 'sqref') || (/<(?:\w+:)?sqref>([\s\S]*?)<\/(?:\w+:)?sqref>/.exec(body) || [])[1]
      if (!formula || !sqref) continue
      addEntry(out, sheet.name, parseSqref(sqref), resolveXlsxFormula(XLSX, wb, formula, sheet.name, names))
    }
  }
  return out
}

// ---------- .xls (BIFF8) ----------

function readXls(XLSX, cfb, wb) {
  const data = contentOf(XLSX, cfb, 'Workbook') || contentOf(XLSX, cfb, 'Book')
  if (!data) return {}
  const b = data instanceof Uint8Array ? data : Uint8Array.from(data)
  const u16 = (p) => b[p] | (b[p + 1] << 8)
  const u32 = (p) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0

  // XLUnicodeString-ish reader: returns [string, nextPos]
  function readChars(p, cch) {
    const high = b[p] & 1; p += 1
    let s = ''
    for (let i = 0; i < cch; i++) {
      s += String.fromCharCode(high ? u16(p) : b[p])
      p += high ? 2 : 1
    }
    return [s, p]
  }

  // Formula tokens → { kind: 'list'|'area'|'name', ... } (first operand only)
  function parseRgce(p, end) {
    if (p >= end) return null
    const ptg = b[p]
    const more = (size) => p + size < end
    switch (ptg) {
      case 0x17: { // PtgStr
        const [s] = readChars(p + 2, b[p + 1])
        return { kind: 'list', values: s.includes('\0') ? s.split('\0') : s.split(',') }
      }
      case 0x3a: case 0x5a: case 0x7a: // PtgRef3d
        return { kind: 'area', ixti: u16(p + 1), r1: u16(p + 3), r2: u16(p + 3), c1: u16(p + 5) & 0x3fff, c2: u16(p + 5) & 0x3fff, readDown: more(7) }
      case 0x3b: case 0x5b: case 0x7b: // PtgArea3d
        return { kind: 'area', ixti: u16(p + 1), r1: u16(p + 3), r2: u16(p + 5), c1: u16(p + 7) & 0x3fff, c2: u16(p + 9) & 0x3fff }
      case 0x24: case 0x44: case 0x64: // PtgRef (same sheet)
        return { kind: 'area', ixti: null, r1: u16(p + 1), r2: u16(p + 1), c1: u16(p + 3) & 0x3fff, c2: u16(p + 3) & 0x3fff, readDown: more(5) }
      case 0x25: case 0x45: case 0x65: // PtgArea (same sheet)
        return { kind: 'area', ixti: null, r1: u16(p + 1), r2: u16(p + 3), c1: u16(p + 5) & 0x3fff, c2: u16(p + 7) & 0x3fff }
      case 0x23: case 0x43: case 0x63: // PtgName
        return { kind: 'name', idx: u32(p + 1) }
      default:
        return null
    }
  }

  // Globals substream
  const boundSheets = [] // { name, pos }
  const xti = [] // ixti → { supbook, itab }
  const supbooks = [] // true = self-referencing
  const lbls = [] // 1-based via index+1 → { itab, rgce: [start, end] }
  let pos = 0
  while (pos + 4 <= b.length) {
    const type = u16(pos); const len = u16(pos + 2); const d = pos + 4
    pos = d + len
    if (type === 0x000a) break // EOF of globals
    if (type === 0x0085) { // BoundSheet8
      const [name] = readChars(d + 7, b[d + 6])
      boundSheets.push({ name, pos: u32(d) })
    } else if (type === 0x01ae) { // SupBook
      supbooks.push(u16(d + 2) === 0x0401)
    } else if (type === 0x0017) { // ExternSheet
      const n = u16(d)
      for (let i = 0; i < n; i++) xti.push({ supbook: u16(d + 2 + i * 6), itab: u16(d + 4 + i * 6) })
    } else if (type === 0x0018) { // Lbl
      const flags = u16(d); const cch = b[d + 3]; const cce = u16(d + 4); const itab = u16(d + 8)
      const nameLen = (flags & 0x20) ? 1 : cch
      const high = b[d + 14] & 1
      const rgceStart = d + 15 + nameLen * (high ? 2 : 1)
      lbls.push({ itab, rgce: [rgceStart, rgceStart + cce] })
    }
  }
  const selfSupbook = supbooks.indexOf(true)
  const sheetNameAt = (itab) => boundSheets[itab]?.name || null
  const sheetOfIxti = (ixti) => {
    const x = xti[ixti]
    if (!x || (selfSupbook >= 0 && x.supbook !== selfSupbook)) return null
    return sheetNameAt(x.itab)
  }

  function resolve(tok, ownSheet, depth = 0) {
    if (!tok || depth > 4) return []
    if (tok.kind === 'list') return tok.values
    if (tok.kind === 'area') {
      const sheet = tok.ixti === null ? ownSheet : sheetOfIxti(tok.ixti)
      return sheet ? readRange(XLSX, wb, sheet, tok.r1, tok.c1, tok.r2, tok.c2, !!tok.readDown) : []
    }
    if (tok.kind === 'name') {
      const lbl = lbls[tok.idx - 1]
      if (!lbl) return []
      const scope = lbl.itab ? sheetNameAt(lbl.itab - 1) : ownSheet
      return resolve(parseRgce(lbl.rgce[0], lbl.rgce[1]), scope || ownSheet, depth + 1)
    }
    return []
  }

  const out = {}
  for (const sheet of boundSheets) {
    let p = sheet.pos
    let depth = 0
    while (p + 4 <= b.length) {
      const type = u16(p); const len = u16(p + 2); const d = p + 4
      p = d + len
      if (type === 0x0809) { depth++; continue } // BOF (nested chart substreams too)
      if (type === 0x000a) { depth--; if (depth <= 0) break; continue }
      if (type !== 0x01be || depth !== 1) continue // Dv
      try {
        const flags = u32(d)
        if ((flags & 0xf) !== 3) continue // list only
        let q = d + 4
        for (let s = 0; s < 4; s++) { const cch = u16(q); q = readChars(q + 2, cch)[1] }
        const cce1 = u16(q); const f1Start = q + 4; q = f1Start + cce1
        const cce2 = u16(q); q = q + 4 + cce2
        const cref = u16(q); q += 2
        const ranges = []
        for (let i = 0; i < cref; i++, q += 8) {
          ranges.push({ r1: u16(q), r2: u16(q + 2), c1: u16(q + 4), c2: u16(q + 6) })
        }
        addEntry(out, sheet.name, ranges, resolve(parseRgce(f1Start, f1Start + cce1), sheet.name))
      } catch {
        // malformed record — skip it, keep the rest
      }
    }
  }
  return out
}
