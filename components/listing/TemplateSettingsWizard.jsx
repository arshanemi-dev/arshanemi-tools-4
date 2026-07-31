'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, FileSpreadsheet, ChevronRight, Loader2, Check } from 'lucide-react'
import { useToast } from '@/components/admin/Toast'
import PillButton from './PillButton'
import GroupTabsStep, { UNMAPPED_TAB_ID } from './GroupTabsStep'

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

// Tab strip shown in Section 3 — "Unselected" holds every header until it's
// moved into one of the 4 real groups. Only those 4 are real tabs: the
// backend (lib/listingTemplates.js GROUPS, the sheets/[group] API route)
// only ever reads/writes those 4 group ids, so GroupTabsStep's "+ Add Tab"
// custom-group button stays off here — a custom tab's fields would just be
// silently dropped on save.
const TABS = [{ id: UNMAPPED_TAB_ID, label: 'Unselected' }, ...GROUPS]

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

// Step 3 "automatic" group placement — if a Filling Details sheet's own name
// already matches one of the 4 groups (e.g. a sheet literally called
// "Compulsory"), its fields land there instead of Unselected.
function autoMatchGroup(sheetName) {
  const s = normalize(sheetName)
  for (const g of GROUPS) {
    const gl = normalize(g.label)
    if (s === gl || s.includes(gl) || gl.includes(s)) return g.id
  }
  return null
}

// Step 3 "automatic dropdown" — matches a header label to a Validation
// sheet's column name so its dropdown source pre-fills itself.
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

function buildDropdownColumns(XLSX, workbook, validationChecked) {
  const out = {}
  Object.keys(validationChecked).filter((k) => validationChecked[k]).forEach((sheetName) => {
    const ws = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws)
    if (!rows.length) return
    Object.keys(rows[0]).forEach((col) => {
      const values = [...new Set(rows.map((r) => r[col]).filter((v) => v !== undefined && v !== null && String(v).trim() !== '').map(String))]
      if (!values.length) return
      // Two validation sheets can share a column name (e.g. both have
      // "Color") — disambiguate instead of one silently clobbering the other.
      const key = out[col] ? `${col} (${sheetName})` : col
      out[key] = { sheetName, columnName: col, values }
    })
  })
  return out
}

function buildFields(XLSX, workbook, fillingChecked, dropdownColumns) {
  const dropdownNames = Object.keys(dropdownColumns)
  const fields = []
  let counter = 0
  Object.keys(fillingChecked).filter((k) => fillingChecked[k]).forEach((sheetName) => {
    const ws = workbook.Sheets[sheetName]
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 })
    const headerRow = (aoa[0] || []).map((v) => String(v ?? '').trim()).filter(Boolean)
    const seen = new Set()
    headerRow.forEach((label) => {
      const key = label.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      counter += 1
      const groupId = autoMatchGroup(sheetName) || UNMAPPED_TAB_ID
      const dropdownMatch = autoMatchDropdown(label, dropdownNames)
      fields.push({
        id: `hdr_${slugify(label)}_${counter}`,
        label,
        sourceSheet: sheetName,
        groupId,
        dataType: dropdownMatch ? 'dropdown' : detectDataType(label),
        dropdownColumn: dropdownMatch || '',
        isUniqueKeyPart: (groupId === 'design_system' && /design|number/i.test(label)) || (groupId === 'prefill' && /brand/i.test(label)),
      })
    })
  })
  return fields
}

