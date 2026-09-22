'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/admin/Toast'
import { UNMAPPED_TAB_ID } from './GroupTabsStep'
import AiRulesSection from './AiRulesSection'
import { HEADER_ROW_INDEX, GROUP_LABEL_ROW_INDEX, DEFAULT_SHEET_ROWS } from '@/lib/listingSheetLayout'
import DEFAULT_HEADERS_CONFIG from './defaultHeaders.json'
import NewTemplateDesign from './NewTemplateDesign'

// Same 3 groups every other Listing Tools screen renders against (see
// SheetTabs.jsx's TABS / lib/listingTemplates.js GROUPS) — kept as its own
// local constant, same as SheetTabs.jsx does, rather than importing
// lib/listingTemplates.js: that module pulls in blobStore.js's server-only
// Vercel Blob access, which has no place in a client bundle.
//
// "Optional" (a 4th group) was retired — every template's own Optional
// headers/rows were migrated into Compulsory (see
// scripts/migrate_optional_to_brand_details.mjs), and new templates no
// longer get it offered as a destination here. `group: 'optional'` still
// exists in the data model/backend (lib/listingTemplates.js's own GROUPS,
// the sheets/[group] route) purely so a template saved before the retirement
// that somehow still has data there doesn't 404 — nothing here should ever
// write to it again.
const GROUPS = [
  { id: 'design_system', label: 'Product Details' },
  { id: 'compulsory', label: 'Compulsory' },
  { id: 'prefill', label: 'Brand Details' },
]

const DEFAULT_PRESET = { marketplaceName: 'Meesho', exportVersion: 'v1.0', description: '' }
const DEFAULT_CATEGORIES = { category1: '', category2: '', category3: '', category4: '', category5: '', category6: '' }
const DEFAULT_AI_RULES = { marketplace: '', category: '', title: '', description: '', keyword: '', otherRules: '' }

function slugify(label) {
  return String(label || 'col').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'col'
}
function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
// Section 2's 4 row inputs are 1-based (matching Excel's own row numbers) —
// converts to the 0-based index buildFields/buildDropdownColumns need,
// falling back to fallbackIdx while the input is blank/not-a-number (e.g.
// right after a sheet is cleared, before its default is set).
function parseRowInput(raw, fallbackIdx) {
  const n = Number(raw)
  if (raw === '' || raw === null || raw === undefined || Number.isNaN(n)) return fallbackIdx
  return Math.max(0, Math.trunc(n) - 1)
}
function detectDataType(label) {
  return /image|photo|img/i.test(label || '') ? 'image' : 'text'
}
// Hands control back to the browser for a paint — used to break up the
// header-extraction loop below into chunks so the progress bar actually
// updates on screen instead of the whole thing running in one blocking tick.
function yieldToPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
// Header cells in the real master sheet often carry a short field title
// plus a longer instructional note for whoever fills the sheet in — either
// on its own line inside the cell (Alt+Enter/wrap-text, which SheetJS
// preserves as a literal \n in the cell string) or, with no line break at
// all, just run on straight after the title with a "Please enter…"/"Note:"
// lead-in ("Product Name Please enter the product name. Note: Please avoid
// adding product features such as weight, dimension, price description
// here."). Both need to resolve to a short `label` (the actual column
// name) with the instructional text captured separately as `description`
// — collapsing everything to one line first (the old behavior) welds the
// note onto the label and produces an unusable multi-sentence column name.
const NOTE_LEAD_IN = /\s+(please\s+(?:enter|select|provide|choose|fill|add|note)\b|note\s*:|instructions?\s*:)/i
function splitHeaderCell(raw) {
  const normalized = String(raw ?? '').replace(/ /g, ' ').replace(/\r\n/g, '\n')
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length > 1) {
    return {
      label: lines[0].replace(/\s+/g, ' ').trim(),
      description: lines.slice(1).join(' ').replace(/\s+/g, ' ').trim(),
    }
  }
  const single = normalized.replace(/\s+/g, ' ').trim()
  const match = single.match(NOTE_LEAD_IN)
  if (match && match.index > 0) {
    return { label: single.slice(0, match.index).trim(), description: single.slice(match.index).trim() }
  }
  return { label: single, description: '' }
}
function guessIsValidationSheet(name) {
  return /drop.?down|valid|reference|option|list/i.test(name)
}
// Some sheets carry auto-generated or leftover filler columns — "Column1",
// "Header 2", "Unnamed: 3", "__EMPTY_4" (a common pandas/Excel round-trip
// artifact for a blank header cell), a bare "7", "Sample", "TBD" — that
// aren't real fields to map, just spreadsheet noise. Anchored to the whole
// label (not just a substring) so a genuine header like "Header Size",
// "Field Notes", or "Sample ID" still comes through — only a label that's
// *just* one of these words (optionally with a trailing number), or is
// purely numeric, gets dropped.
// Some source sheets carry a locked/internal column whose header cell is
// itself just an instruction not to touch it — "Don't Change", "Do Not
// Modify", "Do Not Edit This Column" — rather than naming a real field.
// Substring (not anchored like the noise-word check above) since these
// show up as short standalone phrases, not part of a longer real label.
function isDoNotChangeHeader(label) {
  return /\b(don'?t|do\s+not)\s+(change|modify|edit|alter|touch|update)\b/i.test(label)
}
function isPlaceholderHeader(label) {
  const v = String(label).trim()
  if (/^\d+$/.test(v)) return true
  if (isDoNotChangeHeader(v)) return true
  return /^(unnamed|__?empty|n\/?a|column|field|header|col|sample|example|test|dummy|placeholder|lorem|xxx|tbd)[\s._:-]*\d*$/i.test(v)
}
// Task 3: when a header has no Dropdown Reference Sheet match, check
// whether the Product Data Sheet's own column data looks categorical
// (values repeat) rather than free text (values are all different) — if
// so, auto-suggest those as the dropdown's option list instead of leaving
// it a plain text field the user has to configure by hand. Reuses the same
// value-cleaning rules as buildDropdownColumns (short, non-placeholder).
function detectColumnDropdownValues(dataRows, colIdx) {
  const raw = dataRows
    .map((r) => r[colIdx])
    .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
    .map((v) => String(v).trim())
    .filter((v) => v.length < 70 && !isPlaceholderValue(v))
  if (raw.length < 2) return null
  const distinct = [...new Set(raw)]
  // Real repetition (distinct < filled count), within a small option-list
  // sized range — a free-text column (e.g. "Highlights") has ~as many
  // distinct values as rows and would never qualify.
  if (distinct.length < 2 || distinct.length > 20 || distinct.length >= raw.length) return null
  return distinct
}
// Same idea applied to a Dropdown Reference Sheet's actual cell values —
// "Select…", "Choose an option", "N/A", "--", "TBD" are instruction/filler
// text a validation sheet sometimes has sitting in with the real options,
// not real values to offer in a dropdown.
function isPlaceholderValue(value, headerName = '') {
  if (value === undefined || value === null) return true;
  
  const str = String(value).trim();
  if (str === '') return true;

  // 1. Check if the value is literally identical to the column header itself
  if (headerName && str.toLowerCase() === headerName.trim().toLowerCase()) {
    return true;
  }

  // 2. Instruction phrases (e.g., "Select the HSN ID from the dropdown", "Enter Product GST %")
  const isInstruction = /^(select|choose|enter|type|pick)(\s+\S+)*$/i.test(str);
  
  // 3. Header-like defaults (e.g., "Product GST %", "Item Category", "Default Value")
  const isHeaderDefault = /^product\s+.*%$/i.test(str); 

  // 4. Standard null/empty markers
  const isNullMarker = /^(none|null|undefined|n[\/\s-]?a|tbd|-+|\.+)$/i.test(str);

  return isInstruction || isHeaderDefault || isNullMarker;
}
// Real master sheets are often named things like "Blouses-Fill this" —
// smart-select the Product Data Sheet by name instead of always defaulting
// to whichever sheet happens to be first in the workbook.
function guessIsDataSheet(name) {
  return /fill|master|product|template/i.test(name)
}

// Step 3 "automatic dropdown" — matches a header label to the Dropdown
// Reference sheet's column name so its dropdown source pre-fills itself.
function autoMatchDropdown(label, dropdownColumnNames) {
  const L = normalize(label)
  if (!L) return null
  for (const col of dropdownColumnNames) {
    const C = normalize(col)
    if (!C) continue
    if (L === C || L.includes(C) || C.includes(L)) return col
  }
  return null
}

// Fixed row positions, confirmed against the real master sheet's layout —
// no more dynamic scanning/scoring (picking whichever of the first N rows
// looked most header-like kept mis-picking the wrong row entirely on real
// files). Line 1 is a title, line 2 carries the group labels (e.g.
// "Compulsory") used below to pre-sort headers into their starting group,
// line 3 is the real header row. (HEADER_ROW_INDEX itself now lives in
// lib/listingSheetLayout.js so the format-preserving export engine shares
// the exact same assumption.)
function findHeaderRowIndex() {
  return HEADER_ROW_INDEX
}

// A merged group-label cell only populates its first column in the raw
// data — carry the last seen label forward across the blanks so every
// column under that merged span resolves to its group's label.
function forwardFillRow(row, width) {
  const filled = []
  let last = ''
  for (let i = 0; i < width; i++) {
    const v = String(row[i] ?? '').trim()
    if (v) last = v
    filled.push(last)
  }
  return filled
}

// Fuzzy-matches a group-label row's cell text to one of the 4 real groups
// (same substring-both-ways matching as the old per-sheet autoMatchGroup,
// just applied to a cell value instead of a sheet name).
function matchGroupLabel(label) {
  const s = normalize(label)
  if (!s) return null
  for (const g of GROUPS) {
    const gl = normalize(g.label)
    if (s === gl || s.includes(gl) || gl.includes(s)) return g.id
  }
  return null
}

// A Dropdown Reference / Validations sheet almost never shares the master
// sheet's fixed 3-row (title / group-label / header) layout that
// findHeaderRowIndex assumes — it's typically a plain sheet with real
// column headers on its first row and option values directly beneath.
// Reusing HEADER_ROW_INDEX here used to read row 3 as the header row on
// sheets whose real headers sit at row 1, silently treating option *values*
// as bogus "header names" and breaking auto-match/auto-extract entirely.
// Scans the first few rows for the first one with 2+ filled cells (a real
// multi-column header row — a lone title cell in a merged row only ever
// fills its first column), falling back to row 0 for a single-column sheet.
function findDropdownHeaderRowIndex(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 5); i++) {
    const filled = (aoa[i] || []).filter((v) => String(v ?? '').trim() !== '').length
    if (filled >= 2) return i
  }
  return 0
}

