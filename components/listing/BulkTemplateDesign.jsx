'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Bookmark, Check } from 'lucide-react'
import { useToast } from '@/components/admin/Toast'
import { HEADER_ROW_INDEX, GROUP_LABEL_ROW_INDEX, DEFAULT_SHEET_ROWS } from '@/lib/listingSheetLayout'
import TemplateNamingFields, { composeFinalName, composeAutoTemplateName } from './TemplateNamingFields'
import SourceFileUploadControl from './SourceFileUploadControl'
import SheetSelectorFields from './SheetSelectorFields'
import BulkRuleSidebar from './BulkRuleSidebar'
import BulkMappingGrid from './BulkMappingGrid'
import BulkPlaceGrid from './BulkPlaceGrid'
import HeaderBucketPreview from './HeaderBucketPreview'
import ExtractionProgressModal from './ExtractionProgressModal'

const REAL_GROUPS = ['design_system', 'compulsory', 'prefill']
const SHEET_LABELS = { design_system: 'Product details', compulsory: 'Compulsory', prefill: 'Brand Details' }
const DEFAULT_CATEGORIES = { category1: '', category2: '', category3: '', category4: '', category5: '', category6: '' }

function slugify(label) {
  return String(label || 'col').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'col'
}
function yieldToPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
// Deliberately simpler than TemplateSettingsWizard.jsx's splitHeaderCell —
// the bulk flow's whole point is normalizing raw sheet text onto canonical
// Our Headers, so it just needs a clean single-line label, not the full
// instructional-note-splitting logic (nothing downstream reads a
// per-header description here).
function cleanLabel(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim()
}
function isPlaceholderLabel(label) {
  const v = label.trim()
  if (!v) return true
  if (/^\d+$/.test(v)) return true
  return /^(unnamed|__?empty|n\/?a|column|field|header|col|sample|example|test|dummy|placeholder|lorem|xxx|tbd)[\s._:-]*\d*$/i.test(v)
}
function parseRowInput(raw, fallbackIdx) {
  const n = Number(raw)
  if (raw === '' || raw === null || raw === undefined || Number.isNaN(n)) return fallbackIdx
  return Math.max(0, Math.trunc(n) - 1)
}
// Same defaulting logic as TemplateSettingsWizard.jsx's own
// findDropdownHeaderRowIndex/computeDropdownRowDefaults — duplicated (not
// imported) since that file doesn't export them and pulls in a lot of
// unrelated Kanban-era state; kept identical so SheetSelectorFields behaves
// the same in both places (Task: same components/behavior used).
function findDropdownHeaderRowIndex(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 5); i++) {
    const filled = (aoa[i] || []).filter((v) => String(v ?? '').trim() !== '').length
    if (filled >= 2) return i
  }
  return 0
}
function computeDropdownRowDefaults(XLSX, workbook, sheetName) {
  const ws = sheetName ? workbook?.Sheets[sheetName] : null
  if (!ws) return { header: 0, values: 1 }
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const header = findDropdownHeaderRowIndex(aoa)
  return { header, values: header + 1 }
}

// A freshly-uploaded file's own name is usually the best hint for this
// template's categories (e.g. "Meesho_Blouse_Women.xlsx") — split on the
// same underscores the rest of this feature composes names with, drop
// generic/filler tokens that show up in real filenames but say nothing
// about the product, and use what's left to pre-fill Category 1-6. Only
// ever fills currently-EMPTY category slots (see handleFile), never
// overwrites something the user already typed.
const CATEGORY_STOPWORDS = new Set([
  'file', 'files', 'sheet', 'sheets', 'template', 'templates', 'final', 'draft', 'copy',
  'xlsx', 'xls', 'csv', 'fill', 'this', 'data', 'master', 'new', 'old', 'updated',
  'list', 'listing', 'upload', 'uploaded', 'export', 'import', 'v1', 'v2', 'v3',
])
const KNOWN_MARKETPLACES = [
  'Meesho', 'Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Nykaa', 'Tata CLiQ', 'Jiomart', 'eBay', 'Shopify'
]

