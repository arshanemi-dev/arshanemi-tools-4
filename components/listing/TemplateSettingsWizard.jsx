'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UploadCloud, FileSpreadsheet, Loader2, Check, Lock, PlusCircle, ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/admin/Toast'
import PillButton from './PillButton'
import GroupTabsStep, { UNMAPPED_TAB_ID } from './GroupTabsStep'
import PresetExportSection from './PresetExportSection'
import AiRulesSection from './AiRulesSection'

// Same 4 groups every other Listing Tools screen renders against (see
// SheetTabs.jsx's TABS / lib/listingTemplates.js GROUPS) — kept as its own
// local constant, same as SheetTabs.jsx does, rather than importing
// lib/listingTemplates.js: that module pulls in blobStore.js's server-only
// Vercel Blob access, which has no place in a client bundle.
const GROUPS = [
  { id: 'design_system', label: 'Design Details' },
  { id: 'compulsory', label: 'Compulsory' },
  { id: 'prefill', label: 'Prefill' },
  { id: 'optional', label: 'Optional' },
]

// Kanban columns shown in Section 3 — "Unselected" holds every header until
// it's moved into one of the 4 real groups. Only those 4 are real columns:
// the backend (lib/listingTemplates.js GROUPS, the sheets/[group] API route)
// only ever reads/writes those 4 group ids, so GroupTabsStep's "+ Add
// Column" custom-group button stays off here — a custom column's fields
// would just be silently dropped on save. Column *labels* can still be
// renamed freely (source/11.html's click-to-rename) — see tabLabels below,
// which only overrides the display name, never the underlying group id.
const TABS = [{ id: UNMAPPED_TAB_ID, label: 'Unselected' }, ...GROUPS]

const DEFAULT_PRESET = { marketplaceName: 'Meesho', category: '', exportVersion: 'v1.0' }
const DEFAULT_AI_RULES = { marketplace: '', category: '', title: '', description: '', keyword: '', otherRules: '' }