// Section 2's "Header Row" / "Dropdown Values Row" inputs pre-fill with
// whatever findDropdownHeaderRowIndex's scan would have picked anyway — the
// user only needs to touch them when a particular Dropdown Reference Sheet
// doesn't follow that guess (e.g. an extra title row pushes the real header
// down). Both 0-based, values row defaults to the row right under the header.
function computeDropdownRowDefaults(XLSX, workbook, sheetName) {
  const ws = sheetName ? workbook?.Sheets[sheetName] : null
  if (!ws) return { header: 0, values: 1 }
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const header = findDropdownHeaderRowIndex(aoa)
  return { header, values: header + 1 }
}

// Section 2 is now a single Product Data Sheet + a single (optional)
// Dropdown Reference Sheet, matching source/11.html exactly — no more
// multi-sheet checkbox selection. headerRowIdx/valuesRowIdx (both 0-based)
// come from Section 2's own "Header Row" / "Dropdown Values Row" inputs —
// defaulted by computeDropdownRowDefaults above, but user-editable, since a
// real Dropdown Reference Sheet doesn't always land on the guessed rows.
function buildDropdownColumns(XLSX, workbook, dropdownSheetName, headerRowIdx, valuesRowIdx) {
  const out = {}
  if (!dropdownSheetName) return out
  const ws = workbook.Sheets[dropdownSheetName]
  if (!ws) return out
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (!aoa.length) return out
  const headerRow = (aoa[headerRowIdx] || []).map((v) => String(v ?? '').trim())
  const dataRows = aoa.slice(Math.max(valuesRowIdx, 0))
  headerRow.forEach((col, colIdx) => {
    if (!col) return
    // Only real, short option values — not filler/placeholder text (see
    // isPlaceholderValue) and not long explanatory sentences a validation
    // sheet sometimes has in the same column (under 70 chars keeps this to
    // actual pick-list values, e.g. "Cotton", not a usage note).
    const values = [...new Set(
      dataRows
        .map((r) => r[colIdx])
        .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
        .map((v) => String(v).trim())
        .filter((v) => v.length < 70 && !isPlaceholderValue(v))
    )]
    // Dropdown logic: a column needs at least 2 distinct real values to
    // count as a dropdown at all — one (or zero) values isn't a pick-list,
    // it's a constant/empty column, so it's left out here and the header
    // that matches it falls back to a plain text field (see buildFields'
    // dropdownMatch/dataType below).
    if (values.length >= 2) out[col] = { sheetName: dropdownSheetName, columnName: col, values }
  })
  return out
}

