'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search,Download, UploadCloud, ArrowLeft, Sparkles } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import SheetTabs from '@/components/listing/SheetTabs'
import SheetGrid from '@/components/listing/SheetGrid'
import useTemplateExport from '@/components/listing/useTemplateExport'
import useAiFill from '@/components/listing/useAiFill'
import useAiAutofillBulk from '@/components/listing/useAiAutofillBulk'
import AiFillUpModal from '@/components/listing/AiFillUpModal'
import BillingGateModal from '@/components/billing/BillingGateModal'
import AssignedTemplatePicker from '@/components/listing/AssignedTemplatePicker'
import TemplateHistoryPanel from '@/components/listing/TemplateHistoryPanel'
import { resolveLinkedFill, buildPickerOptions } from '@/components/listing/linkedHeaders'
import { computeVisionTargets } from '@/lib/aiFillPrompt'
import { useToast } from '@/components/admin/Toast'
import useDebouncedCallback from '@/hooks/useDebouncedCallback'

// Landing state is a picker over the user's assigned templates — same list
// as the Auto Listing sidebar dropdown — nothing loads until one is
// clicked. Clicking sets ?template= (same destination the sidebar's
// per-template links already use) and switches into that template's own
// scoped workspace, tabs across all 4 groups, headers/rows belonging only
// to that template.
export default function ProductDetailsPage() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')

  if (!templateId) return <AssignedTemplatePicker basePath="/listing-tools/product-details" />
  return <ScopedProductDetails key={templateId} templateId={templateId} />
}