function extractBrandAndCategories(filename) {
  const base = String(filename || '').replace(/\.[a-z0-9]+$/i, '')
  const tokens = base.split(/[_\-\s]+/).map((t) => t.trim()).filter(Boolean)
  if (tokens.length === 0) return { brand: '', categories: [] }

  let brand = ''
  let catTokens = tokens

  const firstLower = tokens[0].toLowerCase()
  const matched = KNOWN_MARKETPLACES.find((m) => m.toLowerCase() === firstLower)

  if (matched) {
    brand = matched
    catTokens = tokens.slice(1)
  } else if (/^[a-z0-9]+$/i.test(tokens[0])) {
    brand = tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1)
    catTokens = tokens.slice(1)
  }

  const categories = catTokens
    .filter((t) => !CATEGORY_STOPWORDS.has(t.toLowerCase()) && !/^\d+$/.test(t))
    .slice(0, 6)

  return { brand, categories }
}

function deriveCategoriesFromName(name) {
  return extractBrandAndCategories(name).categories
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
      })
    }
  }
  return out
}

function buildGroupedSheets(mappedHeaders) {
  const byGroup = { design_system: [], compulsory: [], prefill: [] }
  for (const m of mappedHeaders) {
    if (!m.group || m.sheetHeaders.length === 0) continue
    byGroup[m.group]?.push(m)
  }
  return REAL_GROUPS.map((g, i) => {
    const headers = byGroup[g]
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((m, idx) => ({
        id: m.existingId || `hdr_${slugify(m.ourHeaderLabel)}_${idx}_${Date.now()}`,
        label: m.ourHeaderLabel,
        description: '',
        order: idx,
        group: g,
        dataType: m.dataType || 'text',
        isUniqueKeyPart: !!m.isUniqueKeyPart,
        sourceColIndex: undefined,
        linkedGroup: null,
        linkedHeaderId: null,
        linkedHeaderIds: [],
        uiBucket: null,
        formula: '',
        disabled: false,
        source: 'upload',
        dropdownSource: null,
      }))

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

// The bulk mapping flow — a multi-template workspace: `templateIds` (from
// the list page's "Edit Bulk Listing" toolbar button, enabled once 2+
// templates are checkbox-selected there) are all loaded up front; the
// sidebar's Templates section lets you switch which ONE is being edited on
// the right (single-select — the naming fields, sheet selectors, mapping/
// placement grids and preview all reset to whichever is active). Map its
// raw headers onto the global "Our Headers" dictionary (by hand or via a
// saved Mapping Rule), place each into a group/position (by hand or via a
// saved Place Rule), watch it land in the live preview, then save — which
// also bumps a template version + writes a log row, both living in the
// hub (see lib/listingMappingProxy.js). With no templateIds at all this is
// a plain Create Bulk Listing for one brand-new template, and the sidebar
// stays hidden until something exists to show in it.
export default function BulkTemplateDesign({ templateIds = [] }) {
  const { addToast } = useToast()

  const [templatesData, setTemplatesData] = useState({}) // { [id]: {template, content} }
  const [templatesList, setTemplatesList] = useState([]) // [{id, templateName}]
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const isEditMode = !!activeTemplateId

  const [loadingExisting, setLoadingExisting] = useState(templateIds.length > 0)
  const [loadError, setLoadError] = useState(false)

  const [selectedMarketplace, setSelectedMarketplace] = useState('All')
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
  const [dropdownSheetName, setDropdownSheetName] = useState('')
  const [dataGroupRow, setDataGroupRow] = useState('')
  const [dataHeaderRow, setDataHeaderRow] = useState('')
  const [dropdownHeaderRow, setDropdownHeaderRow] = useState('')
  const [dropdownValuesRow, setDropdownValuesRow] = useState('')
  const [parsing, setParsing] = useState(false)
  const [extraction, setExtraction] = useState(null)
  const [sourceFileUrl, setSourceFileUrl] = useState('')
  const [rawHeaders, setRawHeaders] = useState([])

  const [ourHeaders, setOurHeaders] = useState([])
  const [creatingHeader, setCreatingHeader] = useState(false)
  const [mappedHeaders, setMappedHeaders] = useState([]) // [{ourHeaderId, ourHeaderLabel, dataType, isUniqueKeyPart, sheetHeaders, group, position, existingId?}]
  const [refreshToken, setRefreshToken] = useState(0)

  const [saving, setSaving] = useState(false)
  const [savedTemplate, setSavedTemplate] = useState(null)

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
      setDropdownSheetName('')
      setDataGroupRow('')
      setDataHeaderRow('')
      setDropdownHeaderRow('')
      setDropdownValuesRow('')
      setSourceFileUrl('')
      setRawHeaders([])
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
  // shared by both the filename-derived and header-derived sources, so
  // calling both in sequence (filename first) lets the filename's guess win
  // and header keywords just top up whatever's still blank.
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
  function applyDerivedCategories(name) {
    const { brand, categories } = extractBrandAndCategories(name)
    if (brand && !isEditMode) {
      setPresetData((prev) => ({ ...prev, marketplaceName: brand }))
      setSelectedMarketplace(brand)
    }
    fillEmptyCategories(categories)
  }
  function applyDerivedCategoriesFromHeaders(headers) {
    fillEmptyCategories(deriveCategoriesFromHeaders(headers))
  }

  // One file → the full single-workbook flow: pick Product fill sheet /
  // Dropdowns Reference Sheet, adjust row indices, then the extraction
  // effect below reads headers off whichever sheet is chosen.
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
    const firstSheetName = wb.SheetNames[0] || ''
    const dataGuess = wb.SheetNames.find((n) => /fill|master|product|template/i.test(n)) || firstSheetName
    const validationGuess = wb.SheetNames.find((n) => n !== dataGuess && /drop.?down|valid|reference|option|list/i.test(n)) || (wb.SheetNames[1] && wb.SheetNames[1] !== dataGuess ? wb.SheetNames[1] : '')
    const nextDataSheetName = dataGuess || firstSheetName
    const dropdownDefaults = computeDropdownRowDefaults(XLSX, wb, validationGuess)
    setWorkbook(wb)
    setFileName(file.name)
    setUploadedFiles([{ name: file.name, sheets: meta.map((m) => m.name) }])
    if (!isEditMode) {
      setTemplatesList([{ id: `file_${Date.now()}`, templateName: file.name, finalName: file.name }])
    }
    setSheetMeta(meta)
    setDataSheetName(nextDataSheetName)
    setDropdownSheetName(validationGuess || '')
    setDataGroupRow(nextDataSheetName ? DEFAULT_SHEET_ROWS.GROUP_ROW : '')
    setDataHeaderRow(nextDataSheetName ? DEFAULT_SHEET_ROWS.HEADER_ROW : '')
    setDropdownHeaderRow(validationGuess ? (dropdownDefaults.header + 1 || DEFAULT_SHEET_ROWS.DROPDOWN_HEADER_ROW) : '')
    setDropdownValuesRow(validationGuess ? (dropdownDefaults.values + 1 || DEFAULT_SHEET_ROWS.DROPDOWN_VALUES_ROW) : '')
    setSourceFileUrl('')
    applyDerivedCategories(file.name)
    if (!nextDataSheetName) setExtraction(null)
    if (/\.xlsx$/i.test(file.name)) uploadSourceFile(file)
  }

  // Several files at once — there's no single workbook to run the sheet-
  // selector UI against, so each file's own best-guess data sheet is read
  // straight off (default header row, no per-file row-index tuning) and
  // every file's cleaned/deduped headers are unioned into one rawHeaders
  // pool for mapping. No single sourceFileUrl to store either.
  async function handleMultipleFiles(files) {
    setWorkbook(null)
    setSheetMeta([])
    setDataSheetName('')
    setDropdownSheetName('')
    setSourceFileUrl('')
    setFileName(files.map((f) => f.name).join(', '))
    const XLSX = await import('xlsx')
    const seen = new Set()
    const out = []
    const fileInfos = []
    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi]
      setExtraction({ stage: `Extracting headers from file ${fi + 1} of ${files.length}…`, current: fi, total: files.length })
      await yieldToPaint()
      try {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        fileInfos.push({ name: file.name, sheets: wb.SheetNames })
        const dataGuess = wb.SheetNames.find((n) => /fill|master|product|template/i.test(n)) || wb.SheetNames[0]
        if (!dataGuess) continue
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[dataGuess], { header: 1 })
        const rawRow = aoa[HEADER_ROW_INDEX] || []
        for (const raw of rawRow) {
          const label = cleanLabel(raw)
          if (!label || isPlaceholderLabel(label)) continue
          const key = label.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          out.push(label)
        }
      } catch {
        addToast(`Could not read "${file.name}" — skipped.`, 'error')
      }
    }
    setUploadedFiles(fileInfos)
    if (!isEditMode) {
      setTemplatesList(files.map((f, i) => ({ id: `file_${Date.now()}_${i}`, templateName: f.name, finalName: f.name })))
    }
    setRawHeaders(out)
    applyDerivedCategories(files[0].name)
    applyDerivedCategoriesFromHeaders(out)
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

  async function uploadSourceFile(file) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/listing-tools/source-file', { method: 'POST', body: formData })
      const data = await res.json().catch(() => null)
      if (res.status === 401) return
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Upload failed')
      setSourceFileUrl(data.url)
    } catch {
      addToast("Couldn't save the original bulk sheet — this won't affect mapping/saving the template.", 'error')
    }
  }

  function handleClearUpload() {
    if (!window.confirm('Remove the uploaded sheet? Already-mapped headers stay as they are.')) return
    setWorkbook(null)
    setFileName('')
    setUploadedFiles([])
    if (!isEditMode) {
      setTemplatesList([])
    }
    setSheetMeta([])
    setDataSheetName('')
    setDropdownSheetName('')
    setDataGroupRow('')
    setDataHeaderRow('')
    setDropdownHeaderRow('')
    setDropdownValuesRow('')
    setRawHeaders([])
  }

  // Section 2's two sheet <select>s — same reset-on-pick behavior as
  // TemplateSettingsWizard.jsx's own selectDataSheet/selectDropdownSheet.
  function selectDataSheet(val) {
    setDataSheetName(val)
    setDataGroupRow(val ? DEFAULT_SHEET_ROWS.GROUP_ROW : '')
    setDataHeaderRow(val ? DEFAULT_SHEET_ROWS.HEADER_ROW : '')
  }
  function selectDropdownSheet(val) {
    setDropdownSheetName(val)
    if (!val || !workbook) {
      setDropdownHeaderRow(val ? DEFAULT_SHEET_ROWS.DROPDOWN_HEADER_ROW : '')
      setDropdownValuesRow(val ? DEFAULT_SHEET_ROWS.DROPDOWN_VALUES_ROW : '')
      return
    }
    import('xlsx').then((XLSX) => {
      const { header, values } = computeDropdownRowDefaults(XLSX, workbook, val)
      setDropdownHeaderRow(header + 1 || DEFAULT_SHEET_ROWS.DROPDOWN_HEADER_ROW)
      setDropdownValuesRow(values + 1 || DEFAULT_SHEET_ROWS.DROPDOWN_VALUES_ROW)
    })
  }

  // Extracts the raw header row once a sheet is picked — same shape as
  // TemplateSettingsWizard.jsx's rebuild effect, reporting live progress,
  // but deliberately simpler (see cleanLabel's own comment).
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
      const rawRow = aoa[headerRowIdx] || []
      const seen = new Set()
      const out = []
      const total = rawRow.length
      for (let i = 0; i < total; i++) {
        setExtraction({ stage: 'Extracting headers…', current: i + 1, total })
        if (i > 0 && i % 12 === 0) await yieldToPaint()
        const label = cleanLabel(rawRow[i])
        if (!label || isPlaceholderLabel(label)) continue
        const key = label.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(label)
      }
      if (cancelled) return
      setRawHeaders(out)
      applyDerivedCategoriesFromHeaders(out)
      setExtraction({ stage: 'Done', current: out.length, total: out.length })
      setTimeout(() => { if (!cancelled) setExtraction(null) }, 500)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyDerivedCategoriesFromHeaders is a plain closure recreated every render; only workbook/dataSheetName/dataHeaderRow should trigger a re-extraction.
  }, [workbook, dataSheetName, dataHeaderRow])

  const unmappedRawHeaders = rawHeaders.filter((h) => !mappedHeaders.some((m) => m.sheetHeaders.includes(h)))
  const mappedOnly = mappedHeaders.filter((m) => m.sheetHeaders.length > 0)
  const previewHeaders = mappedOnly.map((m) => ({ id: m.ourHeaderId, label: m.ourHeaderLabel, group: m.group }))

  function handleMap(sheetHeader, ourHeaderId) {
    const oh = ourHeaders.find((h) => h.id === ourHeaderId)
    if (!oh) return
    setMappedHeaders((prev) => {
      const existing = prev.find((m) => m.ourHeaderId === ourHeaderId)
      if (existing) {
        return prev.map((m) => (m.ourHeaderId === ourHeaderId
          ? { ...m, sheetHeaders: [...new Set([...m.sheetHeaders, sheetHeader])] }
          : m))
      }
      return [...prev, {
        ourHeaderId,
        ourHeaderLabel: oh.label,
        dataType: oh.dataType,
        isUniqueKeyPart: !!oh.isUniqueKeyPart,
        sheetHeaders: [sheetHeader],
        group: null,
        position: 0,
      }]
    })
  }
  function handleUnmap(sheetHeader, ourHeaderId) {
    setMappedHeaders((prev) => prev.map((m) => (m.ourHeaderId === ourHeaderId
      ? { ...m, sheetHeaders: m.sheetHeaders.filter((s) => s !== sheetHeader) }
      : m)))
  }
  function handlePlace(ourHeaderId, group) {
    setMappedHeaders((prev) => {
      const nextPos = prev.filter((m) => m.group === group).length
      return prev.map((m) => (m.ourHeaderId === ourHeaderId ? { ...m, group, position: nextPos } : m))
    })
  }
  function handleUnplace(ourHeaderId) {
    setMappedHeaders((prev) => prev.map((m) => (m.ourHeaderId === ourHeaderId ? { ...m, group: null } : m)))
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
  async function handleDeleteHeader(id) {
    try {
      const res = await fetch(`/api/listing-tools/mapping/headers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Delete failed')
      setOurHeaders((prev) => prev.filter((h) => h.id !== id))
    } catch (err) {
      addToast(err.message, 'error')
    }
  }
  async function handleDeleteAllHeaders() {
    if (ourHeaders.length === 0) return
    if (!window.confirm(`Delete all ${ourHeaders.length} header(s) in Our Headers? This can't be undone.`)) return
    for (const h of ourHeaders) {
      try {
        await fetch(`/api/listing-tools/mapping/headers/${h.id}`, { method: 'DELETE' })
      } catch { /* best-effort, continue deleting the rest */ }
    }
    setOurHeaders([])
  }

  // Adds an already-existing template (picked from the Templates section's
  // "+" search) into the current working set — same per-id fetch the
  // initial ?templates= load uses, just for one id at a time.
  async function handleAddTemplate(id) {
    if (templatesData[id]) { setActiveTemplateId(id); return }
    try {
      const res = await fetch(`/api/listing-tools/${id}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.template || !data?.content) throw new Error('Could not load that template')
      setTemplatesData((prev) => ({ ...prev, [id]: data }))
      setTemplatesList((prev) => (prev.some((t) => t.id === id) ? prev : [...prev, {
        id,
        templateName: data.template.templateName,
        finalName: composeFinalName(data.template, {
          category1: data.template.category1 || '', category2: data.template.category2 || '',
          category3: data.template.category3 || '', category4: data.template.category4 || '',
          category5: data.template.category5 || '', category6: data.template.category6 || '',
        }),
      }]))
      setActiveTemplateId(id)
    } catch (err) {
      addToast(err.message, 'error')
    }
  }
  // Clears the working set (Templates sidebar list) — never deletes the
  // real templates, just stops editing them here.
  function handleClearTemplates() {
    if (templatesList.length === 0) return
    if (!window.confirm('Remove every template from this working set? Nothing is deleted — you can re-select them from the list page.')) return
    setTemplatesList([])
    setTemplatesData({})
    setActiveTemplateId(null)
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
      setMappedHeaders((prev) => prev.map((m) => {
        const hit = data.placed.find((p) => p.ourHeaderId === m.ourHeaderId)
        return hit ? { ...m, group: hit.group, position: hit.position } : m
      }))
      addToast(`Placed ${data.placed.length} header(s).`, 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  async function saveMappingAs(kind) {
    const label = kind === 'preset' ? 'Header Mapping' : 'Mapping Rule'
    const name = window.prompt(`Name this ${label}:`)
    if (!name?.trim()) return
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
  async function savePlaceAs(kind) {
    const label = kind === 'preset' ? 'Header Place' : 'Place Rule'
    const name = window.prompt(`Name this ${label}:`)
    if (!name?.trim()) return
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

  async function handleSave() {
    const finalNameToSave = composeFinalName(presetData, categoriesData)
    const templateNameToSave = (isEditMode ? templateNameInput : composeAutoTemplateName(presetData, categoriesData)).trim()
    if (!templateNameToSave) {
      addToast('Enter a Marketplace Name and Category 6 (or a Template Name in edit mode) before saving.', 'error')
      return
    }
    const allGrouped = buildGroupedSheets(mappedHeaders)
    const totalHeaders = allGrouped.reduce((sum, g) => sum + g.headers.length, 0)
    if (totalHeaders === 0) {
      addToast('Map and place at least one header before saving.', 'error')
      return
    }
    setSaving(true)
    setExtraction({ stage: isEditMode ? 'Saving changes…' : 'Creating template…', current: 0, total: 0 })
    try {
      const body = {
        templateName: templateNameToSave,
        finalName: finalNameToSave,
        description: presetData.description,
        marketplaceName: presetData.marketplaceName,
        category1: categoriesData.category1, category2: categoriesData.category2, category3: categoriesData.category3,
        category4: categoriesData.category4, category5: categoriesData.category5, category6: categoriesData.category6,
        exportVersion: presetData.exportVersion,
      }
      let res
      if (isEditMode) {
        res = await fetch(`/api/listing-tools/${activeTemplateId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, sheets: allGrouped }),
        })
      } else {
        res = await fetch('/api/listing-tools', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            sourceFileName: fileName || null,
            sourceFileUrl: sourceFileUrl || null,
            sourceSheetName: sourceFileUrl ? dataSheetName : null,
            sheets: allGrouped.filter((g) => g.headers.length > 0),
            dropdownReference: { sheetName: null, columns: {} },
            aiRules: {},
          }),
        })
      }
      const data = await res.json().catch(() => null)
      if (res.status === 401) return
      if (!res.ok) throw new Error(data?.error || `Failed to save template (${res.status})`)
      const savedId = isEditMode ? activeTemplateId : data.template.id
      const savedName = data.template?.templateName || templateNameToSave

      setExtraction({ stage: 'Recording version…', current: 0, total: 0 })
      const versionRes = await fetch('/api/listing-tools/versions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: savedId, snapshot: { sheets: allGrouped } }),
      })
      const versionData = await versionRes.json().catch(() => null)

      setExtraction({ stage: 'Done', current: 1, total: 1 })
      setTimeout(() => setExtraction(null), 500)
      addToast(isEditMode ? 'Template updated.' : 'Template created.', 'success')
      setSavedTemplate({ id: savedId, templateName: savedName, version: versionData?.version })

      // Newly created (or renamed) — reflect it in the Templates sidebar and
      // switch into editing it in place, instead of navigating to a
      // separate per-template route.
      setTemplatesList((prev) => {
        const savedFinalName = composeFinalName(presetData, categoriesData)
        const exists = prev.some((t) => t.id === savedId)
        return exists
          ? prev.map((t) => (t.id === savedId ? { ...t, templateName: savedName, finalName: savedFinalName } : t))
          : [...prev, { id: savedId, templateName: savedName, finalName: savedFinalName }]
      })
      setTemplatesData((prev) => ({
        ...prev,
        [savedId]: { template: { ...(prev[savedId]?.template || {}), ...data.template, id: savedId }, content: { sheets: allGrouped } },
      }))
      if (!isEditMode) setActiveTemplateId(savedId)
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
          <SourceFileUploadControl fileName={fileName} parsing={parsing} onPick={handleFiles} onClear={handleClearUpload} label="Upload Bulk Sheet" multiple tone="green" />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full bg-[#ec1e63] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-60 hover:bg-[#c91753]"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
            {isEditMode ? 'Save Changes' : 'Save to template'}
          </button>
        </div>
      </div>

      {savedTemplate && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700">
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            &ldquo;{savedTemplate.templateName}&rdquo; saved{savedTemplate.version ? ` — ${savedTemplate.version.label}` : ''}.
          </span>
          <Link href="/listing-tools/template-settings" className="font-semibold hover:underline">Back to Template Settings</Link>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <BulkRuleSidebar
          ourHeaders={ourHeaders}
          onCreateHeader={handleCreateHeader}
          onRenameHeader={handleRenameHeader}
          onDeleteHeader={handleDeleteHeader}
          onDeleteAllHeaders={handleDeleteAllHeaders}
          creatingHeader={creatingHeader}
          templates={templatesList}
          activeTemplateId={activeTemplateId}
          onSelectTemplate={setActiveTemplateId}
          uploadedFiles={uploadedFiles}
          onClearUpload={handleClearUpload}
          selectedMarketplace={selectedMarketplace}
          onSelectMarketplace={handleSelectMarketplace}
          onApplyMappingPreset={applyMappingItem}
          onApplyMappingRule={applyMappingItem}
          onApplyPlacePreset={applyPlaceItem}
          onApplyPlaceRule={applyPlaceItem}
          onSaveMappingPreset={() => saveMappingAs('preset')}
          onSaveMappingRule={() => saveMappingAs('rule')}
          onSavePlacePreset={() => savePlaceAs('preset')}
          onSavePlaceRule={() => savePlaceAs('rule')}
          refreshToken={refreshToken}
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
          />

          <SheetSelectorFields
            sheetMeta={sheetMeta}
            dataSheetName={dataSheetName}
            onSelectDataSheet={selectDataSheet}
            dataGroupRow={dataGroupRow}
            setDataGroupRow={setDataGroupRow}
            dataHeaderRow={dataHeaderRow}
            setDataHeaderRow={setDataHeaderRow}
            dropdownSheetName={dropdownSheetName}
            onSelectDropdownSheet={selectDropdownSheet}
            dropdownHeaderRow={dropdownHeaderRow}
            setDropdownHeaderRow={setDropdownHeaderRow}
            dropdownValuesRow={dropdownValuesRow}
            setDropdownValuesRow={setDropdownValuesRow}
          />

          <div>
            <h2 className="mb-2 text-[15px] font-semibold text-foreground">Header Mapping</h2>
            <BulkMappingGrid unmappedRawHeaders={unmappedRawHeaders} ourHeaders={ourHeaders} mappedHeaders={mappedHeaders} onMap={handleMap} onUnmap={handleUnmap} />
          </div>

          <div>
            <h2 className="mb-2 text-[15px] font-semibold text-foreground">Header Place</h2>
            <BulkPlaceGrid headers={mappedOnly} onPlace={handlePlace} onUnplace={handleUnplace} />
          </div>

          <div>
            <h2 className="mb-2 text-[15px] font-semibold text-foreground">Preview</h2>
            <HeaderBucketPreview headers={previewHeaders} />
          </div>
        </div>
      </div>

      <ExtractionProgressModal progress={extraction} />
    </div>
  )
}