// headerRowIdx/groupRowIdx (both 0-based) come from Section 2's own "Header
// Row" / "Group Row" inputs — defaulted to HEADER_ROW_INDEX/
// GROUP_LABEL_ROW_INDEX (the fixed layout confirmed against the real master
// sheet, see listingSheetLayout.js), but user-editable, since not every
// uploaded file follows that exact layout.
// `onProgress(current, total)` — real counts as headers are actually
// extracted, not simulated. Async and chunked (yieldToPaint every 12
// columns) purely so the progress bar can repaint between chunks; a plain
// synchronous loop would finish before the browser ever got to draw it for
// all but the largest sheets.
async function buildFields(XLSX, workbook, dataSheetName, dropdownColumns, headerRowIdx, groupRowIdx, onProgress) {
  const fields = []
  if (!dataSheetName) return fields
  const ws = workbook.Sheets[dataSheetName]
  if (!ws) return fields
  const dropdownNames = Object.keys(dropdownColumns)
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const rawHeaderRow = aoa[headerRowIdx] || []

  // The row directly above the real header row is often a group-label row
  // (e.g. "Compulsory" spanning several columns) — forward-fill it and
  // fuzzy-match each column's label to one of the 4 real groups, so headers
  // land pre-sorted on the Kanban board instead of all starting Unselected.
  // Falls back to Unselected wherever there's no row above, or no match —
  // safe no-op for simple sheets that don't have a group-label row at all.
  const groupRow = groupRowIdx >= 0 ? forwardFillRow(aoa[groupRowIdx] || [], rawHeaderRow.length) : []
  // Task 3's own-column dropdown auto-detect needs the actual data rows,
  // not just the header row.
  const dataRows = aoa.slice(headerRowIdx + 1)

  const seen = new Set()
  let counter = 0
  const total = rawHeaderRow.length
  for (let colIdx = 0; colIdx < total; colIdx++) {
    const rawLabel = rawHeaderRow[colIdx]
    onProgress?.(colIdx + 1, total)
    if (colIdx > 0 && colIdx % 12 === 0) await yieldToPaint()
    // See splitHeaderCell above \u2014 pulls the short column title apart from
    // any instructional note the cell also carries, instead of collapsing
    // both onto one line and calling the whole run-on sentence the label.
    const { label, description } = splitHeaderCell(rawLabel)
    if (!label) continue
    if (isPlaceholderHeader(label)) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    counter += 1
    const dropdownMatch = autoMatchDropdown(label, dropdownNames)
    const groupId = matchGroupLabel(groupRow[colIdx]) || UNMAPPED_TAB_ID
    // Once a header's group is known, a couple of labels are unique-key
    // material by convention: "Design Number" under Product Details, "Brand
    // Name" under Prefill — auto-check Unique key part for those instead of
    // making the user open Advanced Settings every time.
    const isUniqueKeyPart = (groupId === 'design_system' && /design|number/i.test(label))
      || (groupId === 'prefill' && /brand/i.test(label))
    // No Dropdown Reference Sheet match — see if the Product Data Sheet's
    // own column data looks categorical enough to auto-suggest as options.
    const autoDetectedValues = dropdownMatch ? null : detectColumnDropdownValues(dataRows, colIdx)
    const dataType = dropdownMatch || autoDetectedValues ? 'dropdown' : detectDataType(label)
    fields.push({
      id: `hdr_${slugify(label)}_${counter}`,
      label,
      description,
      groupId,
      dataType,
      dropdownColumn: dropdownMatch || '',
      // This column's 0-based position in the original Product Data Sheet —
      // carried through to save so exports can write filled data back into
      // the exact original column (see lib/exports/excelTemplateEngine.js).
      sourceColIndex: colIdx,
      // The field's own editable copy of the option list — seeded from the
      // matched column so it shows real values immediately, but from here
      // on it's independent per field. Falls back to the auto-detected
      // column values when there was no Dropdown Reference Sheet match.
      dropdownValues: dropdownMatch ? [...(dropdownColumns[dropdownMatch]?.values || [])] : (autoDetectedValues || []),
      isUniqueKeyPart,
      // Connected-headers (components/listing/linkedHeaders.js) — unset by
      // default, configured later in Advanced Settings.
      linkedGroup: null,
      linkedHeaderId: null,
      // Formula (components/listing/formula.js) — never auto-detected from
      // an upload, only ever set by hand via the Formula field type.
      formula: '',
      disabled: false,
      // Identity — extracted from the uploaded Product Data Sheet, not a
      // built-in default (source: 'default') or hand-added (source: 'manual').
      source: 'upload',
    })
  }
  return fields
}

