'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Download, UploadCloud, PlusCircle } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import SheetTabs from '@/components/listing/SheetTabs'
import SheetGrid from '@/components/listing/SheetGrid'
import useTemplateExport from '@/components/listing/useTemplateExport'
import BillingGateModal from '@/components/billing/BillingGateModal'
import AssignedTemplatePicker from '@/components/listing/AssignedTemplatePicker'
import { importIntoBestMatchingGroup } from '@/components/listing/parseUploadedSheet'
import { resolveLinkedFill, buildPickerOptions, propagateFromDesignSystem } from '@/components/listing/linkedHeaders'
import { useToast } from '@/components/admin/Toast'
import useDebouncedCallback from '@/hooks/useDebouncedCallback'

// Landing state is a picker over the user's assigned templates — same list
// as the Auto Listing sidebar dropdown (ListingToolsSidebar.jsx, whose
// "Auto Listing" section already links here via ?template=) — nothing loads
// until one is clicked.
export default function AutoDetailsPage() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')

  if (!templateId) return <AssignedTemplatePicker basePath="/listing-tools/auto-details" />
  return <ScopedAutoDetails key={templateId} templateId={templateId} />
}

// The Auto Listing fill/export workspace — every sheet (Product Details
// included) visible and editable on one screen at once, each block with its
// own independent group tab-strip. This page is a *fresh* entry form every
// visit — it never displays rows already saved from a previous session
// (that's what Product Details/Prefill Details are for). `content` is still
// fetched in full and kept around, but only as: (a) the lookup source for
// the connected-headers picks below (Product Details' own unique-key header
// doubles as a picker of already-saved products — picking one, or picking
// one via any other group's header linked to it, auto-fills the rest of
// that row, see components/listing/linkedHeaders.js), and (b) something to
// merge new rows into on save/export, so a save from this blank screen can
// never wipe out data that was already on the server.
const ALL_GROUPS = ['design_system', 'compulsory', 'prefill', 'optional']
// "Upload Old Sheet" only ever matches into these three — Product Details'
// own data comes from Template Settings' Product Data Sheet at creation
// time and from the Rule A/B pickers here, not from a bulk re-upload.
const UPLOAD_MATCH_GROUPS = ['compulsory', 'prefill', 'optional']

function isRowEmpty(row) {
  return Object.values(row || {}).every((v) => v === undefined || v === null || String(v).trim() === '')
}
function blankRow(headers) {
  return Object.fromEntries(headers.map((h) => [h.id, '']))
}
function blankSessionFor(sheets) {
  return Object.fromEntries((sheets || []).map((s) => [s.group, [blankRow(s.headers)]]))
}