// Single-page template creation flow: upload → mark each sheet's role
// (Filling Details vs Validation) → group the resulting fields. Replaces
// the old 4-step, one-screen-at-a-time wizard — every section here stays
// visible once revealed instead of hiding the previous step.
export default function TemplateSettingsWizard() {
  const router = useRouter()
  const { addToast } = useToast()

  const [fileName, setFileName] = useState('')
  const [workbook, setWorkbook] = useState(null)
  const [sheetMeta, setSheetMeta] = useState([]) // [{name,colCount,rowCount}]
  const [fillingChecked, setFillingChecked] = useState({})
  const [validationChecked, setValidationChecked] = useState({})
  const [parsing, setParsing] = useState(false)

  const [showGroups, setShowGroups] = useState(false)
  const [fields, setFields] = useState([])
  const [dropdownColumns, setDropdownColumns] = useState({})
  const [activeTabId, setActiveTabId] = useState(UNMAPPED_TAB_ID)

  const [templateName, setTemplateName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

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
        return { name, colCount: (aoa[0] || []).length, rowCount: Math.max(aoa.length - 1, 0) }
      })
      const filling = {}
      const validation = {}
      wb.SheetNames.forEach((name) => {
        if (guessIsValidationSheet(name)) validation[name] = true
        else filling[name] = true
      })
      setWorkbook(wb)
      setFileName(file.name)
      setSheetMeta(meta)
      setFillingChecked(filling)
      setValidationChecked(validation)
      setShowGroups(false)
    } catch (err) {
      addToast('Could not read that file — is it a valid .xlsx?', 'error')
    } finally {
      setParsing(false)
    }
  }

  async function buildGroupsFromSheets() {
    if (!workbook) return
    // xlsx was already imported once in handleFile — re-import resolves
    // instantly from the module cache, no extra network/parse cost.
    const XLSX = await import('xlsx')
    const cols = buildDropdownColumns(XLSX, workbook, validationChecked)
    const built = buildFields(XLSX, workbook, fillingChecked, cols)
    setDropdownColumns(cols)
    setFields(built)
    setShowGroups(true)
    setActiveTabId(UNMAPPED_TAB_ID)
  }

  function updateField(id, patch) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  function bulkAssignFields(ids, groupId) {
    setFields((prev) => prev.map((f) => (ids.includes(f.id) ? { ...f, groupId } : f)))
  }

  async function handleSave() {
    if (!templateName.trim()) {
      addToast('Give this template a name.', 'error')
      return
    }
    const grouped = GROUPS
      .map((g, i) => ({
        sheetName: g.label,
        sheetIndex: i,
        group: g.id,
        headers: fields.filter((f) => f.groupId === g.id).map((f, idx) => ({
          id: f.id,
          label: f.label,
          order: idx,
          group: g.id,
          dataType: f.dataType,
          isUniqueKeyPart: f.isUniqueKeyPart,
          dropdownSource: f.dataType === 'dropdown' && f.dropdownColumn && dropdownColumns[f.dropdownColumn]
            ? { sheetName: dropdownColumns[f.dropdownColumn].sheetName, columnName: f.dropdownColumn, values: dropdownColumns[f.dropdownColumn].values }
            : null,
        })),
        rows: [],
      }))
      .filter((g) => g.headers.length > 0)

    if (grouped.length === 0) {
      addToast('Add at least one field to a group before saving.', 'error')
      return
    }

    setSaving(true)
    try {
      const validationSheetNames = Object.keys(validationChecked).filter((k) => validationChecked[k])
      const mergedColumns = Object.fromEntries(Object.entries(dropdownColumns).map(([k, v]) => [k, v.values]))

      const res = await fetch('/api/listing-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName,
          description,
          sourceFileName: fileName,
          sheets: grouped,
          dropdownReference: validationSheetNames.length
            ? { sheetName: validationSheetNames.join(', '), columns: mergedColumns }
            : { sheetName: null, columns: {} },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save template')

      addToast('Template created', 'success')
      router.push(`/listing-tools/templates/${data.template.id}`)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const canBuildGroups = Object.values(fillingChecked).some(Boolean)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Create Template</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Upload a master sheet, mark which tabs are for filling in details vs. dropdown validation, then group the columns the way your CRM expects them.
        </p>
      </div>

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
                <p className="text-[12px] text-gray-400 mt-0.5">Any number of sheets — you'll pick their role next</p>
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

      {/* Section 2 — Choose sheet roles */}
      {workbook && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <h2 className="text-[13px] font-semibold text-gray-800">2. Choose Sheets</h2>
          </div>
          <div className="p-4 grid md:grid-cols-2 gap-5">
            <div>
              <p className="text-[12.5px] font-semibold text-gray-700 mb-0.5">Filling Details Sheets</p>
              <p className="text-[11.5px] text-gray-400 mb-2">Sheets whose header row becomes fields to fill in.</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {sheetMeta.map((s) => (
                  <label key={s.name} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={!!fillingChecked[s.name]}
                      onChange={(e) => setFillingChecked((prev) => ({ ...prev, [s.name]: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="text-[11px] text-gray-400">{s.colCount} columns · {s.rowCount} rows</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[12.5px] font-semibold text-gray-700 mb-0.5">Validation Sheets</p>
              <p className="text-[11.5px] text-gray-400 mb-2">Sheets whose columns power dropdown option lists.</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {sheetMeta.map((s) => (
                  <label key={s.name} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={!!validationChecked[s.name]}
                      onChange={(e) => setValidationChecked((prev) => ({ ...prev, [s.name]: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="text-[11px] text-gray-400">{s.colCount} columns · {s.rowCount} rows</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="px-4 pb-4 flex justify-end">
            <PillButton variant="download" icon={ChevronRight} disabled={!canBuildGroups} onClick={buildGroupsFromSheets}>
              Build Column Groups
            </PillButton>
          </div>
        </div>
      )}

      {/* Section 3 — Groups + mapping + save */}
      {showGroups && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-gray-800">3. Group Headers &amp; Map Fields</h2>
            <span className="text-[11.5px] text-gray-400">{fields.length} field{fields.length === 1 ? '' : 's'} from Filling Details sheets</span>
          </div>

          <GroupTabsStep
            tabs={TABS}
            fields={fields}
            activeTabId={activeTabId}
            onActiveTabChange={setActiveTabId}
            dropdownColumnNames={Object.keys(dropdownColumns)}
            onUpdateField={updateField}
            onBulkAssign={bulkAssignFields}
            allowAddTab={false}
          />

          <div className="border border-gray-200 rounded-lg bg-white p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12.5px] font-semibold text-gray-700 mb-1.5">Template Name</label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Summer Kurti Master"
                  className="w-full px-3 py-2 text-[13.5px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-[12.5px] font-semibold text-gray-700 mb-1.5">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this template is used for"
                  className="w-full px-3 py-2 text-[13.5px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <PillButton variant="upload" icon={Check} loading={saving} onClick={handleSave}>
                Save Template
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