// Task 1: every new template's Product Details group is guaranteed a set of
// baseline columns, and every other group gets its own connector field
// pre-linked back to Product Details (see linkedHeaders.js) — so a
// freshly-created template is immediately usable with the connected-headers
// feature without the user having to add and wire those columns by hand
// first. Called only from the create-mode upload flow (buildFields' caller
// below) — never applied to an existing template on reload, per the
// confirmed "new templates only" scope.
//
// The actual field list/types/links live in ONE place —
// components/listing/defaultHeaders.json — not scattered across this file,
// so "what are the defaults" is answerable by reading one JSON object
// instead of tracing through JS. Shape: `{ [groupId]: [{ label, dataType,
// isUniqueKeyPart?, disabled?, formula?, linkedGroup?, linkedLabel? }] }`.
// `linkedGroup`/`linkedLabel` (a label, not an id — ids don't exist until
// generated below) get resolved to a real `linkedHeaderId` at generation
// time, which is why design_system's own entries are always added first.
//
// Column order: default headers always come first (index 0+) within each
// group, with whatever the uploaded sheet itself contributes following
// after — `fields` (the upload) is appended *after* the generated defaults,
// never merged in place, so every new template's baseline columns land in
// the same predictable position regardless of what a given upload happens
// to contain. This only runs once, at creation time — a user manually
// reordering/renaming/dragging afterward is a later, separate edit to
// `fields` state and is naturally preserved as-is, not fought by this.
function withDefaultHeaders(fields) {
  const added = []
  let counter = fields.length
  const hasLabel = (groupId, label) =>
    fields.some((f) => f.groupId === groupId && f.label.trim().toLowerCase() === label.toLowerCase()) ||
    added.some((f) => f.groupId === groupId && f.label.trim().toLowerCase() === label.toLowerCase())
  const findByLabel = (groupId, label) =>
    added.find((f) => f.groupId === groupId && f.label.trim().toLowerCase() === label.toLowerCase()) ||
    fields.find((f) => f.groupId === groupId && f.label.trim().toLowerCase() === label.toLowerCase())

  function addDefault(groupId, config) {
    const { label, linkedGroup, linkedLabel, ...rest } = config
    if (hasLabel(groupId, label)) return
    counter += 1
    const linkedHeader = linkedGroup && linkedLabel ? findByLabel(linkedGroup, linkedLabel) : null
    added.push({
      id: `hdr_${slugify(label)}_default_${counter}`,
      label,
      description: '',
      groupId,
      dataType: 'text',
      dropdownColumn: '',
      dropdownValues: [],
      sourceColIndex: undefined,
      isUniqueKeyPart: false,
      linkedGroup: linkedHeader ? linkedGroup : null,
      linkedHeaderId: linkedHeader ? linkedHeader.id : null,
      formula: '',
      disabled: false,
      // Identity — this header exists because it's a built-in default, not
      // because it came off an uploaded sheet or was hand-added. See
      // buildFields (source: 'upload') and addHeaderToGroup below
      // (source: 'manual'); shown as a badge on the card in GroupTabsStep.
      source: 'default',
      ...rest,
    })
  }

  // design_system first — every other group's connectors resolve their
  // linkedHeaderId against these by label, so order matters here.
  for (const config of DEFAULT_HEADERS_CONFIG.design_system || []) addDefault('design_system', config)
  for (const groupId of ['compulsory', 'prefill']) {
    for (const config of DEFAULT_HEADERS_CONFIG[groupId] || []) addDefault(groupId, config)
  }

  return [...added, ...fields]
}

// Flattens an existing template's per-group sheets/headers (loaded from
// GET /api/listing-tools/[templateId]) back into the wizard's flat `fields`
// array — the inverse of the grouping handleSave does on the way out.
// Header ids are kept exactly as stored so a later save's PATCH lines up
// with the rows already on file for each group (see the route's own
// comment on why rows are never touched here).
function fieldsFromContent(content) {
  const fields = []
  for (const sheet of content.sheets || []) {
    for (const h of sheet.headers || []) {
      fields.push({
        id: h.id,
        label: h.label,
        description: h.description || '',
        groupId: h.group || sheet.group,
        dataType: h.dataType || 'text',
        dropdownColumn: h.dropdownSource?.columnName || '',
        dropdownValues: h.dropdownSource?.values ? [...h.dropdownSource.values] : [],
        // No live dropdownColumns map exists in edit mode (no sheet was
        // just parsed) — keep the original source sheet name so a re-save
        // doesn't drop it from dropdownSource.
        dropdownSheetName: h.dropdownSource?.sheetName || null,
        isUniqueKeyPart: !!h.isUniqueKeyPart,
        isProductGroupField: !!h.isProductGroupField,
        // Undefined on templates saved before this existed — handled as
        // "not format-preservable" downstream, never crashes.
        sourceColIndex: h.sourceColIndex,
        linkedGroup: h.linkedGroup || null,
        linkedHeaderId: h.linkedHeaderId || null,
        // New Design's multi-select "Auto-Fill From" — array of source header
        // ids. linkedHeaderId above stays the first one for the unchanged
        // fill-time logic (linkedHeaders.js).
        linkedHeaderIds: Array.isArray(h.linkedHeaderIds)
          ? h.linkedHeaderIds
          : h.linkedHeaderId
          ? [h.linkedHeaderId]
          : [],
        // New Design display bucket ('big' | 'image_link' | null) — real
        // `group` above is unchanged; other pages ignore this.
        uiBucket: h.uiBucket || null,
        formula: h.formula || '',
        disabled: !!h.disabled,
        // Templates saved before this existed have no `source` at all —
        // 'upload' is the closest honest guess (most pre-existing headers
        // came from a parsed sheet, not the newer default/manual paths).
        source: h.source || 'upload',
      })
    }
  }
  return fields
}
// Only records a tabLabels override where the stored sheetName actually
// differs from the group's default label — i.e. it was renamed via the
// Kanban column's click-to-rename at some point.
function tabLabelsFromContent(content) {
  const labels = {}
  for (const g of GROUPS) {
    const sheet = (content.sheets || []).find((s) => s.group === g.id)
    if (sheet?.sheetName && sheet.sheetName !== g.label) labels[g.id] = sheet.sheetName
  }
  return labels
}

