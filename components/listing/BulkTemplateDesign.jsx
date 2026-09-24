'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Bookmark } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/admin/Toast'
import { HEADER_ROW_INDEX, DEFAULT_SHEET_ROWS, detectMarketplaceSheetDefaults } from '@/lib/listingSheetLayout'
import TemplateNamingFields, { composeFinalName, composeAutoTemplateName } from './TemplateNamingFields'
import SourceFileUploadControl from './SourceFileUploadControl'
import SheetSelectorFields from './SheetSelectorFields'
import BulkRuleSidebar from './BulkRuleSidebar'
import BulkMappingGrid from './BulkMappingGrid'
import BulkPlaceGrid from './BulkPlaceGrid'
import HeaderBucketPreview from './HeaderBucketPreview'
import ExtractionProgressModal from './ExtractionProgressModal'
import NewDesignColumnModal from './NewDesignColumnModal'
import OurHeaderSettingsModal from './OurHeaderSettingsModal'
import SheetHeaderTree from './SheetHeaderTree'
import RulePreviewPanel from './RulePreviewPanel'

const REAL_GROUPS = ['design_system', 'compulsory', 'prefill']
const SHEET_LABELS = { design_system: 'Product details', compulsory: 'Compulsory', prefill: 'Brand Details' }
// Same shape NewTemplateDesign.jsx's own SECTIONS constant uses — just
// what NewDesignColumnModal needs to label each group in "Auto-Fill From".
const MODAL_SECTIONS = REAL_GROUPS.map((id) => ({ id, title: SHEET_LABELS[id] }))
const DEFAULT_CATEGORIES = { category1: '', category2: '', category3: '', category4: '', category5: '', category6: '' }

