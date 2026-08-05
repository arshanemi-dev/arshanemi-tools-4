'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {Search, Download, UploadCloud, ArrowLeft, PlusCircle } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import SheetTabs from '@/components/listing/SheetTabs'
import SheetGrid from '@/components/listing/SheetGrid'
import useTemplateExport from '@/components/listing/useTemplateExport'
import BillingGateModal from '@/components/billing/BillingGateModal'
import AssignedTemplatePicker from '@/components/listing/AssignedTemplatePicker'
import { importIntoBestMatchingGroup } from '@/components/listing/parseUploadedSheet'
import { resolveLinkedFill, buildPickerOptions } from '@/components/listing/linkedHeaders'
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
  const router = useRouter()
  const [template, setTemplate] = useState(null);
   const [search, setSearch] = useState('')
  const [content, setContent] = useState(null)
  const [sessionRows, setSessionRows] = useState({})
  const [blockGroups, setBlockGroups] = useState(ALL_GROUPS)
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

  // Clears every block back to a single blank row — a manual "start over"
  // for the next listing, independent of SheetGrid's own automatic
  // one-trailing-blank-row behavior. Whatever was already typed has already
  // autosaved (saveGroup is debounced, not tied to leaving the page), so
  // this only clears what's on screen, never discards saved data.
  function handleCreateNew() {
    setSessionRows(blankSessionFor(content?.sheets))
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

      {[blockGroups[0]].map((group, blockIndex) => {
        const sheet = sheetsByGroup[group]
        if (!sheet) return null
        const rows = sessionRows[group] || [blankRow(sheet.headers)]
        return (
          <div key={blockIndex} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <SheetTabs
              variant="dark"
              active={group}
              onChange={(g) => setBlockGroups((prev) => prev.map((x, i) => (i === blockIndex ? g : x)))}
            />
            <SheetGrid
              headers={sheet.headers}
              rows={rows}
              onRowsChange={(nextRows) => handleRowsChange(group, nextRows)}
              uploadUrl={`/api/listing-tools/${templateId}/images`}
              pickerOptions={buildPickerOptions(sheet.headers, sheetsByGroup)}
              onCellChange={(headerId, value) => resolveLinkedFill(sheet.headers, headerId, value, -1, sheetsByGroup)}
            />
          </div>
        )
      })}

      <BillingGateModal
        gate={gate}
        onClose={closeGate}
        onRetry={() => runExport({ template: buildExportTemplate(), groups: ALL_GROUPS, format: 'excel', meta: template })}
      />
    </div>
  )
}