// Single-page template creation/edit flow. Create mode: upload → pick the
// Product Data Sheet (+ optional Dropdown Reference Sheet) → group the
// resulting fields on a Kanban board → configure export preset + AI rules →
// save (POST, creates a new template). Edit mode (templateId passed in from
// app/listing-tools/template-settings/[templateId]/page.js): loads the
// existing template's headers/groups/preset/AI rules straight into the same
// editor — upload/pick-sheet doesn't apply since there's no file to
// re-parse — and Save PATCHes the existing template in place, never
// touching the row data those headers describe (see the PATCH route's own
// comment on that).
export default function TemplateSettingsWizard({ templateId }) {
  const { addToast } = useToast()
  const router = useRouter()
  const isEditMode = !!templateId

  const [fileName, setFileName] = useState('')
  const [workbook, setWorkbook] = useState(null)
  const [sheetMeta, setSheetMeta] = useState([]) // [{name,colCount,rowCount}]
  const [dataSheetName, setDataSheetName] = useState('')
  const [dropdownSheetName, setDropdownSheetName] = useState('')
  // Section 2's 4 row-position inputs — all 1-based (as shown to the user,
  // matching Excel's own row numbering), defaulted whenever their sheet is
  // (re)selected but freely user-editable afterward. Kept blank ('') until a
  // sheet is picked so the inputs render empty rather than a stale number.
  const [dataGroupRow, setDataGroupRow] = useState('')
  const [dataHeaderRow, setDataHeaderRow] = useState('')
  const [dropdownHeaderRow, setDropdownHeaderRow] = useState('')
  const [dropdownValuesRow, setDropdownValuesRow] = useState('')
  const [parsing, setParsing] = useState(false)
  // Live progress through handleFile → the fields-rebuild effect below:
  // { stage: string, current: number, total: number } | null. `total: 0`
  // means the stage has no per-item count to show (e.g. "Reading file…");
  // `current`/`total` are real counts once the header-extraction stage
  // starts, not a simulated percentage. Cleared automatically a moment
  // after the last stage completes — see ExtractionProgressModal.jsx.
  const [extraction, setExtraction] = useState(null)
  // The raw file itself, uploaded to Blob storage alongside the client-side
  // parse so the Excel Formats tab and format-preserving exports can later
  // re-open it with full styling (see lib/exports/excelTemplateEngine.js).
  // Only attempted for real .xlsx uploads — ExcelJS can't read legacy .xls,
  // and a failed/skipped upload just means those two features fall back to
  // their plain behavior for this template, never blocks Save.
  const [sourceFileUrl, setSourceFileUrl] = useState('')
  const [uploadingSource, setUploadingSource] = useState(false)

  const [showGroups, setShowGroups] = useState(false)
  const [fields, setFields] = useState([])
  const [dropdownColumns, setDropdownColumns] = useState({})
  const [tabLabels, setTabLabels] = useState({}) // { [groupId]: customLabel } — display-only, see TABS comment
  const [customTabs, setCustomTabs] = useState([]) // [{id,label}] — user-added Kanban columns; organizing-only, see handleSave's stuckFields guard
  const [removedGroupIds, setRemovedGroupIds] = useState(() => new Set()) // built-in groups (design_system/compulsory/prefill/optional) hidden for this template — Unselected can't be removed

  // A real, independently-typed field — no longer derived from marketplaceName/category1/
  // exportVersion (that composite lives on as its own "Final Name" preview below, unrelated).
  const [templateNameInput, setTemplateNameInput] = useState('')
  const [categoriesData, setCategoriesData] = useState(DEFAULT_CATEGORIES)
  // Assigned server-side once, at creation (lib/listingTemplates.js's nextTemplateNumber) —
  // blank here until then; edit mode loads the real one and it's never sent back in a PATCH.
  const [templateNumber, setTemplateNumber] = useState('')
  const [presetData, setPresetData] = useState(DEFAULT_PRESET)
  const [currentPreset, setCurrentPreset] = useState(null) // the one Section 4 "Save Preset" snapshot, offered in Section 5's template list — saving again replaces it, never adds another
  const [aiRulesData, setAiRulesData] = useState(DEFAULT_AI_RULES)

  const [saving, setSaving] = useState(false)
  const [savedTemplate, setSavedTemplate] = useState(null) // { id, templateName } once Save succeeds

  const [loadingExisting, setLoadingExisting] = useState(isEditMode)
  const [loadError, setLoadError] = useState(false)

  // Edit mode only — loads the template once and drops it straight onto the
  // Kanban board (skips Sections 1-2 entirely).
  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (!data?.template || !data?.content) { setLoadError(true); return }
        setFields(fieldsFromContent(data.content))
        setTabLabels(tabLabelsFromContent(data.content))
        setTemplateNameInput(data.template.templateName || '')
        setTemplateNumber(data.template.templateNumber || '')
        setCategoriesData({
          category1: data.template.category1 || '',
          category2: data.template.category2 || '',
          category3: data.template.category3 || '',
          category4: data.template.category4 || '',
          category5: data.template.category5 || '',
          category6: data.template.category6 || '',
        })
        setPresetData({
          marketplaceName: data.template.marketplaceName || '',
          exportVersion: data.template.exportVersion || '',
          // Previously missing here entirely — edit mode loaded every other preset field but
          // this one, so re-opening an existing template for editing silently reset its
          // description in this form (source of truth on the server was untouched until Save,
          // which would then have overwritten it right back to blank).
          description: data.template.description || '',
        })
        setAiRulesData({
          marketplace: data.template.marketplaceName || '',
          category: data.template.category1 || '',
          title: data.template.aiRules?.title || '',
          description: data.template.aiRules?.description || '',
          keyword: data.template.aiRules?.keyword || '',
          otherRules: data.template.aiRules?.otherRules || '',
        })
        setShowGroups(true)
      })
      .catch(() => { if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setLoadingExisting(false) })
    return () => { cancelled = true }
  }, [templateId])

  async function handleFile(file) {
    if (!file) return
    setParsing(true)
    setExtraction({ stage: 'Reading file…', current: 0, total: 0 })
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      setExtraction({ stage: 'Parsing workbook…', current: 0, total: 0 })
      await yieldToPaint()
      const wb = XLSX.read(buf, { type: 'array' })
      const meta = []
      for (let i = 0; i < wb.SheetNames.length; i++) {
        const name = wb.SheetNames[i]
        const ws = wb.Sheets[name]
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const headerRowIdx = findHeaderRowIndex(aoa)
        const colCount = (aoa[headerRowIdx] || []).filter((v) => String(v ?? '').trim() !== '').length
        meta.push({ name, colCount, rowCount: Math.max(aoa.length - headerRowIdx - 1, 0) })
        setExtraction({ stage: 'Scanning sheets…', current: i + 1, total: wb.SheetNames.length })
        if (i > 0 && i % 5 === 0) await yieldToPaint()
      }
      // Defaults mirror source/11.html: sheet 1 is the data sheet, sheet 2
      // the dropdown reference — but prefer sheets whose names actually look
      // the part (e.g. "Blouses-Fill this" for data, "Validation Sheet" for
      // dropdowns) over blindly trusting sheet order.
      const dataGuess = wb.SheetNames.find(guessIsDataSheet)
      const nextDataSheetName = dataGuess || wb.SheetNames[0] || ''
      const validationGuess = wb.SheetNames.find((n) => n !== nextDataSheetName && guessIsValidationSheet(n))
      const nextDropdownSheetName = validationGuess || wb.SheetNames.find((n) => n !== nextDataSheetName) || ''
      // Section 2's 4 row inputs default the moment a sheet is picked — Fill
      // Sheet's Group/Header Row default to the app's fixed, confirmed
      // layout (same constants findHeaderRowIndex used to hardcode);
      // Validation Sheet's Header/Values Row default off an actual scan of
      // its content, since a reference sheet's layout varies file to file.
      const dropdownDefaults = computeDropdownRowDefaults(XLSX, wb, nextDropdownSheetName)
      setWorkbook(wb)
      setFileName(file.name)
      setSheetMeta(meta)
      setDataSheetName(nextDataSheetName)
      setDropdownSheetName(nextDropdownSheetName)
      setDataGroupRow(nextDataSheetName ? DEFAULT_SHEET_ROWS.GROUP_ROW : '')
      setDataHeaderRow(nextDataSheetName ? DEFAULT_SHEET_ROWS.HEADER_ROW : '')
      setDropdownHeaderRow(nextDropdownSheetName ? (dropdownDefaults.header + 1 || DEFAULT_SHEET_ROWS.DROPDOWN_HEADER_ROW) : '')
      setDropdownValuesRow(nextDropdownSheetName ? (dropdownDefaults.values + 1 || DEFAULT_SHEET_ROWS.DROPDOWN_VALUES_ROW) : '')
      setShowGroups(false)
      setFields([])
      setDropdownColumns({})
      setSavedTemplate(null)
      setSourceFileUrl('')
      // No data sheet detected at all — the rebuild effect below never
      // fires (it needs both workbook and dataSheetName), so nothing else
      // will ever clear the progress modal.
      if (!nextDataSheetName) setExtraction(null)
      if (/\.xlsx$/i.test(file.name)) uploadSourceFile(file)
    } catch (err) {
      addToast('Could not read that file — is it a valid .xlsx?', 'error')
      setExtraction(null)
    } finally {
      setParsing(false)
    }
  }

  // Fire-and-forget alongside the client-side parse above — non-fatal on
  // failure (see sourceFileUrl's own comment), so this never blocks the
  // rest of the wizard.
  async function uploadSourceFile(file) {
    setUploadingSource(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/listing-tools/source-file', { method: 'POST', body: formData })
      const data = await res.json().catch(() => null)
      // A 401 already triggered the shared login-required modal — this
      // upload is fire-and-forget anyway (see the comment above), so just
      // stop quietly rather than also showing a confusing toast.
      if (res.status === 401) return
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Upload failed')
      setSourceFileUrl(data.url)
    } catch {
      addToast("Couldn't save the original file — Excel Formats and format-matched exports won't be available for this template.", 'error')
    } finally {
      setUploadingSource(false)
    }
  }

  // Groups build automatically off either Section 2 dropdown — no separate
  // "Build Column Groups" button. Picking/changing the Product Data Sheet
  // (re)reads its header row fresh (a different sheet means a different set
  // of headers, so previous group assignments don't carry over — same as
  // source/11.html's readHeadersFromSheet). Changing the Dropdown Reference
  // Sheet re-derives dropdownColumns the same way, kept as one combined
  // rebuild for predictability rather than trying to patch only the fields
  // an auto-match previously touched. Create mode only — edit mode never
  // sets `workbook`, so this never fires there.
  useEffect(() => {
    if (!workbook || !dataSheetName) return
    let cancelled = false
    ;(async () => {
      const XLSX = await import('xlsx')
      if (cancelled) return
      const headerRowIdx = parseRowInput(dataHeaderRow, HEADER_ROW_INDEX)
      const groupRowIdx = parseRowInput(dataGroupRow, GROUP_LABEL_ROW_INDEX)
      const dropHeaderRowIdx = parseRowInput(dropdownHeaderRow, 0)
      const dropValuesRowIdx = parseRowInput(dropdownValuesRow, dropHeaderRowIdx + 1)
      setExtraction({ stage: 'Reading dropdown reference…', current: 0, total: 0 })
      const cols = buildDropdownColumns(XLSX, workbook, dropdownSheetName, dropHeaderRowIdx, dropValuesRowIdx)
      if (cancelled) return
      // buildFields already auto-separates every header by the sheet's own
      // group-label row (matchGroupLabel), and anything it can't recognise
      // falls to Unselected / "Other" — same behaviour in both designs now.
      // Reports live current/total counts as it goes — see its own comment.
      const built = await buildFields(XLSX, workbook, dataSheetName, cols, headerRowIdx, groupRowIdx, (current, total) => {
        if (!cancelled) setExtraction({ stage: 'Extracting headers…', current, total })
      })
      if (cancelled) return
      setDropdownColumns(cols)
      // ONLY image headers auto-detected from the uploaded SHEET (source
      // 'upload') get tagged into the New Design's "Image Link" bucket —
      // built-in Image N defaults and hand-added headers are left in their
      // group. Real `group` is untouched, so exports/fill pages are unaffected.
      setFields(
        withDefaultHeaders(built).map((f) =>
          f.dataType === 'image' && f.source === 'upload' ? { ...f, uiBucket: 'image_link' } : f,
        ),
      )
      setShowGroups(true)
      setExtraction({ stage: 'Done', current: built.length, total: built.length })
      // Leaves the completed bar on screen briefly so "Done" is actually
      // visible, then auto-closes — same pattern the bulk-apply flow (Phase
      // 4) will reuse for its own progress modal.
      setTimeout(() => { if (!cancelled) setExtraction(null) }, 500)
    })()
    return () => { cancelled = true }
  }, [workbook, dataSheetName, dropdownSheetName, dataHeaderRow, dataGroupRow, dropdownHeaderRow, dropdownValuesRow])

  function updateField(id, patch) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  function bulkAssignFields(ids, groupId) {
    setFields((prev) => prev.map((f) => (ids.includes(f.id) ? { ...f, groupId } : f)))
  }
  // New Design drag-and-drop: reorder a header relative to another one
  // (Old Design's GroupTabsStep only ever moved a card *between* groups,
  // never within). Splice `dragId` out and drop it back in at whatever
  // index `targetId` currently sits at.
  function moveFieldBefore(dragId, targetId, after = false) {
    if (dragId === targetId) return
    setFields((prev) => {
      const from = prev.findIndex((f) => f.id === dragId)
      if (from === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      let to = next.findIndex((f) => f.id === targetId)
      if (to === -1) return prev
      if (after) to += 1 // drop landed on the target's trailing half
      next.splice(to, 0, moved)
      return next
    })
  }
  // New Design's "Sort Group" / "Sort Original" — reorders headers *inside*
  // each group only, never across groups. mode 'label' = A→Z by label,
  // 'original' = by the header's original sheet-column index. Built-in
  // default headers always stay pinned at the top of their group in their
  // existing relative order (they can't be moved — see NewTemplateDesign).
  function sortFieldsWithinGroups(mode) {
    setFields((prev) => {
      const groupsInOrder = []
      const buckets = new Map()
      // Key by the New Design display bucket when set, else the real group —
      // so "Big" / "Image Link" sort as their own section, not lumped in with
      // the rest of Product Details.
      const keyOf = (f) => f.uiBucket || f.groupId
      for (const f of prev) {
        const k = keyOf(f)
        if (!buckets.has(k)) { buckets.set(k, []); groupsInOrder.push(k) }
        buckets.get(k).push(f)
      }
      const cmp = (a, b) => {
        const ad = a.source === 'default' ? 0 : 1
        const bd = b.source === 'default' ? 0 : 1
        if (ad !== bd) return ad - bd
        if (ad === 0) return 0 // keep defaults' own order
        if (mode === 'original') return (a.sourceColIndex ?? 1e9) - (b.sourceColIndex ?? 1e9)
        return String(a.label || '').localeCompare(String(b.label || ''))
      }
      const out = []
      for (const gid of groupsInOrder) out.push(...buckets.get(gid).slice().sort(cmp))
      return out
    })
  }
  // Section 2's two sheet <select>s for the New Design — kept here so the
  // row-input re-defaulting logic lives in one spot. Old Design has its own
  // inline copy on its selects; both do the exact same thing.
  function selectDataSheet(val) {
    setDataSheetName(val)
    setDataGroupRow(val ? GROUP_LABEL_ROW_INDEX + 1 : '')
    setDataHeaderRow(val ? HEADER_ROW_INDEX + 1 : '')
    if (!val) { setShowGroups(false); setFields([]); setDropdownColumns({}) }
  }
  function selectDropdownSheet(val) {
    setDropdownSheetName(val)
    if (!val || !workbook) { setDropdownHeaderRow(''); setDropdownValuesRow(''); return }
    import('xlsx').then((XLSX) => {
      const { header, values } = computeDropdownRowDefaults(XLSX, workbook, val)
      setDropdownHeaderRow(header + 1)
      setDropdownValuesRow(values + 1)
    })
  }
  // A manually-added field, not extracted from the upload — dropped straight
  // into whichever group's "+ Add Header" was clicked, dummy-named and
  // ready to rename/configure like any other card.
  function addHeaderToGroup(groupId) {
    const id = `hdr_new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    setFields((prev) => {
      // Auto-name "Header 1", "Header 2", … — one past the highest such label
      // already present, so repeated clicks keep counting up.
      const used = prev
        .map((f) => /^header\s+(\d+)$/i.exec(String(f.label || '').trim()))
        .filter(Boolean)
        .map((m) => Number(m[1]))
      const nextNo = used.length ? Math.max(...used) + 1 : 1
      return [...prev, {
        id,
        label: `Header ${nextNo}`,
        groupId,
        dataType: 'text',
        dropdownColumn: '',
        dropdownValues: [],
        isUniqueKeyPart: false,
        // Identity — hand-added via "Add Header", not extracted from an
        // upload (source: 'upload') or a built-in default (source: 'default').
        source: 'manual',
      }]
    })
  }
  // Removes a header entirely — not a move to Unselected, gone from `fields`
  // for good (until Save, nothing's persisted either way).
  // Removing a header also clears any *other* header's link that pointed at
  // it (components/listing/linkedHeaders.js) — otherwise that other header
  // would keep a linkedHeaderId referencing an id that no longer exists.
  function deleteHeader(fieldId) {
    setFields((prev) => {
      const remaining = prev.filter((f) => f.id !== fieldId)
      return remaining.map((f) => {
        const ids = Array.isArray(f.linkedHeaderIds) && f.linkedHeaderIds.length
          ? f.linkedHeaderIds
          : f.linkedHeaderId
          ? [f.linkedHeaderId]
          : []
        if (!ids.includes(fieldId)) return f
        const nextIds = ids.filter((id) => id !== fieldId)
        const firstId = nextIds[0] || null
        return {
          ...f,
          linkedHeaderIds: nextIds,
          linkedHeaderId: firstId,
          linkedGroup: firstId ? remaining.find((r) => r.id === firstId)?.groupId ?? null : null,
        }
      })
    })
  }
  // Section 4's "Save Preset" doesn't persist anything by itself — it sets
  // this marketplace/category/version combo as the one current preset
  // (replacing whatever was there before, never accumulating a list) so it
  // can be selected in Section 5's template list right away, before the
  // whole template is ever saved.
  function savePreset(preset) {
    setCurrentPreset({
      id: 'current_preset',
      marketplaceName: preset.marketplaceName,
      category1: preset.category1,
      exportVersion: preset.exportVersion,
    })
  }

  function resetWizard() {
    setFileName('')
    setWorkbook(null)
    setSheetMeta([])
    setDataSheetName('')
    setDropdownSheetName('')
    setDataGroupRow('')
    setDataHeaderRow('')
    setDropdownHeaderRow('')
    setDropdownValuesRow('')
    setSourceFileUrl('')
    setUploadingSource(false)
    setShowGroups(false)
    setFields([])
    setDropdownColumns({})
    setTabLabels({})
    setCustomTabs([])
    setRemovedGroupIds(new Set())
    setTemplateNameInput('')
    setTemplateNumber('')
    setCategoriesData(DEFAULT_CATEGORIES)
    setPresetData(DEFAULT_PRESET)
    setCurrentPreset(null)
    setAiRulesData(DEFAULT_AI_RULES)
    setSavedTemplate(null)
  }

  async function handleSave(opts) {
    // New Design (create mode) composes the Template Name automatically from
    // Marketplace + Category 6 and passes it here, so it isn't kept in
    // `templateNameInput` state. Everything else — Old Design, and edit mode —
    // still uses the typed `templateNameInput`. `opts` may be a DOM event
    // (some buttons wire `onClick={handleSave}` directly), hence the shape check.
    const templateNameToSave = (opts && typeof opts.templateName === 'string' ? opts.templateName : templateNameInput || '').trim()
    // New Design also passes its composed "Save Final Name" so the stored
    // value matches the preview; omitted everywhere else (server computes it).
    const finalNameToSave = opts && typeof opts.finalName === 'string' ? opts.finalName.trim() : undefined
    // Defense in depth — the Save button is already disabled while any
    // header sits in a custom group (see hasStuckFields below), but guard
    // here too in case that state ever gets out of sync.
    if (stuckFields.length > 0) {
      addToast('Move headers out of custom groups before saving — see the notice above Save.', 'error')
      return
    }
    if (!templateNameToSave) {
      addToast('Enter a Template Name before saving.', 'error')
      return
    }
    const allGrouped = GROUPS.map((g, i) => ({
      sheetName: tabLabels[g.id] || g.label,
      sheetIndex: i,
      group: g.id,
      headers: fields.filter((f) => f.groupId === g.id).map((f, idx) => ({
        id: f.id,
        label: f.label,
        description: f.description || '',
        order: idx,
        group: g.id,
        dataType: f.dataType,
        isUniqueKeyPart: f.isUniqueKeyPart,
        isProductGroupField: !!f.isProductGroupField,
        sourceColIndex: f.sourceColIndex,
        linkedGroup: f.linkedGroup || null,
        linkedHeaderId: f.linkedHeaderId || null,
        linkedHeaderIds: Array.isArray(f.linkedHeaderIds) && f.linkedHeaderIds.length
          ? f.linkedHeaderIds
          : f.linkedHeaderId
          ? [f.linkedHeaderId]
          : [],
        uiBucket: f.uiBucket || null,
        formula: f.formula || '',
        disabled: !!f.disabled,
        source: f.source || 'upload',
        // Saves the field's own (possibly hand-edited via +/- in the card)
        // value list, not blindly the shared sheet column's raw values.
        // Multi Select shares this same option list — only the fill-time
        // cell (single- vs multi-pick) differs, see SheetGrid.jsx.
        dropdownSource: (f.dataType === 'dropdown' || f.dataType === 'multiselect')
          ? {
              sheetName: dropdownColumns[f.dropdownColumn]?.sheetName || f.dropdownSheetName || null,
              columnName: f.dropdownColumn || null,
              values: f.dropdownValues && f.dropdownValues.length ? f.dropdownValues : (dropdownColumns[f.dropdownColumn]?.values || []),
            }
          : null,
      })),
      rows: [],
    }))

    const totalHeaders = allGrouped.reduce((sum, g) => sum + g.headers.length, 0)
    if (totalHeaders === 0) {
      addToast('Add at least one field to a group before saving.', 'error')
      return
    }

    setSaving(true)
    try {
      let res
      if (isEditMode) {
        // Every group is sent, even ones with 0 headers right now — that's
        // how the PATCH route tells "this group is intentionally empty"
        // apart from "this group wasn't mentioned" (which would otherwise
        // leave its old headers/rows alone). No dropdownReference/
        // sourceFileName here: Sections 1-2 don't exist in edit mode, so
        // there's nothing new to report — the route keeps what's on file.
        res = await fetch(`/api/listing-tools/${templateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateName: templateNameToSave,
            ...(finalNameToSave !== undefined ? { finalName: finalNameToSave } : {}),
            description: presetData.description,
            marketplaceName: presetData.marketplaceName,
            category1: categoriesData.category1,
            category2: categoriesData.category2,
            category3: categoriesData.category3,
            category4: categoriesData.category4,
            category5: categoriesData.category5,
            category6: categoriesData.category6,
            exportVersion: presetData.exportVersion,
            aiRules: aiRulesData,
            sheets: allGrouped,
          }),
        })
      } else {
        const mergedColumns = Object.fromEntries(Object.entries(dropdownColumns).map(([k, v]) => [k, v.values]))
        res = await fetch('/api/listing-tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateName: templateNameToSave,
            ...(finalNameToSave !== undefined ? { finalName: finalNameToSave } : {}),
            description: presetData.description,
            sourceFileName: fileName,
            sourceFileUrl: sourceFileUrl || null,
            sourceSheetName: sourceFileUrl ? dataSheetName : null,
            sheets: allGrouped.filter((g) => g.headers.length > 0),
            dropdownReference: dropdownSheetName
              ? { sheetName: dropdownSheetName, columns: mergedColumns }
              : { sheetName: null, columns: {} },
            marketplaceName: presetData.marketplaceName,
            category1: categoriesData.category1,
            category2: categoriesData.category2,
            category3: categoriesData.category3,
            category4: categoriesData.category4,
            category5: categoriesData.category5,
            category6: categoriesData.category6,
            exportVersion: presetData.exportVersion,
            aiRules: aiRulesData,
          }),
        })
      }
      // A server error can come back with an empty/HTML body (proxy
      // timeout, an unhandled exception before route.js's own try/catch
      // JSON-ifies it) — res.json() throws "Unexpected end of JSON input"
      // on that, which is far more confusing than just naming the HTTP
      // status, so parse defensively instead of assuming JSON.
      const data = await res.json().catch(() => null)
      // A 401 already triggered the shared login-required modal (see
      // lib/authGate.js) — don't also show a generic error toast for it.
      if (res.status === 401) return
      if (!res.ok) throw new Error(data?.error || `Failed to save template (${res.status})`)
      if (!data?.template) throw new Error('Server did not return the saved template.')

      addToast(isEditMode ? 'Template updated' : 'Template created', 'success')
      if (isEditMode) {
        setSavedTemplate({ id: data.template.id, templateName: data.template.templateName })
      } else {
        // Land back on the list rather than this now-saved wizard — the
        // list route mounts fresh (it's a different page component from
        // /new), so its own useEffect fetch picks up the new template
        // without any extra cache-busting.
        router.push('/listing-tools/template-settings')
      }
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const customTabIds = new Set(customTabs.map((t) => t.id))
  // Only the 3 real groups + Unselected ever persist — anything left in a
  // custom group would silently vanish on save if we let it through, so
  // Save stays disabled until these are empty.
  const stuckFields = fields.filter((f) => customTabIds.has(f.groupId))

  // Everything components/listing/NewTemplateDesign.jsx needs to drive the
  // parse / group / preset / save flow, bundled into one prop.
  const api = {
    isEditMode, showGroups,
    fileName, parsing, extraction, sheetMeta, uploadingSource, sourceFileUrl, handleFile,
    dataSheetName, dropdownSheetName, selectDataSheet, selectDropdownSheet,
    dataGroupRow, setDataGroupRow, dataHeaderRow, setDataHeaderRow,
    dropdownHeaderRow, setDropdownHeaderRow, dropdownValuesRow, setDropdownValuesRow,
    fields, updateField, deleteHeader, addHeaderToGroup, moveFieldBefore, sortFieldsWithinGroups, bulkAssignFields,
    templateNameInput, setTemplateNameInput, templateNumber,
    categoriesData, setCategoriesData, presetData, setPresetData, savePreset, currentPreset,
    handleSave, saving, savedTemplate, resetWizard, stuckFields,
  }

  if (isEditMode && loadingExisting) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    )
  }
  if (isEditMode && loadError) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <p className="text-[14px] font-semibold text-foreground">Couldn&apos;t load this template.</p>
        <p className="text-[13px] text-subtle mt-1">It may have been deleted, or you don&apos;t have access to it.</p>
        <Link href="/listing-tools/template-settings" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-hover">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Template Settings
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto px-6 py-8 space-y-5">
      <NewTemplateDesign api={api} />
    </div>
  )
}