function slugify(label) {
  return String(label || 'col').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'col'
}
function yieldToPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
// Single-line cleanup only — collapses whitespace and trims. Used on its
// own for simple values (the I section row's note text), and as the final
// step inside splitHeaderCell below for the label/description it pulls
// apart.
function cleanLabel(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim()
}
// Same idea as TemplateSettingsWizard.jsx's own splitHeaderCell (duplicated
// for the same reason cleanLabel/isPlaceholderValue already are — that file
// pulls in a lot of unrelated Kanban-era state) — a header cell often
// carries a short title plus a longer instructional note, either on its own
// line (Alt+Enter/wrap-text, which SheetJS preserves as a literal \n) or
// with no line break at all, just run on after a "Please enter…"/"Note:"
// lead-in ("Product Name Please enter the product name. Note: Please avoid
// adding product features such as weight, dimension, price description
// here."). Both resolve to a short `label` with the note captured
// separately as `description` — feeds the SAME target as the I section
// row's own note (see the extraction effect below), and wins over it when
// both are present, since an in-cell note is more specific to this exact
// column than a row shared across every column.
const NOTE_LEAD_IN = /\s+(please\s+(?:enter|select|provide|choose|fill|add|note)\b|note\s*:|instructions?\s*:)/i
function splitHeaderCell(raw) {
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
function isPlaceholderLabel(label) {
  const v = label.trim()
  if (!v) return true
  if (/^\d+$/.test(v)) return true
  // A broken formula/reference in the sheet itself (e.g. a header cell that
  // used to be a formula) reads back as a literal Excel error string, not a
  // real column name — never accept one of these as a header.
  if (/^#(REF|N\/A|VALUE|DIV\/0|NAME\??|NULL|NUM|SPILL|CALC)!?$/i.test(v)) return true
  return /^(unnamed|__?empty|n\/?a|column|field|header|col|sample|example|test|dummy|placeholder|lorem|xxx|tbd|error)[\s._:-]*\d*$/i.test(v)
}
function parseRowInput(raw, fallbackIdx) {
  const n = Number(raw)
  if (raw === '' || raw === null || raw === undefined || Number.isNaN(n)) return fallbackIdx
  return Math.max(0, Math.trunc(n) - 1)
}
// Same value-filtering rule as TemplateSettingsWizard.jsx's own
// isPlaceholderValue — duplicated (not imported) for the same reason
// cleanLabel/computeDropdownRowDefaults already are (see cleanLabel's own
// comment): that file pulls in a lot of unrelated Kanban-era state.
function isPlaceholderValue(value, headerName = '') {
  if (value === undefined || value === null) return true
  const str = String(value).trim()
  if (str === '') return true
  if (headerName && str.toLowerCase() === headerName.trim().toLowerCase()) return true
  const isInstruction = /^(select|choose|enter|type|pick)(\s+\S+)*$/i.test(str)
  const isHeaderDefault = /^product\s+.*%$/i.test(str)
  const isNullMarker = /^(none|null|undefined|n[\/\s-]?a|tbd|-+|\.+)$/i.test(str)
  return isInstruction || isHeaderDefault || isNullMarker
}
// No separate Validations/Dropdown Reference Sheet — a column counts as a
// dropdown when the Product fill sheet's OWN data for it repeats (2-20
// distinct real values, fewer distinct values than filled rows) rather than
// reading like free text. Same rule as TemplateSettingsWizard.jsx's own
// Task 3 own-column auto-detect, just promoted here from a no-match
// fallback to the only strategy — same sheet, same column, no cross-sheet
// name-matching needed at all.
function detectColumnDropdownValues(dataRows, colIdx, headerLabel) {
  const raw = dataRows
    .map((r) => r[colIdx])
    .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
    .map((v) => String(v).trim())
    .filter((v) => v.length < 70 && !isPlaceholderValue(v, headerLabel))
  if (raw.length < 2) return null
  const distinct = [...new Set(raw)]
  if (distinct.length < 2 || distinct.length > 20 || distinct.length >= raw.length) return null
  return distinct
}
// A merged Group Row cell only populates its first column in the raw data —
// carry the last seen label forward across the blanks so every column
// under that merged span resolves to its group's label. Same idea as
// TemplateSettingsWizard.jsx's own forwardFillRow.
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
// Same keyword heuristic as TemplateSettingsWizard.jsx's own detectDataType
// — used by autoPlaceHeaders to catch an image column whose Our Header
// entry was never explicitly set to the Image type.
function looksLikeImageLabel(label) {
  return /image|photo|img/i.test(label || '')
}
// Which raw header labels show up in EVERY one of `sheets` (each
// {headers: string[]}) — "GST"/"Brand Name"/"Manufacturer Details" are
// common across every Meesho sheet regardless of product category, only
// meaningful once there's more than one sheet to compare. `keys`
// (lowercased) for matching; `labels` (original casing, first sheet seen)
// for display. Pure — reused both for the whole-batch Common Headers
// column and per-marketplace inside the Sheets & Headers tree.
function computeCommonHeaderInfo(sheets) {
  if (sheets.length < 2) return { keys: new Set(), labels: [] }
  const counts = new Map()
  for (const sheet of sheets) {
    const seenInSheet = new Set()
    for (const h of sheet.headers) {
      const key = h.trim().toLowerCase()
      if (seenInSheet.has(key)) continue
      seenInSheet.add(key)
      const entry = counts.get(key) || { label: h, count: 0 }
      entry.count += 1
      counts.set(key, entry)
    }
  }
  const keys = new Set()
  const labels = []
  for (const [key, { label, count }] of counts) {
    if (count === sheets.length) { keys.add(key); labels.push(label) }
  }
  return { keys, labels }
}

// Eagerly extracts one session's headers/I section notes/dropdown columns
// in a single pass — same read as the combined extraction effect further
// down, but for a file that ISN'T the currently active session. A
// multi-file upload needs every file's headers pooled into the shared
// Unmapped Headers list right away (see allRawHeaders), not only whichever
// file happens to be selected first — no per-column progress reporting
// here, unlike the live effect, since this runs quietly in the background
// per file during the upload's own "Reading file N of M…" stage.
async function extractSessionHeaders(XLSX, wb, session) {
  const empty = { rawHeaders: [], rawHeaderNotes: {}, rawHeaderGroupLabels: {}, dropdownColumns: {} }
  if (!session.dataSheetName) return empty
  const ws = wb.Sheets[session.dataSheetName]
  if (!ws) return empty
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const headerRowIdx = parseRowInput(session.dataHeaderRow, HEADER_ROW_INDEX)
  const sameConfiguredRow = String(session.dataHeaderRow ?? '').trim() !== ''
    && String(session.dataIsectionRow ?? '').trim() !== ''
    && Number(session.dataHeaderRow) === Number(session.dataIsectionRow)
  const isectionRowIdx = sameConfiguredRow ? headerRowIdx + 1 : parseRowInput(session.dataIsectionRow, headerRowIdx + 1)
  const rawRow = aoa[headerRowIdx] || []
  const isectionRow = aoa[isectionRowIdx] || []
  const groupRowIdx = parseRowInput(session.dataGroupRow, headerRowIdx)
  const groupRowFilled = forwardFillRow(aoa[groupRowIdx] || [], rawRow.length)
  // Same editable "Dropdown Data Row" as the live extraction effect below
  // (defaults to row 5) — see its own comment.
  const dropdownDataStartIdx = parseRowInput(session.dropdownDataStartRow, DEFAULT_SHEET_ROWS.DROPDOWN_DATA_START_ROW - 1)
  const dataRows = aoa.slice(Math.max(headerRowIdx + 1, dropdownDataStartIdx))
  const seen = new Set()
  const rawHeaders = []
  const rawHeaderNotes = {}
  const rawHeaderGroupLabels = {}
  const dropdownColumns = {}
  for (let i = 0; i < rawRow.length; i++) {
    const { label, description: cellNote } = splitHeaderCell(rawRow[i])
    if (!label || isPlaceholderLabel(label)) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    rawHeaders.push(label)
    // In-cell note (same cell, split by line/lead-in) wins over the I
    // section row's note when both exist.
    const isectionNote = cleanLabel(isectionRow[i])
    const note = cellNote || (isectionNote && !isPlaceholderLabel(isectionNote) ? isectionNote : '')
    if (note) rawHeaderNotes[label] = note
    if (groupRowFilled[i]) rawHeaderGroupLabels[label] = groupRowFilled[i]
    const values = detectColumnDropdownValues(dataRows, i, label)
    if (values) dropdownColumns[label] = { sheetName: session.dataSheetName, columnName: label, values }
  }
  return { rawHeaders, rawHeaderNotes, rawHeaderGroupLabels, dropdownColumns }
}

// A freshly-uploaded file's own name is usually the best hint for this
// template's marketplace + categories (e.g. "Meesho_Blouse_Cotton_Women.xlsx")
// — fixed positional convention: the FIRST token is always the marketplace
// name, the LAST (non-stopword) token is always Category 6, whatever sits
// between fills Category 1-5 in order. Only ever fills currently-EMPTY
// category slots (see handleFile), never overwrites something the user
// already typed.
const CATEGORY_STOPWORDS = new Set([
  'file', 'files', 'sheet', 'sheets', 'template', 'templates', 'final', 'draft', 'copy',
  'xlsx', 'xls', 'csv', 'fill', 'this', 'data', 'master', 'new', 'old', 'updated',
  'list', 'listing', 'upload', 'uploaded', 'export', 'import', 'v1', 'v2', 'v3',
])
const KNOWN_MARKETPLACES = [
  'Meesho', 'Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Nykaa', 'Tata CLiQ', 'Jiomart', 'eBay', 'Shopify'
]

// Returns { brand, categories } where categories is a fixed 6-slot array
// (category1..category6, '' for an unused slot) — categories[5] (Category 6)
// is always the filename's last token, never wherever it happens to fall in
// sequence, so a 2-token name ("Meesho_Women.xlsx") puts "Women" in
// Category 6, not Category 1.
function extractBrandAndCategories(filename) {
  const base = String(filename || '').replace(/\.[a-z0-9]+$/i, '')
  const tokens = base.split(/[_\-\s]+/).map((t) => t.trim()).filter(Boolean)
  if (tokens.length === 0) return { brand: '', categories: new Array(6).fill('') }

  const rawBrand = tokens[0]
  const brandLower = rawBrand.toLowerCase()
  const known = KNOWN_MARKETPLACES.find((m) => m.toLowerCase() === brandLower)
  const brand = known || (rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1))

  const catTokens = tokens.slice(1).filter((t) => !CATEGORY_STOPWORDS.has(t.toLowerCase()) && !/^\d+$/.test(t))

  const categories = new Array(6).fill('')
  if (catTokens.length > 0) {
    categories[5] = catTokens[catTokens.length - 1]
    catTokens.slice(0, -1).slice(0, 5).forEach((t, i) => { categories[i] = t })
  }

  return { brand, categories }
}

// Same idea as deriveCategoriesFromName but sourced from the sheet's own
// extracted header labels instead of the filename — a generic column name
// like "Product Name"/"HSN Code" says nothing about the product, but a
// distinctive one (e.g. "Blouse Style", "Fabric Type") is a decent category
// hint. Extra stopwords cover common FIELD-name words that filenames don't
// usually have.
const HEADER_CATEGORY_STOPWORDS = new Set([
  ...CATEGORY_STOPWORDS,
  'name', 'id', 'code', 'no', 'number', 'details', 'detail', 'value', 'type',
  'description', 'date', 'price', 'qty', 'quantity', 'image', 'images', 'link',
  'url', 'sku', 'product', 'brand', 'category', 'status',
])
function deriveCategoriesFromHeaders(headers) {
  const seen = new Set()
  const out = []
  for (const h of headers) {
    for (const word of String(h || '').split(/[_\-\s]+/)) {
      const trimmed = word.trim()
      const key = trimmed.toLowerCase()
      if (!trimmed || trimmed.length < 3 || /^\d+$/.test(trimmed)) continue
      if (HEADER_CATEGORY_STOPWORDS.has(key) || seen.has(key)) continue
      seen.add(key)
      out.push(trimmed)
    }
  }
  return out
}

function seedFromExistingContent(content) {
  const out = []
  for (const sheet of content.sheets || []) {
    for (const h of sheet.headers || []) {
      out.push({
        ourHeaderId: h.id,
        ourHeaderLabel: h.label,
        dataType: h.dataType || 'text',
        isUniqueKeyPart: !!h.isUniqueKeyPart,
        sheetHeaders: [h.label],
        group: h.group || sheet.group,
        position: h.order ?? 0,
        existingId: h.id,
        description: h.description || '',
        // Carried through so re-saving without touching the Header Settings
        // modal doesn't wipe what was already configured there (same
        // "preserve on save" fix as description above).
        dropdownValues: h.dropdownSource?.values ? [...h.dropdownSource.values] : [],
        formula: h.formula || '',
        disabled: !!h.disabled,
        linkedGroup: h.linkedGroup || null,
        linkedHeaderId: h.linkedHeaderId || null,
        linkedHeaderIds: Array.isArray(h.linkedHeaderIds) ? h.linkedHeaderIds : [],
        uiBucket: h.uiBucket || null,
      })
    }
  }
  return out
}

// `dropdownColumns` — this session's own-column dropdown auto-detect (see
// detectColumnDropdownValues/extractSessionHeaders), keyed directly by the
// raw sheetHeader label it came from — same sheet, same column, so no
// cross-sheet name-matching is needed, just a direct lookup. A match
// upgrades a plain 'text' dataType to 'dropdown'; an Our Header already
// configured as dropdown/multiselect keeps its own dataType and just gets
// the values. `rawHeaderNotes` — the I section row's text, keyed by raw
// label (see the combined extraction effect), carried through as each
// header's description.
function buildGroupedSheets(mappedHeaders, dropdownColumns = {}, rawHeaderNotes = {}) {
  const byGroup = { design_system: [], compulsory: [], prefill: [] }
  for (const m of mappedHeaders) {
    if (!m.group || m.sheetHeaders.length === 0) continue
    byGroup[m.group]?.push(m)
  }
  return REAL_GROUPS.map((g, i) => {
    const headers = byGroup[g]
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((m, idx) => {
        // Auto-detected column (own-column dropdown scan) vs. whatever the
        // Header Settings modal set by hand — manual dataType/dropdownValues
        // win when present, same precedence /new's own save-time logic uses.
        const autoCol = m.sheetHeaders.map((sh) => dropdownColumns[sh]).find(Boolean) || null
        const dataType = m.dataType && m.dataType !== 'text' ? m.dataType : (autoCol ? 'dropdown' : 'text')
        const manualValues = Array.isArray(m.dropdownValues) && m.dropdownValues.length ? m.dropdownValues : null
        const note = m.sheetHeaders.map((sh) => rawHeaderNotes[sh]).find(Boolean) || m.description || ''
        return {
          id: m.existingId || `hdr_${slugify(m.ourHeaderLabel)}_${idx}_${Date.now()}`,
          label: m.ourHeaderLabel,
          description: note,
          order: idx,
          group: g,
          dataType,
          isUniqueKeyPart: !!m.isUniqueKeyPart,
          sourceColIndex: undefined,
          linkedGroup: m.linkedGroup || null,
          linkedHeaderId: m.linkedHeaderId || null,
          linkedHeaderIds: Array.isArray(m.linkedHeaderIds) ? m.linkedHeaderIds : [],
          uiBucket: m.uiBucket || null,
          formula: m.formula || '',
          disabled: !!m.disabled,
          source: 'upload',
          dropdownSource: (dataType === 'dropdown' || dataType === 'multiselect')
            ? { sheetName: autoCol?.sheetName || null, columnName: autoCol?.columnName || null, values: manualValues || autoCol?.values || [] }
            : null,
        }
      })

    const sampleRow = {}
    headers.forEach((h) => {
      sampleRow[h.label] = `${h.label} Sample`
    })

    return {
      sheetName: SHEET_LABELS[g],
      sheetIndex: i,
      group: g,
      headers,
      rows: headers.length > 0 ? [sampleRow] : [],
    }
  })
}

// The bulk mapping flow — two different working sets share this same page:
//
// 1. `templateIds` (from the list page's "Edit Bulk Listing" toolbar
//    button, 2+ templates checkbox-selected there) — real, already-saved
//    templates loaded up front, switched between one at a time in the
//    sidebar (isEditMode=true). Naming fields, sheet selectors, Header
//    Mapping/Place and the preview all belong to whichever ONE is active
//    and reset fully on switch — same as before.
// 2. No templateIds, or files uploaded fresh — a BATCH of new templates
//    being created together. Each uploaded file gets its own name and
//    Product fill sheet / row selections (an upload session, see
//    buildUploadSession/captureSnapshot/applySnapshot), individually
//    switched between in the sidebar — but Header Mapping, Header Place
//    and the Preview are one SHARED pool across the whole batch
//    (uploadMappedHeaders/activeMapped), not per file: map "Product Name"
//    once and it applies to every uploaded sheet that has that column.
//    Saving one file only keeps whichever globally-mapped headers that
//    file actually has a raw column for (see handleSave's scopedMapped).
//
// Either way: save bumps a template version + writes a log row, both
// living in the hub (see lib/listingMappingProxy.js). With nothing loaded
// and nothing uploaded yet, the sidebar stays hidden until something
// exists to show in it.
export default function BulkTemplateDesign({ templateIds = [] }) {
  const { addToast } = useToast()
  const router = useRouter()

  const [templatesData, setTemplatesData] = useState({}) // { [id]: {template, content} }
  const [templatesList, setTemplatesList] = useState([]) // [{id, templateName}]
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  // A freshly-uploaded, not-yet-saved file gets a synthetic `file_...` id
  // (see handleSingleFile/handleMultipleFiles) so it can sit in the same
  // sidebar list and selection mechanism as a real, already-saved template
  // — isEditMode only ever means "editing something that already exists in
  // the DB" (drives PATCH vs POST in handleSave), never an unsaved upload.
  const isRealTemplateId = (id) => !!id && !id.startsWith('file_')
  const isEditMode = isRealTemplateId(activeTemplateId)
  // Per-upload-session working state ({ [file_...id]: {workbook, sheetMeta,
  // dataSheetName, ..., rawHeaders, dropdownColumns, presetData,
  // categoriesData, fileName, sourceFileUrl} }) — lets several uploaded
  // files sit side by side, each with its own name and Product fill sheet
  // selection, switched between via the sidebar (see handleSelectWorkItem/
  // captureSnapshot/applySnapshot below). Header Mapping/Place is NOT part
  // of a session — it's the shared uploadMappedHeaders pool further down,
  // common across every file in the batch. A real, already-saved template
  // uses templatesData instead, same as before.
  const [uploadSessions, setUploadSessions] = useState({})
  const activeIdRef = useRef(null)
  useEffect(() => { activeIdRef.current = activeTemplateId }, [activeTemplateId])

  const [loadingExisting, setLoadingExisting] = useState(templateIds.length > 0)
  const [loadError, setLoadError] = useState(false)

  const [selectedMarketplace, setSelectedMarketplace] = useState('Meesho')
  const [presetData, setPresetData] = useState({ marketplaceName: 'Meesho', exportVersion: 'v1.0', description: '' })
  const [categoriesData, setCategoriesData] = useState(DEFAULT_CATEGORIES)
  const [templateNameInput, setTemplateNameInput] = useState('')
  const [templateNumber, setTemplateNumber] = useState('')

  function handleSelectMarketplace(mp) {
    setSelectedMarketplace(mp)
    if (mp && mp !== 'meesho' && mp !== 'meesho') {
      setPresetData((prev) => ({ ...prev, marketplaceName: mp }))
    }
  }

  const [fileName, setFileName] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState([]) // [{name, sheets: []}]
  const [workbook, setWorkbook] = useState(null)
  const [sheetMeta, setSheetMeta] = useState([])
  const [dataSheetName, setDataSheetName] = useState('')
  const [dataGroupRow, setDataGroupRow] = useState('')
  const [dataHeaderRow, setDataHeaderRow] = useState('')
  const [dataIsectionRow, setDataIsectionRow] = useState('')
  // Where the Product fill sheet's own dropdown-enabled data starts, for
  // own-column dropdown auto-detect — editable like every other row here,
  // defaults to DEFAULT_SHEET_ROWS.DROPDOWN_DATA_START_ROW (row 5).
  const [dropdownDataStartRow, setDropdownDataStartRow] = useState('')
  const [parsing, setParsing] = useState(false)
  const [extraction, setExtraction] = useState(null)
  const [sourceFileUrl, setSourceFileUrl] = useState('')
  const [rawHeaders, setRawHeaders] = useState([])
  const [rawHeaderNotes, setRawHeaderNotes] = useState({}) // { [label]: noteText } — the I section row, column-aligned to rawHeaders, see the combined extraction effect below
  const [rawHeaderGroupLabels, setRawHeaderGroupLabels] = useState({}) // { [label]: groupLabelText } — the Group Row, forward-filled and column-aligned to rawHeaders, feeds autoPlaceHeaders
  const [dropdownColumns, setDropdownColumns] = useState({}) // { [label]: {sheetName, columnName, values} } — own-column auto-detect off the Product fill sheet itself, see detectColumnDropdownValues

  const [ourHeaders, setOurHeaders] = useState([])
  const [creatingHeader, setCreatingHeader] = useState(false)
  // Real, already-saved templates (isEditMode) keep their own mappedHeaders,
  // same as before. Fresh uploads use a SEPARATE, shared pool instead
  // (uploadMappedHeaders) — Header Mapping/Header Place/Preview are all
  // global across the whole batch of uploaded files, not per-file; only
  // each file's own name and Product fill sheet selection stay individual
  // (see buildUploadSession/captureSnapshot/applySnapshot). `activeMapped`/
  // `setActiveMapped` below pick whichever one actually applies right now.
  const [mappedHeaders, setMappedHeaders] = useState([]) // [{ourHeaderId, ourHeaderLabel, dataType, isUniqueKeyPart, sheetHeaders, group, position, existingId?}]
  const [uploadMappedHeaders, setUploadMappedHeaders] = useState([])
  const activeMapped = isEditMode ? mappedHeaders : uploadMappedHeaders
  const setActiveMapped = isEditMode ? setMappedHeaders : setUploadMappedHeaders
  const [refreshToken, setRefreshToken] = useState(0)

  const [saving, setSaving] = useState(false)
  const [modalId, setModalId] = useState(null) // ourHeaderId of the Header Settings modal currently open, or null
  const [headerSettingsId, setHeaderSettingsId] = useState(null) // Our Header dictionary id whose OurHeaderSettingsModal is open, or null
  const [previewRule, setPreviewRule] = useState(null) // { type: 'mapping'|'place', item } — the sidebar rule currently previewed, or null
  const [previewApplying, setPreviewApplying] = useState(false)
  const [ourHeaderDropdownDefaults, setOurHeaderDropdownDefaults] = useState({}) // { [ourHeaderId]: string[] } — session-local, see handleUpdateOurHeaderSettings

  // The flat state above (workbook…dropdownColumns/presetData/categoriesData)
  // is always "whatever's currently on screen" — these two just move that
  // bundle into/out of an upload session object so switching which
  // uploaded file is active (handleSelectWorkItem) doesn't lose work.
  // Deliberately excludes mappedHeaders/uploadMappedHeaders — Header
  // Mapping/Place is the shared global pool (activeMapped), not part of any
  // one file's own session.
  function captureSnapshot() {
    return {
      workbook, sheetMeta, dataSheetName,
      dataGroupRow, dataHeaderRow, dataIsectionRow, dropdownDataStartRow,
      rawHeaders, rawHeaderNotes, rawHeaderGroupLabels, dropdownColumns, presetData, categoriesData, fileName, sourceFileUrl,
    }
  }
  function applySnapshot(session) {
    setWorkbook(session.workbook)
    setSheetMeta(session.sheetMeta)
    setDataSheetName(session.dataSheetName)
    setDataGroupRow(session.dataGroupRow)
    setDataHeaderRow(session.dataHeaderRow)
    setDataIsectionRow(session.dataIsectionRow)
    setDropdownDataStartRow(session.dropdownDataStartRow)
    setRawHeaders(session.rawHeaders)
    setRawHeaderNotes(session.rawHeaderNotes || {})
    setRawHeaderGroupLabels(session.rawHeaderGroupLabels || {})
    setDropdownColumns(session.dropdownColumns || {})
    setPresetData(session.presetData)
    setCategoriesData(session.categoriesData)
    setFileName(session.fileName)
    setSourceFileUrl(session.sourceFileUrl)
    setTemplateNumber('')
  }
  // The sidebar's Templates list click handler — real templates keep the
  // existing behavior (just swap activeTemplateId, the effect below reloads
  // from templatesData), but leaving an unsaved upload session snapshots
  // its current on-screen state first, so flipping back to it later
  // restores exactly where it was left, not a blank slate.
  function handleSelectWorkItem(id) {
    if (id === activeTemplateId) return
    if (activeTemplateId && !isRealTemplateId(activeTemplateId)) {
      setUploadSessions((prev) => ({ ...prev, [activeTemplateId]: captureSnapshot() }))
    }
    setActiveTemplateId(id)
  }
  // Mirrors the "populate active template" effect below, but for unsaved
  // upload sessions instead of real templatesData — fires whenever the
  // sidebar selects a different uploaded file.
  useEffect(() => {
    if (!activeTemplateId || isRealTemplateId(activeTemplateId)) return
    // Async IIFE purely to satisfy react-hooks/set-state-in-effect — no real
    // async work happens, same pattern the other effects in this file use.
    ;(async () => {
      const session = uploadSessions[activeTemplateId]
      if (session) applySnapshot(session)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot "load whatever's stored for this id right now" on selection change, not a live sync back to uploadSessions.
  }, [activeTemplateId])

  // Loads every pre-selected template up front (list page's checkbox
  // selection → ?templates=id1,id2,...) — cached in templatesData so
  // switching the active one in the sidebar never re-fetches.
  useEffect(() => {
    let cancelled = false
    // Wrapped in an async IIFE (rather than setState directly in the effect
    // body) purely to satisfy react-hooks/set-state-in-effect — same
    // pattern the extract-raw-headers effect below already uses.
    ;(async () => {
      if (templateIds.length === 0) {
        if (!cancelled) setLoadingExisting(false)
        return
      }
      try {
        const results = await Promise.all(
          templateIds.map((id) =>
            fetch(`/api/listing-tools/${id}`, { credentials: 'include' })
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => [id, data])
              .catch(() => [id, null]),
          ),
        )
        if (cancelled) return
        const map = {}
        const list = []
        for (const [id, data] of results) {
          if (!data?.template || !data?.content) continue
          map[id] = data
          list.push({
            id,
            templateName: data.template.templateName,
            finalName: composeFinalName(data.template, {
              category1: data.template.category1 || '', category2: data.template.category2 || '',
              category3: data.template.category3 || '', category4: data.template.category4 || '',
              category5: data.template.category5 || '', category6: data.template.category6 || '',
            }),
          })
        }
        if (list.length === 0) { setLoadError(true); return }
        setTemplatesData(map)
        setTemplatesList(list)
        setActiveTemplateId(list[0].id)
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoadingExisting(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- templateIds is a fresh array every render (parsed from searchParams in page.js); join(',') keeps this from re-firing every render.
  }, [templateIds.join(',')])

  // Populates the naming/sheet/mapping state for whichever template is
  // active — fires on initial load and every time the Templates sidebar
  // switches to a different one.
  useEffect(() => {
    let cancelled = false
    // Async IIFE purely to satisfy react-hooks/set-state-in-effect — no
    // real async work happens, this just synchronizes local form state
    // with templatesData[activeTemplateId] whenever either changes.
    ;(async () => {
      if (cancelled || !activeTemplateId) return
      const data = templatesData[activeTemplateId]
      if (!data) return
      setTemplateNameInput(data.template.templateName || '')
      setTemplateNumber(data.template.templateNumber || '')
      setCategoriesData({
        category1: data.template.category1 || '', category2: data.template.category2 || '',
        category3: data.template.category3 || '', category4: data.template.category4 || '',
        category5: data.template.category5 || '', category6: data.template.category6 || '',
      })
      setPresetData({
        marketplaceName: data.template.marketplaceName || '',
        exportVersion: data.template.exportVersion || '',
        description: data.template.description || '',
      })
      setMappedHeaders(seedFromExistingContent(data.content))
      // Switching templates drops any in-progress upload session — a raw
      // sheet extracted for one template isn't meaningful against another.
      setWorkbook(null)
      setFileName('')
      setSheetMeta([])
      setDataSheetName('')
      setDataGroupRow('')
      setDataHeaderRow('')
      setDataIsectionRow('')
      setDropdownDataStartRow('')
      setSourceFileUrl('')
      setRawHeaders([])
      setRawHeaderNotes({})
      setRawHeaderGroupLabels({})
      setDropdownColumns({})
    })()
    return () => { cancelled = true }
  }, [activeTemplateId, templatesData])

  // The global header dictionary — fetched globally across all marketplaces so
  // Our Headers is shared and accessible everywhere.
  useEffect(() => {
    let cancelled = false
    fetch('/api/listing-tools/mapping/headers', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { headers: [] }))
      .then((data) => { if (!cancelled) setOurHeaders(data.headers || []) })
      .catch(() => { if (!cancelled) setOurHeaders([]) })
    return () => { cancelled = true }
  }, [refreshToken])

  // A brand-new template only — an already-selected template already has
  // its own real categories, which this must never overwrite.
  // Fills only currently-empty Category slots with `words`, in order —
  // used for the header-derived source, where there's no fixed position to
  // honor, just a compact list of candidate words to top up whatever's
  // still blank starting at Category 1.
  function fillEmptyCategories(words) {
    if (isEditMode || !words.length) return
    setCategoriesData((prev) => {
      const next = { ...prev }
      let wi = 0
      for (let n = 1; n <= 6 && wi < words.length; n++) {
        const key = `category${n}`
        if (!next[key]) { next[key] = words[wi]; wi++ }
      }
      return next
    })
  }
  function applyDerivedCategoriesFromHeaders(headers) {
    fillEmptyCategories(deriveCategoriesFromHeaders(headers))
  }

  // Builds a fresh upload session's starting state off one parsed workbook
  // — marketplace/categories straight from the filename (fixed positional
  // convention, see extractBrandAndCategories) and sheet/row selections
  // from the brand's marketplace rule (constants/sheetDefaults.js). A brand
  // new session never has anything to "not overwrite", so this sets
  // presetData/categoriesData directly rather than going through the
  // only-fill-empty-slots helpers above (those are for topping up an
  // already-in-progress session from header-derived hints instead).
  function buildUploadSession(file, wb, meta) {
    const { brand, categories } = extractBrandAndCategories(file.name)
    const effectiveBrand = brand || presetData.marketplaceName || selectedMarketplace
    const rule = detectMarketplaceSheetDefaults(wb.SheetNames, effectiveBrand)
    const nextDataSheetName = rule.dataSheetName || wb.SheetNames[0] || ''
    return {
      workbook: wb,
      sheetMeta: meta,
      dataSheetName: nextDataSheetName,
      dataGroupRow: nextDataSheetName ? rule.dataGroupRow : '',
      dataHeaderRow: nextDataSheetName ? rule.dataHeaderRow : '',
      dataIsectionRow: nextDataSheetName ? rule.dataIsectionRow : '',
      dropdownDataStartRow: nextDataSheetName ? DEFAULT_SHEET_ROWS.DROPDOWN_DATA_START_ROW : '',
      rawHeaders: [],
      rawHeaderNotes: {},
      rawHeaderGroupLabels: {},
      dropdownColumns: {},
      presetData: { marketplaceName: effectiveBrand, exportVersion: presetData.exportVersion || 'v1.0', description: '' },
      categoriesData: {
        category1: categories[0], category2: categories[1], category3: categories[2],
        category4: categories[3], category5: categories[4], category6: categories[5],
      },
      fileName: file.name,
      sourceFileUrl: '',
    }
  }

  // One file → its own upload session (see buildUploadSession): sheet/row
  // selections come off the brand's marketplace rule automatically, the
  // sidebar's Templates list gets a new entry for it (appended, so a
  // second "Upload Bulk Sheet" click adds to the working set instead of
  // replacing it), and it becomes the active selection so its naming/
  // sheet-selector fields show immediately. The extraction effect below
  // reads headers once workbook/dataSheetName land in state.
  async function handleSingleFile(file) {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    setExtraction({ stage: 'Parsing workbook…', current: 0, total: 0 })
    await yieldToPaint()
    const wb = XLSX.read(buf, { type: 'array' })
    const meta = []
    for (let i = 0; i < wb.SheetNames.length; i++) {
      const name = wb.SheetNames[i]
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 })
      const colCount = (aoa[HEADER_ROW_INDEX] || []).filter((v) => String(v ?? '').trim() !== '').length
      meta.push({ name, colCount, rowCount: Math.max(aoa.length - HEADER_ROW_INDEX - 1, 0) })
      setExtraction({ stage: 'Scanning sheets…', current: i + 1, total: wb.SheetNames.length })
      if (i > 0 && i % 5 === 0) await yieldToPaint()
    }
    const session = buildUploadSession(file, wb, meta)
    if (isEditMode) {
      // Attaching a fresh sheet to the real template already being edited
      // (activeTemplateId stays put) — just loads its headers/rows into the
      // current view, it's not a new independent, separately-savable entry.
      applySnapshot({ ...session, presetData, categoriesData })
      setUploadedFiles([{ name: file.name, sheets: meta.map((m) => m.name) }])
      if (!session.dataSheetName) setExtraction(null)
      if (/\.xlsx$/i.test(file.name)) uploadSourceFile(file, null)
      return
    }
    const fileId = `file_${Date.now()}`
    setUploadSessions((prev) => ({ ...prev, [fileId]: session }))
    setUploadedFiles((prev) => [...prev, { name: file.name, sheets: meta.map((m) => m.name) }])
    setTemplatesList((prev) => [...prev, { id: fileId, templateName: file.name, finalName: file.name }])
    applySnapshot(session)
    setActiveTemplateId(fileId)
    if (!session.dataSheetName) setExtraction(null)
    if (/\.xlsx$/i.test(file.name)) uploadSourceFile(file, fileId)
  }

  // Several files at once — there's no single workbook to run the sheet-
  // selector UI against, so each file gets its OWN brand → marketplace rule
  // lookup (name + which sheet/row is "Fill" is individual per file), but
  // every file of the same marketplace reads the same fixed rows off that
  // rule (the row numbers are common, not tuned per file).
  //
  // A batch is assumed to be one marketplace's sheets (that's what makes
  // "common" row rules valid across the whole batch) — checked off each
  // file's own first-token brand (extractBrandAndCategories), lower-cased
  // so "Meesho"/"meesho" don't count as a mismatch. Mixed marketplaces in
  // one upload is almost always a mistake, so this rejects before touching
  // any existing session state, rather than silently applying one file's
  // rule to another's sheet.
  //
  // Each file becomes its own independent upload session (buildUploadSession)
  // rather than one pooled/shared header list — selectable and individually
  // saveable from the sidebar afterwards (see handleSelectWorkItem and the
  // per-file Save button next to the sheet selector). Only makes sense for
  // a brand-new working set: dropping several files while editing a real,
  // already-loaded template would leave it unclear which one you meant to
  // edit, so that combination is rejected instead of silently picking one.
  async function handleMultipleFiles(files) {
    if (isEditMode) {
      addToast('Editing one existing template — drop a single sheet to update it, not several at once.', 'error')
      setExtraction(null)
      return
    }
    const brands = files.map((f) => extractBrandAndCategories(f.name).brand)
    const firstBrandLower = (brands.find(Boolean) || '').toLowerCase()
    const mismatched = firstBrandLower && brands.some((b) => b && b.toLowerCase() !== firstBrandLower)
    if (mismatched) {
      const found = [...new Set(brands.filter(Boolean))].join(', ')
      addToast(`These files aren't all the same marketplace (found: ${found}) — upload one marketplace's sheets per batch.`, 'error')
      setExtraction(null)
      return
    }
    const XLSX = await import('xlsx')
    const fileInfos = []
    const sessions = {}
    const entries = []
    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi]
      setExtraction({ stage: `Reading file ${fi + 1} of ${files.length}…`, current: fi, total: files.length })
      await yieldToPaint()
      try {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const meta = wb.SheetNames.map((name) => {
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 })
          return {
            name,
            colCount: (aoa[HEADER_ROW_INDEX] || []).filter((v) => String(v ?? '').trim() !== '').length,
            rowCount: Math.max(aoa.length - HEADER_ROW_INDEX - 1, 0),
          }
        })
        fileInfos.push({ name: file.name, sheets: wb.SheetNames })
        const fileId = `file_${Date.now()}_${fi}`
        const baseSession = buildUploadSession(file, wb, meta)
        // Extracted eagerly for every file here (not just whichever one
        // ends up active below) — that's what lets Header Mapping show the
        // whole batch's headers immediately instead of only after clicking
        // through each file one by one.
        const extracted = await extractSessionHeaders(XLSX, wb, baseSession)
        const session = { ...baseSession, ...extracted }
        sessions[fileId] = session
        entries.push({ id: fileId, templateName: file.name, finalName: file.name })
        if (/\.xlsx$/i.test(file.name)) uploadSourceFile(file, fileId)
      } catch {
        addToast(`Could not read "${file.name}" — skipped.`, 'error')
      }
    }
    setUploadSessions((prev) => ({ ...prev, ...sessions }))
    setUploadedFiles((prev) => [...prev, ...fileInfos])
    setTemplatesList((prev) => [...prev, ...entries])
    const firstId = entries[0]?.id
    if (firstId) {
      applySnapshot(sessions[firstId])
      setActiveTemplateId(firstId)
    }
    setExtraction({ stage: 'Done', current: files.length, total: files.length })
    setTimeout(() => setExtraction(null), 500)
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    setParsing(true)
    setExtraction({ stage: 'Reading file…', current: 0, total: 0 })
    try {
      if (files.length === 1) await handleSingleFile(files[0])
      else await handleMultipleFiles(files)
    } catch {
      addToast('Could not read that file — is it a valid .xlsx?', 'error')
      setExtraction(null)
    } finally {
      setParsing(false)
    }
  }

  // `fileId` ties the result back to the right upload session even if the
  // sidebar selection has moved on to a different file by the time this
  // resolves — null means "no session, just update the live flat state"
  // (the isEditMode/attach-a-sheet path in handleSingleFile).
  async function uploadSourceFile(file, fileId) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/listing-tools/source-file', { method: 'POST', body: formData })
      const data = await res.json().catch(() => null)
      if (res.status === 401) return
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Upload failed')
      if (fileId) {
        setUploadSessions((prev) => (prev[fileId] ? { ...prev, [fileId]: { ...prev[fileId], sourceFileUrl: data.url } } : prev))
      }
      if (!fileId || activeIdRef.current === fileId) setSourceFileUrl(data.url)
    } catch {
      addToast("Couldn't save the original bulk sheet — this won't affect mapping/saving the template.", 'error')
    }
  }

  // Raw action, no confirm inside — the sidebar's Uploaded Sheets section
  // confirms via its own shared ConfirmDialog before ever calling this, so
  // a confirm here would just double up. The toolbar's own upload control
  // still confirms itself, via confirmClearUpload below.
  function handleClearUpload() {
    setWorkbook(null)
    setFileName('')
    setUploadedFiles([])
    if (!isEditMode) {
      setTemplatesList([])
      setUploadSessions({})
      setActiveTemplateId(null)
    }
    setSheetMeta([])
    setDataSheetName('')
    setDataGroupRow('')
    setDataHeaderRow('')
    setDataIsectionRow('')
    setDropdownDataStartRow('')
    setRawHeaders([])
    setRawHeaderNotes({})
    setRawHeaderGroupLabels({})
    setDropdownColumns({})
  }

  function confirmClearUpload() {
    if (!window.confirm('Remove the uploaded sheet(s)? Already-mapped headers stay as they are.')) return
    handleClearUpload()
  }

  // Section 2's Product fill sheet <select> — same reset-on-pick behavior
  // as TemplateSettingsWizard.jsx's own selectDataSheet, but rows default
  // off the current marketplace's rule (constants/sheetDefaults.js) instead
  // of one flat set of numbers, since Meesho and Flipkart/default disagree
  // on which row is which. No Dropdown Reference Sheet picker here anymore
  // — dropdown columns auto-detect off this same sheet's own data instead.
  function currentBrand() {
    return presetData.marketplaceName || selectedMarketplace
  }
  function selectDataSheet(val) {
    setDataSheetName(val)
    if (!val) {
      setDataGroupRow('')
      setDataHeaderRow('')
      setDataIsectionRow('')
      setDropdownDataStartRow('')
      return
    }
    const rule = detectMarketplaceSheetDefaults(workbook?.SheetNames || [], currentBrand())
    setDataGroupRow(rule.dataGroupRow)
    setDataHeaderRow(rule.dataHeaderRow)
    setDataIsectionRow(rule.dataIsectionRow)
    setDropdownDataStartRow(DEFAULT_SHEET_ROWS.DROPDOWN_DATA_START_ROW)
  }
  // Re-reads the Product fill sheet's headers AND its own dropdown columns
  // together, on ANY of Section 2's data-sheet inputs changing — same
  // combined-effect idea as TemplateSettingsWizard.jsx's own rebuild effect
  // (a different sheet or a different row number means different headers,
  // so a partial re-read left stale data behind before). No separate
  // Validations/Dropdown Reference Sheet to also watch — dropdown columns
  // come from this same sheet's own data now (detectColumnDropdownValues).
  // Header-label cleaning stays deliberately simpler than that file's
  // splitHeaderCell (see cleanLabel's own comment).
  useEffect(() => {
    if (!workbook || !dataSheetName) return
    let cancelled = false
    ;(async () => {
      const XLSX = await import('xlsx')
      if (cancelled) return
      const ws = workbook.Sheets[dataSheetName]
      if (!ws) return
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const headerRowIdx = parseRowInput(dataHeaderRow, HEADER_ROW_INDEX)
      // The Header Row and I section inputs are allowed to be configured as
      // the SAME number (Meesho's default is both = 2) — that's not "read
      // this row twice", it means "1st line is Headers, 2nd line (right
      // after) is I section". Only actually offset when they're equal;
      // configured as different rows (e.g. Flipkart's header=1/isection=3)
      // reads isection literally at its own row, no adjustment.
      const sameConfiguredRow = String(dataHeaderRow ?? '').trim() !== ''
        && String(dataIsectionRow ?? '').trim() !== ''
        && Number(dataHeaderRow) === Number(dataIsectionRow)
      const isectionRowIdx = sameConfiguredRow ? headerRowIdx + 1 : parseRowInput(dataIsectionRow, headerRowIdx + 1)
      const rawRow = aoa[headerRowIdx] || []
      const isectionRow = aoa[isectionRowIdx] || []
      // Group Row, forward-filled across merged cells — kept on each raw
      // header for session fidelity; autoPlaceHeaders no longer reads it
      // (see that function's own comment on why).
      const groupRowIdx = parseRowInput(dataGroupRow, headerRowIdx)
      const groupRowFilled = forwardFillRow(aoa[groupRowIdx] || [], rawRow.length)
      // Dropdown detection reads this SAME sheet's own data rows for each
      // column (detectColumnDropdownValues) — no separate Validations/
      // Dropdown Reference Sheet involved at all. Real dropdown-enabled
      // data starts at the "Dropdown Data Row" input (defaults to row 5,
      // same for every marketplace — Meesho and Flipkart both confirmed the
      // same, unlike Header Row/I section which differ — but editable like
      // every other row here), never earlier than the header row itself.
      const dropdownDataStartIdx = Math.max(
        headerRowIdx + 1,
        parseRowInput(dropdownDataStartRow, DEFAULT_SHEET_ROWS.DROPDOWN_DATA_START_ROW - 1),
      )
      const dataRows = aoa.slice(dropdownDataStartIdx)
      const seen = new Set()
      const out = []
      const notes = {}
      const groupLabels = {}
      const cols = {}
      const total = rawRow.length
      for (let i = 0; i < total; i++) {
        setExtraction({ stage: 'Extracting headers…', current: i + 1, total })
        if (i > 0 && i % 12 === 0) await yieldToPaint()
        const { label, description: cellNote } = splitHeaderCell(rawRow[i])
        if (!label || isPlaceholderLabel(label)) continue
        const key = label.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(label)
        // In-cell note (same cell, split by line/lead-in) wins over the I
        // section row's note when both exist.
        const isectionNote = cleanLabel(isectionRow[i])
        const note = cellNote || (isectionNote && !isPlaceholderLabel(isectionNote) ? isectionNote : '')
        if (note) notes[label] = note
        if (groupRowFilled[i]) groupLabels[label] = groupRowFilled[i]
        const values = detectColumnDropdownValues(dataRows, i, label)
        if (values) cols[label] = { sheetName: dataSheetName, columnName: label, values }
      }
      if (cancelled) return
      setRawHeaders(out)
      setRawHeaderNotes(notes)
      setRawHeaderGroupLabels(groupLabels)
      setDropdownColumns(cols)
      applyDerivedCategoriesFromHeaders(out)
      setExtraction({ stage: 'Done', current: out.length, total: out.length })
      setTimeout(() => { if (!cancelled) setExtraction(null) }, 500)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyDerivedCategoriesFromHeaders is a plain closure recreated every render; only the sheet/row inputs below should trigger a re-read.
  }, [workbook, dataSheetName, dataHeaderRow, dataGroupRow, dataIsectionRow, dropdownDataStartRow])

  // Every uploaded file's own raw headers pooled into one set — Header
  // Mapping/Place work off the whole batch, not just whichever file happens
  // to be selected right now (see activeMapped's own comment above).
  // Memoized (not a plain computed const) so its reference only changes
  // when rawHeaders/uploadSessions actually do — the auto-map effect below
  // depends on it, and a fresh array every render would re-fire it constantly.
  const allRawHeaders = useMemo(
    () => (isEditMode ? rawHeaders : [...new Set([...rawHeaders, ...Object.values(uploadSessions).flatMap((s) => s.rawHeaders || [])])]),
    [isEditMode, rawHeaders, uploadSessions],
  )
  const unmappedRawHeaders = allRawHeaders.filter((h) => !activeMapped.some((m) => m.sheetHeaders.includes(h)))
  const mappedOnly = activeMapped.filter((m) => m.sheetHeaders.length > 0)
  const previewHeaders = mappedOnly.map((m) => ({ id: m.ourHeaderId, label: m.ourHeaderLabel, group: m.group }))

  // Every currently pooled sheet in this batch with its OWN raw headers,
  // marketplace, and category name — the active one reads live off flat
  // state, everyone else off their stored session (same source
  // allRawHeaders itself pools from). `categoryName` prefers Category 6
  // (the filename's last token, see extractBrandAndCategories — "the
  // category" for a sheet like "Meesho_Blouse.xlsx"), falling back through
  // the other category slots, then the raw file name. Feeds both the
  // Header Mapping grid's Common Headers column and the SheetHeaderTree
  // view below (marketplaceGroups).
  const sheetsIndex = useMemo(() => {
    if (isEditMode) return []
    return templatesList
      .map((t) => {
        const session = t.id === activeTemplateId ? { presetData, categoriesData, rawHeaders } : (uploadSessions[t.id] || {})
        const cats = session.categoriesData || {}
        const categoryName = cats.category6 || cats.category1 || cats.category2 || t.templateName || t.id
        return {
          id: t.id,
          name: t.templateName || t.finalName || t.id,
          marketplaceName: session.presetData?.marketplaceName || 'Other',
          categoryName,
          headers: t.id === activeTemplateId ? rawHeaders : (session.rawHeaders || []),
        }
      })
      .filter((s) => s.headers.length > 0)
  }, [isEditMode, templatesList, activeTemplateId, presetData, categoriesData, rawHeaders, uploadSessions])
  // Whole-batch commonality (see computeCommonHeaderInfo) — feeds the
  // Header Mapping grid's Common Headers column. In practice a batch is
  // always one marketplace (mismatched marketplaces are rejected at
  // upload), so this and "common within its marketplace group" below
  // amount to the same thing.
  const commonHeaderInfo = useMemo(() => computeCommonHeaderInfo(sheetsIndex), [sheetsIndex])
  // sheetsIndex grouped Marketplace → its own sheets, each carrying its own
  // Common (computed within that marketplace only) — the hierarchy the
  // Sheets & Headers tree actually renders: marketplace first, then each
  // sheet's category name, then its fields.
  const marketplaceGroups = useMemo(() => {
    const byMarket = new Map()
    for (const s of sheetsIndex) {
      if (!byMarket.has(s.marketplaceName)) byMarket.set(s.marketplaceName, [])
      byMarket.get(s.marketplaceName).push(s)
    }
    return [...byMarket.entries()].map(([marketplaceName, sheets]) => ({
      marketplaceName,
      sheets,
      ...computeCommonHeaderInfo(sheets),
    }))
  }, [sheetsIndex])
  // Same grouping the tree uses, applied to the Our Header / Map Header
  // columns — which category a MAPPED header belongs to, derived from
  // which sheet(s) its raw sheetHeaders actually came from (Common when any
  // of them is one of that marketplace's Common fields, the sheet's own
  // category name otherwise, joined when it pulls from more than one).
  // Only covers headers currently mapped in this session — Our Header
  // entries not yet used fall to "Unassigned" in the column itself.
  const categoryForOurHeaderId = useMemo(() => {
    const out = new Map()
    const findCategory = (rawLabel) => {
      const key = rawLabel.trim().toLowerCase()
      for (const mp of marketplaceGroups) {
        if (mp.keys.has(key)) return 'Common'
        for (const sheet of mp.sheets) {
          if (sheet.headers.some((h) => h.trim().toLowerCase() === key)) return sheet.categoryName
        }
      }
      return null
    }
    for (const m of activeMapped) {
      if (m.sheetHeaders.length === 0) continue
      const cats = new Set(m.sheetHeaders.map(findCategory).filter(Boolean))
      if (cats.size === 0) continue
      out.set(m.ourHeaderId, cats.has('Common') ? 'Common' : [...cats].join(', '))
    }
    return out
  }, [activeMapped, marketplaceGroups])
  // Sub-heading order for the Our Header / Map Header columns — Common
  // first, then every sheet's own category name in batch order, Unassigned
  // last for whatever isn't tied to a category yet.
  const categoryOrder = useMemo(() => {
    const names = ['Common']
    for (const mp of marketplaceGroups) {
      for (const s of mp.sheets) {
        if (!names.includes(s.categoryName)) names.push(s.categoryName)
      }
    }
    names.push('Unassigned')
    return names
  }, [marketplaceGroups])

  function handleMap(sheetHeader, ourHeaderId) {
    const oh = ourHeaders.find((h) => h.id === ourHeaderId)
    if (!oh) return
    setActiveMapped((prev) => {
      const existing = prev.find((m) => m.ourHeaderId === ourHeaderId)
      if (existing) {
        return prev.map((m) => (m.ourHeaderId === ourHeaderId
          ? { ...m, sheetHeaders: [...new Set([...m.sheetHeaders, sheetHeader])] }
          : m))
      }
      // Session-local dropdown defaults set via the Our Header's own
      // Settings button (openSettingsForRawHeader/OurHeaderSettingsModal),
      // if any, seed this mapping's starting values.
      const defaults = ourHeaderDropdownDefaults[ourHeaderId]
      return [...prev, {
        ourHeaderId,
        ourHeaderLabel: oh.label,
        dataType: oh.dataType,
        isUniqueKeyPart: !!oh.isUniqueKeyPart,
        sheetHeaders: [sheetHeader],
        group: null,
        position: 0,
        dropdownValues: defaults && defaults.length ? [...defaults] : [],
      }]
    })
  }
  function handleUnmap(sheetHeader, ourHeaderId) {
    setActiveMapped((prev) => prev.map((m) => (m.ourHeaderId === ourHeaderId
      ? { ...m, sheetHeaders: m.sheetHeaders.filter((s) => s !== sheetHeader) }
      : m)))
  }

  // "map columns with names" — any raw header whose text exactly matches an
  // Our Header's label (case/space-insensitive) auto-maps the moment both
  // lists are available, same as clicking it in the Header Mapping grid by
  // hand. Only runs when the raw/canonical header lists themselves change
  // (new sheet picked, or the dictionary loads/updates) — not on every
  // manual (un)map — so it never fights a deliberate unmap.
  useEffect(() => {
    if (allRawHeaders.length === 0 || ourHeaders.length === 0) return
    // Async IIFE purely to satisfy react-hooks/set-state-in-effect — no real
    // async work happens, same pattern the other effects in this file use.
    ;(async () => {
      const byName = new Map(ourHeaders.map((h) => [h.label.trim().toLowerCase(), h]))
      const stillUnmapped = allRawHeaders.filter((h) => !activeMapped.some((m) => m.sheetHeaders.includes(h)))
      for (const raw of stillUnmapped) {
        const oh = byName.get(raw.trim().toLowerCase())
        if (oh) handleMap(raw, oh.id)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately excludes activeMapped/handleMap: this is a one-shot "fill in the obvious matches" pass on new data, not an invariant re-applied on every manual (un)map.
  }, [allRawHeaders, ourHeaders])

  // BulkPlaceGrid's own copy of /new's SECTIONS grid + drag-and-drop
  // (NewTemplateDesign.jsx's onCardDrop/onSectionDrop) — one handler covers
  // both moving a header to a different section (group/uiBucket change,
  // dropped straight on a section or on one of its cards) and reordering it
  // within its current one (dropped on another card there). `beforeOurHeaderId`
  // is null when dropped directly on the section (append at the end);
  // `after` says which side of that card it landed on.
  function handleMoveHeader(ourHeaderId, group, uiBucket, beforeOurHeaderId, after) {
    setActiveMapped((prev) => {
      const sectionKeyOf = (m) => (m.uiBucket === 'image_link' ? 'image_link' : (m.group || 'unassigned'))
      const targetSectionId = uiBucket === 'image_link' ? 'image_link' : (group || 'unassigned')
      const moved = prev.find((m) => m.ourHeaderId === ourHeaderId)
      if (!moved) return prev
      const targetCards = prev
        .filter((m) => m.ourHeaderId !== ourHeaderId && sectionKeyOf(m) === targetSectionId)
        .sort((a, b) => a.position - b.position)
      let insertAt = targetCards.length
      if (beforeOurHeaderId) {
        const idx = targetCards.findIndex((m) => m.ourHeaderId === beforeOurHeaderId)
        if (idx !== -1) insertAt = after ? idx + 1 : idx
      }
      targetCards.splice(insertAt, 0, { ...moved, group, uiBucket })
      const posById = new Map(targetCards.map((m, idx) => [m.ourHeaderId, idx]))
      return prev.map((m) => {
        if (m.ourHeaderId === ourHeaderId) return { ...m, group, uiBucket, position: posById.get(ourHeaderId) }
        return posById.has(m.ourHeaderId) ? { ...m, position: posById.get(m.ourHeaderId) } : m
      })
    })
  }

  // Default placement, button-triggered (not automatic on map) — every
  // currently mapped-but-unplaced header gets a group:
  //  - an image-type header (its Our Header's own dataType, or a label that
  //    just looks like one, per looksLikeImageLabel's keyword match) goes to
  //    Images (uiBucket 'image_link' — same overlay as /new's own Image
  //    Link bucket, its real group still design_system).
  //  - a header mapped 1:1 under the exact same name as one of its own raw
  //    sheet columns (case/whitespace-insensitive) is effectively still
  //    "the sheet's own field" — just carried straight through — and goes
  //    to Compulsory, whether that raw column came off the Common Headers
  //    pool (shows up in every uploaded sheet) or the regular Unmap Header
  //    one.
  //  - everything else — a canonical name that doesn't match any of its raw
  //    sheet columns, meaning it's a name YOU chose/curated in Our Headers
  //    rather than a pass-through of what the sheet itself called it — goes
  //    to Product Details.
  // Position within each target group picks up after whatever's already
  // there (manually placed or from an earlier auto-place run).
  function autoPlaceHeaders() {
    setActiveMapped((prev) => {
      const nextPos = { design_system: 0, compulsory: 0, prefill: 0 }
      for (const m of prev) {
        if (m.group) nextPos[m.group] = (nextPos[m.group] || 0) + 1
      }
      let placedCount = 0
      const next = prev.map((m) => {
        if (m.group || m.sheetHeaders.length === 0) return m
        const isImage = m.dataType === 'image' || looksLikeImageLabel(m.ourHeaderLabel)
        const canonical = m.ourHeaderLabel.trim().toLowerCase()
        const isPassThrough = m.sheetHeaders.some((sh) => sh.trim().toLowerCase() === canonical)
        const group = isImage ? 'design_system' : (isPassThrough ? 'compulsory' : 'design_system')
        const position = nextPos[group] || 0
        nextPos[group] = position + 1
        placedCount += 1
        return { ...m, group, position, uiBucket: isImage ? 'image_link' : m.uiBucket || null }
      })
      if (placedCount === 0) {
        addToast('Nothing mapped-but-unplaced to auto-place.', 'error')
        return prev
      }
      addToast(`Auto-placed ${placedCount} header(s).`, 'success')
      return next
    })
  }

  // Per-header "Settings" button (BulkMappingGrid's Map Header column) —
  // same NewDesignColumnModal /new uses for its own field cards (type tabs,
  // dropdown/multiselect values, formula, Auto-Fill From, unique key,
  // disable), reused as-is rather than a re-styled copy. `patch` here is
  // whatever shape the modal sends (dataType/dropdownValues/formula/
  // linkedHeaderIds/linkedHeaderId/linkedGroup/isUniqueKeyPart/disabled) —
  // merged straight onto the matching activeMapped entry.
  function handleUpdateHeader(ourHeaderId, patch) {
    setActiveMapped((prev) => prev.map((m) => (m.ourHeaderId === ourHeaderId ? { ...m, ...patch } : m)))
  }

  // Quick-add from the sidebar's Our Headers search box (Task: press Enter
  // on a no-match search to create it) — defaults to Product Details/common,
  // reassignable later like any other header.
  async function handleCreateHeader(label) {
    setCreatingHeader(true)
    try {
      const res = await fetch('/api/listing-tools/mapping/headers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, headerGroup: 'design_system', scope: 'common' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to create header')
      setOurHeaders((prev) => [...prev, data.header])
      addToast(`"${label}" added to Our Headers.`, 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setCreatingHeader(false)
    }
  }
  async function handleRenameHeader(id, label) {
    try {
      const res = await fetch(`/api/listing-tools/mapping/headers/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Rename failed')
      setOurHeaders((prev) => prev.map((h) => (h.id === id ? data.header : h)))
    } catch (err) {
      addToast(err.message, 'error')
    }
  }
  // Header Settings (OurHeaderSettingsModal) — Type/Unique Key Part persist
  // to the global Our Header dictionary via the same PATCH endpoint
  // handleRenameHeader uses. Dropdown/Multi Select values have no
  // dictionary-level column to persist to (dropdown values are normally
  // read off a real sheet, per template) — kept session-local instead
  // (ourHeaderDropdownDefaults), applied as a new mapping's starting values
  // the next time this header gets mapped (see handleMap).
  async function handleUpdateOurHeaderSettings(id, patch) {
    if ('dropdownValues' in patch) {
      setOurHeaderDropdownDefaults((prev) => ({ ...prev, [id]: patch.dropdownValues }))
    }
    const serverPatch = {}
    if ('dataType' in patch) serverPatch.dataType = patch.dataType
    if ('isUniqueKeyPart' in patch) serverPatch.isUniqueKeyPart = patch.isUniqueKeyPart
    if (Object.keys(serverPatch).length === 0) return
    try {
      const res = await fetch(`/api/listing-tools/mapping/headers/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(serverPatch),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Update failed')
      setOurHeaders((prev) => prev.map((h) => (h.id === id ? data.header : h)))
    } catch (err) {
      addToast(err.message, 'error')
    }
  }
  // Settings button on a raw, not-yet-mapped sheet header (Unmap Header
  // column) — it has no canonical identity yet, so this finds an existing
  // Our Header with the same name (case-insensitive) to configure, or
  // creates one on the fly (same as the sidebar's quick-add) so there's
  // something to actually open settings on.
  async function openSettingsForRawHeader(rawLabel) {
    const existing = ourHeaders.find((h) => h.label.trim().toLowerCase() === rawLabel.trim().toLowerCase())
    if (existing) {
      setHeaderSettingsId(existing.id)
      return
    }
    setCreatingHeader(true)
    try {
      const res = await fetch('/api/listing-tools/mapping/headers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: rawLabel, headerGroup: 'design_system', scope: 'common' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to create header')
      setOurHeaders((prev) => [...prev, data.header])
      setHeaderSettingsId(data.header.id)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setCreatingHeader(false)
    }
  }
  async function handleDeleteHeader(id) {
    try {
      const res = await fetch(`/api/listing-tools/mapping/headers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Delete failed')
      setOurHeaders((prev) => prev.filter((h) => h.id !== id))
    } catch (err) {
      addToast(err.message, 'error')
    }
  }
  // Confirmation now happens in the sidebar (custom modal, requestConfirm)
  // before this ever gets called — this just does the deleting.
  async function handleDeleteAllHeaders() {
    if (ourHeaders.length === 0) return
    for (const h of ourHeaders) {
      try {
        await fetch(`/api/listing-tools/mapping/headers/${h.id}`, { method: 'DELETE' })
      } catch { /* best-effort, continue deleting the rest */ }
    }
    setOurHeaders([])
  }

  async function applyMappingItem(item) {
    if (unmappedRawHeaders.length === 0) { addToast('No unmapped headers to apply this to.', 'error'); return }
    try {
      const res = await fetch(`/api/listing-tools/mapping/rules/${item.id}/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetHeaders: unmappedRawHeaders }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Apply failed')
      for (const m of data.mapped) handleMap(m.sheetHeader, m.ourHeaderId)
      addToast(`Mapped ${data.mapped.length} header(s)${data.unmatched.length ? `, ${data.unmatched.length} left unmatched` : ''}.`, 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }
  async function applyPlaceItem(item) {
    const candidates = mappedOnly.filter((m) => !m.group).map((m) => m.ourHeaderId)
    if (candidates.length === 0) { addToast('No mapped-but-unplaced headers to apply this to.', 'error'); return }
    try {
      const res = await fetch(`/api/listing-tools/mapping/place-rules/${item.id}/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ourHeaderIds: candidates }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Apply failed')
      setActiveMapped((prev) => prev.map((m) => {
        const hit = data.placed.find((p) => p.ourHeaderId === m.ourHeaderId)
        return hit ? { ...m, group: hit.group, position: hit.position } : m
      }))
      addToast(`Placed ${data.placed.length} header(s).`, 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  // Clicking a saved rule's own name in the sidebar (as opposed to its Play
  // button) previews what it actually contains — sheetHeader -> our header
  // for Header Mapping/Mapping Rule, our header -> group + index for Header
  // Place/Place Rule — right above the section it belongs to, instead of
  // applying it blind. Applying from inside that preview reuses the exact
  // same apply functions the Play button already calls, then closes itself.
  async function applyPreviewRule() {
    if (!previewRule) return
    setPreviewApplying(true)
    try {
      if (previewRule.type === 'mapping') await applyMappingItem(previewRule.item)
      else await applyPlaceItem(previewRule.item)
      setPreviewRule(null)
    } finally {
      setPreviewApplying(false)
    }
  }

  // Every saved Mapping Rule / Place Rule name always starts with
  // "Marketplace_" — fixed, not editable away, only the part after it is
  // actually typed — so a rule's name always says at a glance which
  // marketplace it applies to, matching how every saved template's own
  // name already works (composeAutoTemplateName). The sidebar's own inline
  // add-row builds and validates that prefixed name now (no more
  // window.prompt) and passes it straight through here.
  async function saveMappingAs(kind, name) {
    const label = kind === 'preset' ? 'Header Mapping' : 'Mapping Rule'
    if (!name) return
    const entries = mappedOnly.flatMap((m) => m.sheetHeaders.map((sh) => ({ sheetHeader: sh, ourHeaderId: m.ourHeaderId, matchType: 'exact' })))
    if (entries.length === 0) { addToast('Map at least one header first.', 'error'); return }
    try {
      const res = await fetch('/api/listing-tools/mapping/rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name: name.trim(), marketplaceName: presetData.marketplaceName, category1: categoriesData.category1, entries }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Save failed')
      setRefreshToken((t) => t + 1)
      addToast(`${label} saved.`, 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }
  async function savePlaceAs(kind, name) {
    const label = kind === 'preset' ? 'Header Place' : 'Place Rule'
    if (!name) return
    const entries = mappedOnly.filter((m) => m.group).map((m) => ({ ourHeaderId: m.ourHeaderId, group: m.group, position: m.position }))
    if (entries.length === 0) { addToast('Place at least one header first.', 'error'); return }
    try {
      const res = await fetch('/api/listing-tools/mapping/place-rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name: name.trim(), marketplaceName: presetData.marketplaceName, category1: categoriesData.category1, entries }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Save failed')
      setRefreshToken((t) => t + 1)
      addToast(`${label} saved.`, 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  // A working-set entry's own naming/sheet/mapping fields — flat state for
  // whichever one is currently active (live edits), its stored session for
  // every other upload session sitting in the batch.
  function resolveSessionFields(id) {
    if (id === activeTemplateId) {
      return { presetData, categoriesData, rawHeaders, dropdownColumns, rawHeaderNotes, fileName, sourceFileUrl, dataSheetName }
    }
    const s = uploadSessions[id] || {}
    return {
      presetData: s.presetData || { marketplaceName: '', exportVersion: '', description: '' },
      categoriesData: s.categoriesData || DEFAULT_CATEGORIES,
      rawHeaders: s.rawHeaders || [],
      dropdownColumns: s.dropdownColumns || {},
      rawHeaderNotes: s.rawHeaderNotes || {},
      fileName: s.fileName || '',
      sourceFileUrl: s.sourceFileUrl || '',
      dataSheetName: s.dataSheetName || '',
    }
  }

  // One save-ready payload per working-set entry (templatesList) — every
  // uploaded file becomes its own create body (same shape the singular
  // POST /api/listing-tools takes), every already-real template becomes
  // its own update body (same shape the singular PATCH takes). Returns
  // null for an entry with nothing to save yet (no headers mapped+placed,
  // or no name) — handleSave filters those out and reports them as skipped
  // rather than failing the whole batch over one empty template.
  function buildSavePayloadForItem(t) {
    if (isRealTemplateId(t.id)) {
      if (t.id !== activeTemplateId) {
        // Not currently open, so no live edits to pull from flat state —
        // just re-send its already-loaded content unchanged (a harmless
        // no-op re-save; see the "populate active template" effect's own
        // comment on why a non-active real template's edits aren't
        // tracked live — that's a separate, pre-existing limitation, not
        // something bulk-save can fix on its own).
        const data = templatesData[t.id]
        if (!data?.content?.sheets?.length) return null
        return {
          isReal: true,
          body: {
            templateId: t.id,
            templateName: data.template.templateName,
            finalName: data.template.finalName,
            description: data.template.description,
            marketplaceName: data.template.marketplaceName,
            category1: data.template.category1, category2: data.template.category2, category3: data.template.category3,
            category4: data.template.category4, category5: data.template.category5, category6: data.template.category6,
            exportVersion: data.template.exportVersion,
            sheets: data.content.sheets,
          },
        }
      }
      const grouped = buildGroupedSheets(mappedHeaders)
      if (grouped.reduce((sum, g) => sum + g.headers.length, 0) === 0) return null
      return {
        isReal: true,
        body: {
          templateId: t.id,
          templateName: composeAutoTemplateName(presetData, categoriesData).trim() || t.templateName,
          finalName: composeFinalName(presetData, categoriesData),
          description: presetData.description,
          marketplaceName: presetData.marketplaceName,
          category1: categoriesData.category1, category2: categoriesData.category2, category3: categoriesData.category3,
          category4: categoriesData.category4, category5: categoriesData.category5, category6: categoriesData.category6,
          exportVersion: presetData.exportVersion,
          sheets: grouped,
        },
      }
    }

    // Fresh upload session — scoped from the shared batch-wide pool
    // (uploadMappedHeaders) down to just this file's own raw headers, same
    // rule the single-file save path already used.
    const session = resolveSessionFields(t.id)
    const scopedMapped = uploadMappedHeaders.filter((m) => m.sheetHeaders.some((sh) => session.rawHeaders.includes(sh)))
    const grouped = buildGroupedSheets(scopedMapped, session.dropdownColumns, session.rawHeaderNotes)
    if (grouped.reduce((sum, g) => sum + g.headers.length, 0) === 0) return null
    const templateName = composeAutoTemplateName(session.presetData, session.categoriesData).trim()
    if (!templateName) return null
    return {
      isReal: false,
      clientId: t.id,
      body: {
        clientId: t.id,
        templateName,
        finalName: composeFinalName(session.presetData, session.categoriesData),
        description: session.presetData.description,
        marketplaceName: session.presetData.marketplaceName,
        category1: session.categoriesData.category1, category2: session.categoriesData.category2, category3: session.categoriesData.category3,
        category4: session.categoriesData.category4, category5: session.categoriesData.category5, category6: session.categoriesData.category6,
        exportVersion: session.presetData.exportVersion,
        sourceFileName: session.fileName || null,
        sourceFileUrl: session.sourceFileUrl || null,
        sourceSheetName: session.sourceFileUrl ? session.dataSheetName : null,
        sheets: grouped.filter((g) => g.headers.length > 0),
        // No separate Validations/Dropdown Reference Sheet — dropdown
        // values were auto-detected off the Product fill sheet's own
        // columns (see the combined extraction effect above).
        dropdownReference: Object.keys(session.dropdownColumns).length
          ? { sheetName: session.dataSheetName || null, columns: Object.fromEntries(Object.entries(session.dropdownColumns).map(([k, v]) => [k, v.values])) }
          : { sheetName: null, columns: {} },
        aiRules: {},
      },
    }
  }

  // Save button — processes the WHOLE working set in one go, not just
  // whichever template is currently open: every uploaded file that has
  // something mapped+placed becomes its own template (bulk-create-template),
  // every already-real template in the set gets re-saved with its current
  // state (bulk-update-template) — both endpoints run their own items
  // through Promise.all server-side, and the two calls themselves run in
  // parallel here too. One item failing never blocks the rest — each
  // comes back as its own ok/error entry. Finishes with a created/updated/
  // failed/skipped summary toast, then redirects back to the template list
  // (which loads fresh from the server on its own, no stale cache to work
  // around) after a beat so the toast is actually readable first.
  async function handleSave() {
    const items = templatesList.map(buildSavePayloadForItem).filter(Boolean)
    const skipped = templatesList.length - items.length
    if (items.length === 0) {
      addToast('Map and place at least one header (in at least one template) before saving.', 'error')
      return
    }
    const toCreate = items.filter((it) => !it.isReal)
    const toUpdate = items.filter((it) => it.isReal)

    setSaving(true)
    setExtraction({ stage: `Saving ${items.length} template${items.length === 1 ? '' : 's'}…`, current: 0, total: items.length })
    try {
      const [createRes, updateRes] = await Promise.all([
        toCreate.length
          ? fetch('/api/listing-tools/bulk-create-template', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ templates: toCreate.map((it) => it.body) }),
            }).then((r) => r.json().catch(() => ({})))
          : Promise.resolve({ results: [] }),
        toUpdate.length
          ? fetch('/api/listing-tools/bulk-update-template', {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ templates: toUpdate.map((it) => it.body) }),
            }).then((r) => r.json().catch(() => ({})))
          : Promise.resolve({ results: [] }),
      ])

      const createdResults = createRes.results || []
      const updatedResults = updateRes.results || []
      const createdCount = createdResults.filter((r) => r.ok).length
      const updatedCount = updatedResults.filter((r) => r.ok).length
      const failedCount = createdResults.length + updatedResults.length - createdCount - updatedCount

      // One version snapshot per successfully saved template — independent
      // per template, cheap enough to fan out with Promise.all rather than
      // needing its own bulk endpoint. Best-effort: a version-recording
      // failure here doesn't undo the save that already succeeded.
      setExtraction({ stage: 'Recording versions…', current: 0, total: createdCount + updatedCount })
      await Promise.all([
        ...createdResults.filter((r) => r.ok).map((r) => {
          const sourceItem = toCreate.find((it) => it.clientId === r.clientId)
          return fetch('/api/listing-tools/versions', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId: r.template.id, snapshot: { sheets: sourceItem?.body.sheets || [] } }),
          }).catch(() => null)
        }),
        ...updatedResults.filter((r) => r.ok).map((r) => {
          const sourceItem = toUpdate.find((it) => it.body.templateId === r.templateId)
          return fetch('/api/listing-tools/versions', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId: r.templateId, snapshot: { sheets: sourceItem?.body.sheets || [] } }),
          }).catch(() => null)
        }),
      ])

      setExtraction({ stage: 'Done', current: items.length, total: items.length })
      setTimeout(() => setExtraction(null), 500)

      if (failedCount > 0) {
        console.error('Bulk save failures:', [...createdResults, ...updatedResults].filter((r) => !r.ok))
      }
      const parts = []
      if (createdCount) parts.push(`${createdCount} created`)
      if (updatedCount) parts.push(`${updatedCount} updated`)
      if (failedCount) parts.push(`${failedCount} failed`)
      if (skipped) parts.push(`${skipped} skipped (nothing mapped)`)
      const summary = parts.length ? `${parts.join(', ')}.` : 'Nothing saved.'
      addToast(summary, createdCount + updatedCount > 0 ? 'success' : 'error')

      if (createdCount + updatedCount > 0) {
        setTimeout(() => { router.push('/listing-tools/template-settings') }, 1000)
      }
    } catch (err) {
      addToast(err.message, 'error')
      setExtraction(null)
    } finally {
      setSaving(false)
    }
  }

  if (templateIds.length > 0 && loadingExisting) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    )
  }
  if (templateIds.length > 0 && loadError) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <p className="text-[14px] font-semibold text-foreground">Couldn&apos;t load those templates.</p>
        <p className="text-[13px] text-subtle mt-1">They may have been deleted, or you don&apos;t have access to them.</p>
        <Link href="/listing-tools/template-settings" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-hover">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Template Settings
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto px-6 py-8 space-y-4">
      

      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-row gap-1.5">
          <Link href="/listing-tools/template-settings" className="inline-flex items-center border rounded p-2 gap-1.5 text-[12.5px] font-medium text-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> 
      </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-foreground">{isEditMode ? 'Edit Bulk Listing' : 'Create Bulk Listing'}</h1>
          <p className="text-[13px] text-subtle mt-0.5 hidden">
            Upload a sheet, map its headers onto your global header dictionary (by hand or with a saved rule), place them into a group, then save.
          </p>
        </div>
        </div>
      
        <div className="flex flex-wrap items-center gap-2">
          <SourceFileUploadControl fileName={fileName} parsing={parsing} onPick={handleFiles} onClear={confirmClearUpload} label="Upload Bulk Sheet" multiple tone="green" />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            title="Saves every template in the working set at once — not just whichever one is open right now"
            className="flex items-center gap-1.5 rounded-full bg-[#ec1e63] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-60 hover:bg-[#c91753]"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
            Save All{templatesList.length > 1 ? ` (${templatesList.length})` : ''}
          </button>
        </div>
      </div>


      <div className="flex flex-col gap-4 sm:flex-row">
        <BulkRuleSidebar
          ourHeaders={ourHeaders}
          onCreateHeader={handleCreateHeader}
          onRenameHeader={handleRenameHeader}
          onDeleteHeader={handleDeleteHeader}
          onDeleteAllHeaders={handleDeleteAllHeaders}
          creatingHeader={creatingHeader}
          onOpenHeaderSettings={setHeaderSettingsId}
          templates={templatesList}
          activeTemplateId={activeTemplateId}
          onSelectTemplate={handleSelectWorkItem}
          uploadedFiles={uploadedFiles}
          onClearUpload={handleClearUpload}
          selectedMarketplace={selectedMarketplace}
          onSelectMarketplace={handleSelectMarketplace}
          onApplyMappingPreset={applyMappingItem}
          onApplyMappingRule={applyMappingItem}
          onApplyPlacePreset={applyPlaceItem}
          onApplyPlaceRule={applyPlaceItem}
          onSaveMappingPreset={(name) => saveMappingAs('preset', name)}
          onSaveMappingRule={(name) => saveMappingAs('rule', name)}
          onSavePlacePreset={(name) => savePlaceAs('preset', name)}
          onSavePlaceRule={(name) => savePlaceAs('rule', name)}
          ruleNamePrefix={`${(presetData.marketplaceName || 'Marketplace').trim()}_`}
          refreshToken={refreshToken}
          previewRule={previewRule}
          onPreviewMapping={(item) => setPreviewRule((prev) => (prev?.item?.id === item.id ? null : { type: 'mapping', item }))}
          onPreviewPlace={(item) => setPreviewRule((prev) => (prev?.item?.id === item.id ? null : { type: 'place', item }))}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <TemplateNamingFields
            isEditMode={isEditMode}
            presetData={presetData}
            setPresetData={setPresetData}
            categoriesData={categoriesData}
            setCategoriesData={setCategoriesData}
            templateNameInput={templateNameInput}
            setTemplateNameInput={setTemplateNameInput}
            templateNumber={templateNumber}
            currentPreset={null}
            nameAlwaysComposed
          />

          <SheetSelectorFields
            sheetMeta={sheetMeta}
            dataSheetName={dataSheetName}
            onSelectDataSheet={selectDataSheet}
            dataGroupRow={dataGroupRow}
            setDataGroupRow={setDataGroupRow}
            dataHeaderRow={dataHeaderRow}
            setDataHeaderRow={setDataHeaderRow}
            dataIsectionRow={dataIsectionRow}
            setDataIsectionRow={setDataIsectionRow}
            hideDropdownReference
            dropdownDataStartRow={dropdownDataStartRow}
            setDropdownDataStartRow={setDropdownDataStartRow}
          />
          {Object.keys(dropdownColumns).length > 0 && (
            <p className="-mt-2 px-1 text-[12.5px] text-subtle">
              {Object.keys(dropdownColumns).length} column{Object.keys(dropdownColumns).length === 1 ? '' : 's'} auto-detected as dropdowns from this sheet&apos;s own data: {Object.keys(dropdownColumns).join(', ')}
            </p>
          )}

          {sheetsIndex.length >= 2 && (
            <div>
              <h2 className="mb-2 text-[15px] font-semibold text-foreground">Sheets &amp; Headers</h2>
              <SheetHeaderTree marketplaceGroups={marketplaceGroups} />
            </div>
          )}

          <div>
            <h2 className="mb-2 text-[15px] font-semibold text-foreground">Header Mapping</h2>
            {previewRule?.type === 'mapping' && (
              <RulePreviewPanel
                type="mapping"
                rule={previewRule.item}
                ourHeaders={ourHeaders}
                onApply={applyPreviewRule}
                applying={previewApplying}
                onClose={() => setPreviewRule(null)}
              />
            )}
            <BulkMappingGrid
              unmappedRawHeaders={unmappedRawHeaders}
              commonHeaderKeys={commonHeaderInfo.keys}
              ourHeaders={ourHeaders}
              mappedHeaders={activeMapped}
              onMap={handleMap}
              onUnmap={handleUnmap}
              onOpenSettings={setModalId}
              onOpenRawHeaderSettings={openSettingsForRawHeader}
              onOpenOurHeaderSettings={setHeaderSettingsId}
              categoryForOurHeaderId={categoryForOurHeaderId}
              categoryOrder={categoryOrder}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-foreground">Header Place</h2>
              <button
                type="button"
                onClick={autoPlaceHeaders}
                title="Place every mapped-but-unplaced header by default: Image → Images; same name as its raw sheet column → Compulsory; a canonical name you curated yourself → Product Details"
                className="rounded-full border border-divider bg-card px-3 py-1 text-[12px] font-medium text-foreground hover:bg-card-hover"
              >
                Auto-place
              </button>
            </div>
            {previewRule?.type === 'place' && (
              <RulePreviewPanel
                type="place"
                rule={previewRule.item}
                ourHeaders={ourHeaders}
                onApply={applyPreviewRule}
                applying={previewApplying}
                onClose={() => setPreviewRule(null)}
              />
            )}
            <BulkPlaceGrid headers={mappedOnly} onMove={handleMoveHeader} onOpenSettings={setModalId} />
          </div>

          {/* <div>
            <h2 className="mb-2 text-[15px] font-semibold text-foreground">Preview</h2>
            <HeaderBucketPreview headers={previewHeaders} />
          </div> */}

          {/* Save belongs at the END of the flow — sheet selection, mapping
              and placement all happen first; this is the same handleSave
              the top toolbar button calls, just also reachable without
              scrolling back up once everything below is filled in. */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              title="Saves every template in the working set at once — not just whichever one is open right now"
              className="flex items-center gap-1.5 rounded-full bg-[#ec1e63] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-60 hover:bg-[#c91753]"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
              Save All{templatesList.length > 1 ? ` (${templatesList.length})` : ''}
            </button>
          </div>
        </div>
      </div>

      {modalId && (() => {
        const modalHeader = activeMapped.find((m) => m.ourHeaderId === modalId)
        if (!modalHeader) return null
        return (
          <NewDesignColumnModal
            field={{
              id: modalHeader.ourHeaderId,
              label: modalHeader.ourHeaderLabel,
              groupId: modalHeader.group,
              dataType: modalHeader.dataType || 'text',
              dropdownValues: modalHeader.dropdownValues || [],
              formula: modalHeader.formula || '',
              isUniqueKeyPart: !!modalHeader.isUniqueKeyPart,
              disabled: !!modalHeader.disabled,
              linkedHeaderIds: modalHeader.linkedHeaderIds || [],
              linkedHeaderId: modalHeader.linkedHeaderId || null,
            }}
            sections={MODAL_SECTIONS}
            allFields={mappedOnly.map((m) => ({ id: m.ourHeaderId, label: m.ourHeaderLabel, groupId: m.group }))}
            onUpdateField={handleUpdateHeader}
            onClose={() => setModalId(null)}
          />
        )
      })()}

      {headerSettingsId && (() => {
        const settingsHeader = ourHeaders.find((h) => h.id === headerSettingsId)
        if (!settingsHeader) return null
        return (
          <OurHeaderSettingsModal
            header={settingsHeader}
            dropdownValues={ourHeaderDropdownDefaults[headerSettingsId] || []}
            onUpdate={(patch) => handleUpdateOurHeaderSettings(headerSettingsId, patch)}
            onClose={() => setHeaderSettingsId(null)}
          />
        )
      })()}

      <ExtractionProgressModal progress={extraction} />
    </div>
  )
}