function slugify(label) {
  return String(label || 'col').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'col'
}
function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
function detectDataType(label) {
  return /image|photo|img/i.test(label || '') ? 'image' : 'text'
}
function guessIsValidationSheet(name) {
  return /drop.?down|valid|reference|option|list/i.test(name)
}
// Some sheets carry auto-generated or leftover filler columns — "Column1",
// "Header 2", "Unnamed: 3", a lone "N/A" — that aren't real fields to map,
// just spreadsheet noise. Anchored to the whole label (not just a
// substring) so a genuine header like "Header Size" or "Field Notes" still
// comes through — only a label that's *just* one of these words, optionally
// with a trailing number, gets dropped.
function isPlaceholderHeader(label) {
  return /^(unnamed|n\/?a|column|field|header|col)[\s._:-]*\d*$/i.test(label)
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

// Real templates often carry one or more rows above the real header row: a
// title (a single merged cell spanning the sheet — merges only populate
// their top-left cell in the raw data, so that row can look like it has
// just 1 column) and/or a group-label row (e.g. "Compulsory" merged or
// repeated across a span of columns). Counting non-empty cells alone can
// still pick a group-label row by mistake if its labels are repeated per
// column rather than merged (so it "looks" just as full as the real header
// row) — counting DISTINCT non-empty values instead fixes that, since a
// group-label row only ever has a handful of distinct values (one per
// group) while the real header row's column names are all different.
function findHeaderRowIndex(aoa, maxScan = 20) {
  let bestIdx = 0
  let bestCount = -1
  const scanLimit = Math.min(aoa.length, maxScan)
  for (let i = 0; i < scanLimit; i++) {
    const row = aoa[i] || []
    const values = row.map((v) => String(v ?? '').trim()).filter(Boolean)
    const distinctCount = new Set(values.map((v) => v.toLowerCase())).size
    if (distinctCount > bestCount) {
      bestCount = distinctCount
      bestIdx = i
    }
  }
  return bestIdx
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

// Section 2 is now a single Product Data Sheet + a single (optional)
// Dropdown Reference Sheet, matching source/11.html exactly — no more
// multi-sheet checkbox selection.
function buildDropdownColumns(XLSX, workbook, dropdownSheetName) {
  const out = {}
  if (!dropdownSheetName) return out
  const ws = workbook.Sheets[dropdownSheetName]
  if (!ws) return out
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (!aoa.length) return out
  const headerRowIdx = findHeaderRowIndex(aoa)
  const headerRow = (aoa[headerRowIdx] || []).map((v) => String(v ?? '').trim())
  const dataRows = aoa.slice(headerRowIdx + 1)
  headerRow.forEach((col, colIdx) => {
    if (!col) return
    const values = [...new Set(dataRows.map((r) => r[colIdx]).filter((v) => v !== undefined && v !== null && String(v).trim() !== '').map(String))]
    if (values.length) out[col] = { sheetName: dropdownSheetName, columnName: col, values }
  })
  return out
}

function buildFields(XLSX, workbook, dataSheetName, dropdownColumns) {
  const fields = []
  if (!dataSheetName) return fields
  const ws = workbook.Sheets[dataSheetName]
  if (!ws) return fields
  const dropdownNames = Object.keys(dropdownColumns)
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
  const headerRowIdx = findHeaderRowIndex(aoa)
  const rawHeaderRow = aoa[headerRowIdx] || []

  // The row directly above the real header row is often a group-label row
  // (e.g. "Compulsory" spanning several columns) — forward-fill it and
  // fuzzy-match each column's label to one of the 4 real groups, so headers
  // land pre-sorted on the Kanban board instead of all starting Unselected.
  // Falls back to Unselected wherever there's no row above, or no match —
  // safe no-op for simple sheets that don't have a group-label row at all.
  const groupRowIdx = headerRowIdx - 1
  const groupRow = groupRowIdx >= 0 ? forwardFillRow(aoa[groupRowIdx] || [], rawHeaderRow.length) : []

  const seen = new Set()
  let counter = 0
  rawHeaderRow.forEach((rawLabel, colIdx) => {
    const label = String(rawLabel ?? '').trim()
    if (!label) return
    if (isPlaceholderHeader(label)) return
    const key = label.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    counter += 1
    const dropdownMatch = autoMatchDropdown(label, dropdownNames)
    const groupId = matchGroupLabel(groupRow[colIdx]) || UNMAPPED_TAB_ID
    // Once a header's group is known, a couple of labels are unique-key
    // material by convention: "Design Number" under Design Details, "Brand
    // Name" under Prefill — auto-check Unique key part for those instead of
    // making the user open Advanced Settings every time.
    const isUniqueKeyPart = (groupId === 'design_system' && /design|number/i.test(label))
      || (groupId === 'prefill' && /brand/i.test(label))
    fields.push({
      id: `hdr_${slugify(label)}_${counter}`,
      label,
      groupId,
      dataType: dropdownMatch ? 'dropdown' : detectDataType(label),
      dropdownColumn: dropdownMatch || '',
      // The field's own editable copy of the option list — seeded from the
      // matched column so it shows real values immediately, but from here
      // on it's independent per field (adding/removing a value on one
      // header never touches another header sharing the same source column).
      dropdownValues: dropdownMatch ? [...(dropdownColumns[dropdownMatch]?.values || [])] : [],
      isUniqueKeyPart,
    })
  })
  return fields
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
        groupId: h.group || sheet.group,
        dataType: h.dataType || 'text',
        dropdownColumn: h.dropdownSource?.columnName || '',
        dropdownValues: h.dropdownSource?.values ? [...h.dropdownSource.values] : [],
        // No live dropdownColumns map exists in edit mode (no sheet was
        // just parsed) — keep the original source sheet name so a re-save
        // doesn't drop it from dropdownSource.
        dropdownSheetName: h.dropdownSource?.sheetName || null,
        isUniqueKeyPart: !!h.isUniqueKeyPart,
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

// Small "step not ready yet" note shown above a dimmed section — every
// section on this page always renders (per product direction: show the
// whole flow up front), so the signal that a step isn't usable yet is this
// note + reduced opacity/pointer-events, not the section disappearing.
function LockedNote({ children }) {
  return (
    <p className="mb-3 flex items-center gap-1.5 text-[11.5px] text-gray-400">
      <Lock className="w-3 h-3" /> {children}
    </p>
  )
}

// Single-page template creation/edit flow. Create mode: upload → pick the
// Product Data Sheet (+ optional Dropdown Reference Sheet) → group the
// resulting fields on a Kanban board → configure export preset + AI rules →
// save (POST, creates a new template). Edit mode (templateId passed in from
// app/listing-tools/template-settings/[templateId]/page.js): loads the
// existing template's headers/groups/preset/AI rules straight onto the same
// Kanban board — Sections 1-2 (upload/pick sheet) don't apply since there's
// no file to re-parse — and Save PATCHes the existing template in place,
// never touching the row data those headers describe (see the PATCH
// route's own comment on that).
export default function TemplateSettingsWizard({ templateId }) {
  const { addToast } = useToast()
  const isEditMode = !!templateId

  const [fileName, setFileName] = useState('')
  const [workbook, setWorkbook] = useState(null)
  const [sheetMeta, setSheetMeta] = useState([]) // [{name,colCount,rowCount}]
  const [dataSheetName, setDataSheetName] = useState('')
  const [dropdownSheetName, setDropdownSheetName] = useState('')
  const [parsing, setParsing] = useState(false)

  const [showGroups, setShowGroups] = useState(false)
  const [fields, setFields] = useState([])
  const [dropdownColumns, setDropdownColumns] = useState({})
  const [bulkTargetId, setBulkTargetId] = useState(UNMAPPED_TAB_ID)
  const [tabLabels, setTabLabels] = useState({}) // { [groupId]: customLabel } — display-only, see TABS comment

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
        setPresetData({
          marketplaceName: data.template.marketplaceName || '',
          category: data.template.category || '',
          exportVersion: data.template.exportVersion || '',
        })
        setAiRulesData({
          marketplace: data.template.marketplaceName || '',
          category: data.template.category || '',
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
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const meta = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name]
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const headerRowIdx = findHeaderRowIndex(aoa)
        const colCount = (aoa[headerRowIdx] || []).filter((v) => String(v ?? '').trim() !== '').length
        return { name, colCount, rowCount: Math.max(aoa.length - headerRowIdx - 1, 0) }
      })
      // Defaults mirror source/11.html: sheet 1 is the data sheet, sheet 2
      // the dropdown reference — but prefer sheets whose names actually look
      // the part (e.g. "Blouses-Fill this" for data, "Validation Sheet" for
      // dropdowns) over blindly trusting sheet order.
      const dataGuess = wb.SheetNames.find(guessIsDataSheet)
      const nextDataSheetName = dataGuess || wb.SheetNames[0] || ''
      const validationGuess = wb.SheetNames.find((n) => n !== nextDataSheetName && guessIsValidationSheet(n))
      const nextDropdownSheetName = validationGuess || wb.SheetNames.find((n) => n !== nextDataSheetName) || ''
      setWorkbook(wb)
      setFileName(file.name)
      setSheetMeta(meta)
      setDataSheetName(nextDataSheetName)
      setDropdownSheetName(nextDropdownSheetName)
      setShowGroups(false)
      setFields([])
      setDropdownColumns({})
      setSavedTemplate(null)
    } catch (err) {
      addToast('Could not read that file — is it a valid .xlsx?', 'error')
    } finally {
      setParsing(false)
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
    import('xlsx').then((XLSX) => {
      if (cancelled) return
      const cols = buildDropdownColumns(XLSX, workbook, dropdownSheetName)
      const built = buildFields(XLSX, workbook, dataSheetName, cols)
      setDropdownColumns(cols)
      setFields(built)
      setShowGroups(true)
      setBulkTargetId(UNMAPPED_TAB_ID)
    })
    return () => { cancelled = true }
  }, [workbook, dataSheetName, dropdownSheetName])

  function updateField(id, patch) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  function bulkAssignFields(ids, groupId) {
    setFields((prev) => prev.map((f) => (ids.includes(f.id) ? { ...f, groupId } : f)))
  }
  function renameTab(id, label) {
    setTabLabels((prev) => ({ ...prev, [id]: label }))
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
      category: preset.category,
      exportVersion: preset.exportVersion,
    })
  }

  function resetWizard() {
    setFileName('')
    setWorkbook(null)
    setSheetMeta([])
    setDataSheetName('')
    setDropdownSheetName('')
    setShowGroups(false)
    setFields([])
    setDropdownColumns({})
    setBulkTargetId(UNMAPPED_TAB_ID)
    setTabLabels({})
    setPresetData(DEFAULT_PRESET)
    setCurrentPreset(null)
    setAiRulesData(DEFAULT_AI_RULES)
    setSavedTemplate(null)
  }

  async function handleSave() {
    const allGrouped = GROUPS.map((g, i) => ({
      sheetName: tabLabels[g.id] || g.label,
      sheetIndex: i,
      group: g.id,
      headers: fields.filter((f) => f.groupId === g.id).map((f, idx) => ({
        id: f.id,
        label: f.label,
        order: idx,
        group: g.id,
        dataType: f.dataType,
        isUniqueKeyPart: f.isUniqueKeyPart,
        // Saves the field's own (possibly hand-edited via +/- in the card)
        // value list, not blindly the shared sheet column's raw values.
        dropdownSource: f.dataType === 'dropdown'
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
            templateName: finalTemplateName,
            marketplaceName: presetData.marketplaceName,
            category: presetData.category,
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
            templateName: finalTemplateName,
            sourceFileName: fileName,
            sheets: allGrouped.filter((g) => g.headers.length > 0),
            dropdownReference: dropdownSheetName
              ? { sheetName: dropdownSheetName, columns: mergedColumns }
              : { sheetName: null, columns: {} },
            marketplaceName: presetData.marketplaceName,
            category: presetData.category,
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
      if (!res.ok) throw new Error(data?.error || `Failed to save template (${res.status})`)
      if (!data?.template) throw new Error('Server did not return the saved template.')

      addToast(isEditMode ? 'Template updated' : 'Template created', 'success')
      setSavedTemplate({ id: data.template.id, templateName: data.template.templateName })
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const sheetsLocked = !workbook
  const groupsLocked = !showGroups
  const displayTabs = TABS.map((t) => ({ ...t, label: tabLabels[t.id] || t.label }))
  // Section 4's Final Name is the template name — no separate name field to
  // keep in sync with it.
  const finalTemplateName = `${presetData.marketplaceName || 'marketplace'}_${presetData.category || 'category'}_${presetData.exportVersion || 'v1.0'}`

  if (isEditMode && loadingExisting) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    )
  }
  if (isEditMode && loadError) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <p className="text-[14px] font-semibold text-gray-800">Couldn&apos;t load this template.</p>
        <p className="text-[13px] text-gray-500 mt-1">It may have been deleted, or you don&apos;t have access to it.</p>
        <Link href="/listing-tools/template-settings" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-700">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Template Settings
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto px-6 py-8 space-y-5">
      <div>
        <h1 className="text-lg font-bold text-gray-900">{isEditMode ? 'Edit Template' : 'Create Template'}</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          {isEditMode
            ? 'Regroup headers, tweak field types and dropdown values, and update the export preset or AI rules for this template.'
            : "Upload a master sheet and pick its Product Data Sheet — its headers appear on the Kanban board below automatically. Drag headers between groups, or bulk-assign several at once."}
        </p>
      </div>

      {!isEditMode && (
        <>
          {/* Section 1 — Upload */}
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <h2 className="text-[13px] font-semibold text-gray-800">1. Upload Master Excel File</h2>
            </div>
            <div className="p-4">
              {!fileName ? (
                <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl py-12 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors">
                  {parsing ? <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" /> : <UploadCloud className="w-7 h-7 text-gray-400" />}
                  <div className="text-center">
                    <p className="text-[13.5px] font-semibold text-gray-800">Click to upload .xlsx / .xls</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Any number of sheets — you&apos;ll pick their role next</p>
                  </div>
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                </label>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{fileName}</p>
                    <p className="text-[12px] text-gray-400">{sheetMeta.length} sheet{sheetMeta.length === 1 ? '' : 's'} found</p>
                  </div>
                  <label className="text-[12px] font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer flex-shrink-0">
                    Replace file
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Section 2 — Choose sheets (single-select, matching source/11.html) */}
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <h2 className="text-[13px] font-semibold text-gray-800">2. Select Sheets</h2>
            </div>
            <div className={sheetsLocked ? 'p-4 opacity-50 pointer-events-none select-none' : 'p-4'}>
              {sheetsLocked && <LockedNote>Upload a file in Section 1 to unlock.</LockedNote>}
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[12.5px] font-semibold text-gray-700 mb-1.5">Product Data Sheet (Compulsory Prefill Data)</label>
                  <select
                    value={dataSheetName}
                    onChange={(e) => {
                      const val = e.target.value
                      setDataSheetName(val)
                      if (!val) {
                        setShowGroups(false)
                        setFields([])
                        setDropdownColumns({})
                      }
                    }}
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    <option value="">-- Select sheet --</option>
                    {sheetMeta.map((s) => (
                      <option key={s.name} value={s.name}>{s.name} ({s.colCount} columns · {s.rowCount} rows)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12.5px] font-semibold text-gray-700 mb-1.5">Dropdowns Reference Sheet</label>
                  <select
                    value={dropdownSheetName}
                    onChange={(e) => setDropdownSheetName(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    <option value="">-- None --</option>
                    {sheetMeta.map((s) => (
                      <option key={s.name} value={s.name}>{s.name} ({s.colCount} columns · {s.rowCount} rows)</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Section 3 — Kanban groups + mapping */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-gray-800">3. Group Headers &amp; Map Fields</h2>
          <span className="text-[11.5px] text-gray-400">
            {fields.length} field{fields.length === 1 ? '' : 's'}{!isEditMode && ` from "${dataSheetName || '—'}"`}
          </span>
        </div>
        <div className={groupsLocked ? 'p-4 opacity-50 pointer-events-none select-none' : 'p-4'}>
          {groupsLocked && <LockedNote>Select a Product Data Sheet in Section 2 to unlock.</LockedNote>}
          <GroupTabsStep
            tabs={displayTabs}
            fields={fields}
            bulkTargetId={bulkTargetId}
            onBulkTargetChange={setBulkTargetId}
            onUpdateField={updateField}
            onBulkAssign={bulkAssignFields}
            onRenameTab={renameTab}
            allowAddTab={false}
          />
        </div>
      </div>

      {/* Section 4 — Preset & Export Configuration (source/11.html §4) */}
      <div className={groupsLocked ? 'opacity-50 pointer-events-none select-none' : ''}>
        {groupsLocked && <LockedNote>Complete Section 3 to unlock.</LockedNote>}
        <PresetExportSection value={presetData} onChange={setPresetData} onSave={savePreset} currentPreset={currentPreset} />
      </div>

      {/* Section 5 — AI Rules & Template Generation (source/11.html §5) */}
      <div className={groupsLocked ? 'opacity-50 pointer-events-none select-none' : ''}>
        {groupsLocked && <LockedNote>Complete Section 3 to unlock.</LockedNote>}
        <AiRulesSection value={aiRulesData} onChange={setAiRulesData} latestTemplateId={savedTemplate?.id} currentPreset={currentPreset} />
      </div>

      {/* Save — persists the real template (sheets + Section 4/5 data) via /api/listing-tools */}
      <div className="border border-gray-200 rounded-lg bg-white p-4 space-y-4">
        {savedTemplate ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-semibold text-gray-800">
                &quot;{savedTemplate.templateName}&quot; {isEditMode ? 'updated.' : 'created.'}
              </p>
              <p className="text-[12px] text-gray-500 mt-0.5">Section 5 above now shows this template&apos;s saved rules.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/listing-tools/templates/${savedTemplate.id}`}>
                <PillButton variant="ghost">View Template</PillButton>
              </Link>
              {isEditMode ? (
                <Link href="/listing-tools/template-settings">
                  <PillButton variant="upload" icon={ArrowLeft}>Back to Templates</PillButton>
                </Link>
              ) : (
                <PillButton variant="upload" icon={PlusCircle} onClick={resetWizard}>Create Another Template</PillButton>
              )}
            </div>
          </div>
        ) : (
          <div className={groupsLocked ? 'opacity-50 pointer-events-none select-none space-y-4' : 'space-y-4'}>
            {groupsLocked && <LockedNote>Complete Section 3 to unlock.</LockedNote>}
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-gray-500">
                Will be saved as <span className="font-semibold text-gray-700">&quot;{finalTemplateName}&quot;</span> — set in Section 4&apos;s Final Name.
              </p>
              <PillButton variant="upload" icon={Check} loading={saving} onClick={handleSave}>
                {isEditMode ? 'Save Changes' : 'Save Template & AI Rules'}
              </PillButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