function ScopedAutoDetails({ templateId }) {
  const { addToast } = useToast()
  const [template, setTemplate] = useState(null)
  const [search, setSearch] = useState('')
  const [content, setContent] = useState(null)
  const [sessionRows, setSessionRows] = useState({})
  const [activeGroup, setActiveGroup] = useState(ALL_GROUPS[0])
  const [uploading, setUploading] = useState(false)
  const uploadInputRef = useRef(null)
  const { exporting, gate, closeGate, runExport } = useTemplateExport(templateId)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setTemplate(d.template)
        setContent(d.content)
        setSessionRows(blankSessionFor(d.content.sheets))
      })
    return () => { cancelled = true }
  }, [templateId])

  const sheetsByGroup = useMemo(
    () => Object.fromEntries((content?.sheets || []).map((s) => [s.group, s])),
    [content]
  )

  const sheet = sheetsByGroup[activeGroup]
  const filteredRows = useMemo(() => {
    const activeRows = sessionRows[activeGroup] || (sheet ? [blankRow(sheet.headers)] : [])
    if (!search.trim()) return activeRows
    const q = search.toLowerCase()
    return activeRows.filter((r, i) => i === activeRows.length - 1 || Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [sessionRows, activeGroup, sheet, search])

  function onChangeGroup(g) {
    setActiveGroup(g)
    setSearch('')
  }

  // Existing (already-saved, fetched once) rows for a group, blanks
  // dropped, plus whatever's currently in this session, also blanks
  // dropped — the set actually sent to the server / included in an export.
  function mergedRowsFor(group, sessionRowsForGroup) {
    const existing = (sheetsByGroup[group]?.rows || []).filter((r) => !isRowEmpty(r))
    const session = (sessionRowsForGroup || []).filter((r) => !isRowEmpty(r))
    return [...existing, ...session]
  }

  const saveGroup = useDebouncedCallback(async (group, headers, rows) => {
    const res = await fetch(`/api/listing-tools/${templateId}/sheets/${group}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, rows }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      addToast(data.message || 'Could not save changes', 'error')
    }
  }, 1000)

  function handleRowsChange(group, nextSessionRows) {
    setSessionRows((prev) => ({ ...prev, [group]: nextSessionRows }))
    const headers = sheetsByGroup[group]?.headers || []
    saveGroup(group, headers, mergedRowsFor(group, nextSessionRows))
  }

  // Product Details' own row is the one true picker (its other connector
  // headers elsewhere — Compulsory/Optional's Product Number, Prefill's
  // Brand — are disabled/read-only mirrors, see withDefaultHeaders in
  // TemplateSettingsWizard.jsx). Once picking/typing there resolves an
  // existing product, fan that resolved row out into every other group's
  // own current row and persist each one — this is a side effect of the
  // Product Details pick, not something the user will separately go type
  // into those other groups to trigger.
  function applyCrossGroupUpdates(updates) {
    const nextSessionRows = { ...sessionRows }
    for (const [group, fields] of Object.entries(updates)) {
      const rows = sessionRows[group] || []
      if (rows.length === 0) continue
      const lastIdx = rows.length - 1
      const nextRows = rows.map((r, i) => (i === lastIdx ? { ...r, ...fields } : r))
      nextSessionRows[group] = nextRows
      saveGroup(group, sheetsByGroup[group]?.headers || [], mergedRowsFor(group, nextRows))
    }
    setSessionRows(nextSessionRows)
  }

  // Clears every block back to a single blank row — a manual "start over"
  // for the next listing, independent of SheetGrid's own automatic
  // one-trailing-blank-row behavior. Whatever was already typed has already
  // autosaved (saveGroup is debounced, not tied to leaving the page), so
  // this only clears what's on screen, never discards saved data.
  function handleCreateNew() {
    setSessionRows(blankSessionFor(content?.sheets))
  }

  // Formula headers are editable right from the grid (see SheetGrid.jsx's
  // header-row formula box) — persists via the same sheet PATCH route,
  // sending the merged (existing + this session's) rows alongside the
  // updated headers so an in-progress session's rows aren't dropped.
  function handleHeaderChange(headerId, patch) {
    if (!sheet) return
    const nextHeaders = sheet.headers.map((h) => (h.id === headerId ? { ...h, ...patch } : h))
    setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === activeGroup ? { ...s, headers: nextHeaders } : s)) }))
    fetch(`/api/listing-tools/${templateId}/sheets/${activeGroup}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers: nextHeaders, rows: mergedRowsFor(activeGroup, sessionRows[activeGroup]) }),
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast(data.message || 'Could not save formula', 'error')
      }
    })
  }

  async function handleUploadOldSheet(file) {
    if (!file || !content) return
    setUploading(true)
    try {
      const result = await importIntoBestMatchingGroup(file, content.sheets.filter((s) => UPLOAD_MATCH_GROUPS.includes(s.group)))
      if (!result) {
        addToast("Couldn't match that file's columns to any sheet in this template.", 'error')
        return
      }
      handleRowsChange(result.group, result.rows)
      addToast(`Updated the ${result.group.replace('_', ' ')} sheet from that file.`, 'success')
    } catch {
      addToast('Could not read that file — is it a valid .xlsx?', 'error')
    } finally {
      setUploading(false)
    }
  }

  // Full export = everything ever saved, not just this session's new rows.
  function buildExportTemplate() {
    return {
      ...content,
      sheets: content.sheets.map((s) => ({ ...s, rows: mergedRowsFor(s.group, sessionRows[s.group]) })),
    }
  }

  return (
    <div className="min-h-[70vh] bg-gray-50 px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <PillButton variant="ghost" icon={PlusCircle} onClick={handleCreateNew} disabled={!content}>
            Create New
          </PillButton>
          <PillButton variant="upload" icon={UploadCloud} loading={uploading} onClick={() => uploadInputRef.current?.click()}>
            Upload Old Sheet
          </PillButton>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { handleUploadOldSheet(e.target.files?.[0]); e.target.value = '' }}
          />
          <PillButton
            variant="download"
            icon={Download}
            loading={exporting}
            disabled={!content}
            onClick={() => runExport({ template: buildExportTemplate(), groups: ALL_GROUPS, format: 'excel', meta: template })}
          >
            Download Final Sheet
          </PillButton>
        </div>
      </div>

      {!content && <p className="px-4 py-8 text-center text-[13px] text-gray-400">Loading…</p>}

      {sheet && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <SheetTabs variant="dark" active={activeGroup} onChange={onChangeGroup} />
          <SheetGrid
            headers={sheet.headers}
            rows={filteredRows}
            onRowsChange={(nextRows) => handleRowsChange(activeGroup, nextRows)}
            uploadUrl={`/api/listing-tools/${templateId}/images`}
            pickerOptions={buildPickerOptions(sheet.headers, sheetsByGroup)}
            onCellChange={(headerId, value) => {
              const sameGroupExtra = resolveLinkedFill(sheet.headers, headerId, value, -1, sheetsByGroup)
              if (activeGroup === 'design_system') {
                const crossGroupUpdates = propagateFromDesignSystem(headerId, value, -1, sheetsByGroup)
                if (crossGroupUpdates) applyCrossGroupUpdates(crossGroupUpdates)
              }
              return sameGroupExtra
            }}
            onHeaderChange={handleHeaderChange}
          />
        </div>
      )}

      <BillingGateModal
        gate={gate}
        onClose={closeGate}
        onRetry={() => runExport({ template: buildExportTemplate(), groups: ALL_GROUPS, format: 'excel', meta: template })}
      />
    </div>
  )
}