function ScopedProductDetails({ templateId }) {
  const { addToast } = useToast()
  const router = useRouter()
  const [template, setTemplate] = useState(null)
  const [content, setContent] = useState(null)
   const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState('design_system')
  const [activeFilterKey, setActiveFilterKey] = useState(null)
  const [filterValue, setFilterValue] = useState('')
  const uploadInputRef = useRef(null)
  const { exporting, gate, closeGate, runExport } = useTemplateExport(templateId)
  const { gate: aiGate, closeGate: closeAiGate, fillRowFromImage } = useAiFill(templateId)
  const { submitting: bulkSubmitting, gate: bulkGate, closeGate: closeBulkGate, runBulk } = useAiAutofillBulk(templateId)
  const [showAiFillUpModal, setShowAiFillUpModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setTemplate(d.template); setContent(d.content) } })
    return () => { cancelled = true }
  }, [templateId])

  const sheet = content?.sheets.find((s) => s.group === activeGroup)
  const keyHeaderId = sheet?.headers.find((h) => h.isUniqueKeyPart)?.id

  const sheetsByGroup = useMemo(
    () => Object.fromEntries((content?.sheets || []).map((s) => [s.group, s])),
    [content]
  )

  // "AI Fill Up" is a bulk action — with only a single real product row
  // across the whole template there's nothing to "bulk" that the per-row
  // "Fill by AI" button doesn't already cover, so it stays disabled until
  // there are 2+, instead of opening a confirm modal for just one row.
  const filledRowCount = (content?.sheets || []).reduce(
    (sum, s) => sum + s.rows.filter((r) => Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim())).length,
    0
  )
  const hasAnyFilledRow = filledRowCount > 1

  const filteredRows = useMemo(() => {
    if (!sheet) return []
    let out = sheet.rows
    if (activeFilterKey && filterValue.trim()) {
      const fq = filterValue.toLowerCase()
      out = out.filter((r, i) => i === sheet.rows.length - 1 || String(r[activeFilterKey] ?? '').toLowerCase().includes(fq))
    }
    if (search.trim()) {
      const sq = search.toLowerCase()
      out = out.filter((r, i) => i === out.length - 1 || Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').toLowerCase().includes(sq)))
    }
    return out
  }, [sheet, activeFilterKey, filterValue, search])

  function onFilterChange(headerId, value) {
    if (value === undefined) {
      setActiveFilterKey((prev) => (prev === headerId ? null : headerId))
      setFilterValue('')
    } else {
      setFilterValue(value)
    }
  }

  function onChangeGroup(g) {
    setActiveGroup(g)
    setActiveFilterKey(null)
    setFilterValue('')
  }

  // Row edits persist on a short 50ms idle debounce (unlike header/formula edits below, which
  // still save immediately — those are template-structure changes, not per-listing row data).
  // `group`/`headers` are passed in at call time rather than read from component state when the
  // debounce fires, so a tab switch inside that 50ms window can't send the save to the wrong
  // group's endpoint.
  const persistRows = useDebouncedCallback(async (group, headers, nextRows) => {
    const res = await fetch(`/api/listing-tools/${templateId}/sheets/${group}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, rows: nextRows }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      addToast(data.message || 'Could not save changes', 'error')
    }
  }, 50)

  function saveRows(nextRows) {
    setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === activeGroup ? { ...s, rows: nextRows } : s)) }))
    persistRows(activeGroup, sheet.headers, nextRows)
  }

  // Merges AI-generated fields into one row and marks them `aiFilled` (plan
  // §14) — reuses the same debounced sheet save every other row edit goes
  // through, so the result persists exactly like a manual cell edit would.
  // Defense in depth: the server never targets an already-filled header
  // (lib/aiFillPrompt.js's computeFillTargets/computeVisionTargets both
  // exclude non-blank cells), but this re-checks the row's *current* value
  // right before merging too — a field that already has a value is never
  // overwritten here, no matter what the response contained.
  function handleAiFillRow(rowIndex, fields) {
    if (!sheet) return
    const nextRows = sheet.rows.map((r, i) => {
      if (i !== rowIndex) return r
      const toApply = Object.fromEntries(Object.entries(fields).filter(([k]) => !String(r[k] ?? '').trim()))
      if (Object.keys(toApply).length === 0) return r
      const nextAiFilled = Array.from(new Set([...(r.aiFilled || []), ...Object.keys(toApply)]))
      return { ...r, ...toApply, aiFilled: nextAiFilled }
    })
    saveRows(nextRows)
  }

  // Auto-triggered the moment an image cell gets a usable value (plan §6) —
  // fires for both a single-cell upload (SheetGrid's updateCell) and a
  // multi-file bulk drop (useBulkImageUpload). Only actually calls the AI
  // route when the row has an empty Brand/Highlights header to fill, so
  // uploading into a template with neither header — or a row that already
  // has both — is a no-op, not a wasted coin.
  function handleImageUploaded(rowIndex, headerId, url) {
    const row = sheet?.rows[rowIndex]
    if (!row) return
    const targets = computeVisionTargets({ headers: sheet.headers, row: { ...row, [headerId]: url } })
    if (targets.length === 0) return
    fillRowFromImage(activeGroup, rowIndex, headerId, handleAiFillRow)
  }

  // Bulk route persists server-side directly (plan §11) — refetch afterward
  // so the grid reflects what actually landed in Blob storage.
  async function refetchContent() {
    const res = await fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
    const d = await res.json()
    setTemplate(d.template)
    setContent(d.content)
  }

  // "AI Fill Up" — runs whatever scope the AiFillUpModal picker confirmed
  // (`selections` = [{group, headerIds}]), refetching afterward since the
  // bulk route persists server-side directly (plan §11).
  function handleAiFillUp(selections) {
    if (!content || !selections?.length) return
    runBulk(selections, { onDone: refetchContent })
  }

  // Formula headers are editable right from the grid (see SheetGrid.jsx's
  // header-row formula box) — persists the same way a row edit does, via
  // the sheet's PATCH route, just with an updated `headers` array instead
  // of `rows`.
  function handleHeaderChange(headerId, patch) {
    if (!sheet) return
    const nextHeaders = sheet.headers.map((h) => (h.id === headerId ? { ...h, ...patch } : h))
    setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === activeGroup ? { ...s, headers: nextHeaders } : s)) }))
    fetch(`/api/listing-tools/${templateId}/sheets/${activeGroup}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers: nextHeaders, rows: sheet.rows }),
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast(data.message || 'Could not save formula', 'error')
      }
    })
  }

  async function handleUploadOldSheet(file) {
    if (!file || !content) return
    const { importIntoBestMatchingGroup } = await import('@/components/listing/parseUploadedSheet')
    try {
      const result = await importIntoBestMatchingGroup(file, content.sheets)
      if (!result) {
        addToast("Couldn't match that file's columns to any sheet in this template.", 'error')
        return
      }
      if (result.group !== activeGroup) onChangeGroup(result.group)
      setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === result.group ? { ...s, rows: result.rows } : s)) }))
      await fetch(`/api/listing-tools/${templateId}/sheets/${result.group}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers: content.sheets.find((s) => s.group === result.group).headers, rows: result.rows }),
      })
      addToast(`Updated the ${result.group.replace('_', ' ')} sheet from that file.`, 'success')
    } catch {
      addToast('Could not read that file — is it a valid .xlsx?', 'error')
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
          <TemplateHistoryPanel templateId={templateId} />
          <PillButton variant="upload" icon={UploadCloud} onClick={() => uploadInputRef.current?.click()}>
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
            variant="ai"
            icon={Sparkles}
            loading={bulkSubmitting}
            disabled={!content || !hasAnyFilledRow}
            title={!content || hasAnyFilledRow ? undefined : 'Add at least 2 product rows before running AI Fill Up'}
            onClick={() => setShowAiFillUpModal(true)}
          >
            AI Fill Up
          </PillButton>
          <PillButton
            variant="download"
            icon={Download}
            loading={exporting}
            disabled={!content}
            onClick={() => runExport({ template: content, groups: [activeGroup], format: 'excel', meta: template })}
          >
            Download Final Sheet
          </PillButton>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <SheetTabs active={activeGroup} onChange={onChangeGroup} />
        {!content && <p className="px-4 py-8 text-center text-[13px] text-gray-400">Loading…</p>}
        {sheet && (
          <SheetGrid
            headers={sheet.headers}
            rows={filteredRows}
            onRowsChange={saveRows}
            uploadUrl={`/api/listing-tools/${templateId}/images`}
            activeFilterHeaderId={activeFilterKey}
            filterValue={filterValue}
            onFilterChange={keyHeaderId ? onFilterChange : undefined}
            pickerOptions={buildPickerOptions(sheet.headers, sheetsByGroup)}
            onCellChange={(headerId, value, rowIndex) => resolveLinkedFill(sheet.headers, headerId, value, rowIndex, sheetsByGroup)}
            onHeaderChange={handleHeaderChange}
            onImageUploaded={handleImageUploaded}
          />
        )}
      </div>

      <BillingGateModal gate={gate} onClose={closeGate} onRetry={() => runExport({ template: content, groups: [activeGroup], format: 'excel', meta: template })} />
      <BillingGateModal gate={aiGate} onClose={closeAiGate} />
      <BillingGateModal gate={bulkGate} onClose={closeBulkGate} />
      {showAiFillUpModal && (
        <AiFillUpModal
          onClose={() => setShowAiFillUpModal(false)}
          sheets={content?.sheets}
          defaultGroup={activeGroup}
          onRun={(selections) => { setShowAiFillUpModal(false); handleAiFillUp(selections) }}
        />
      )}
    </div>
  )
}
