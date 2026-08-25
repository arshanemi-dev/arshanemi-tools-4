'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Download, UploadCloud, ArrowLeft } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import SheetGrid from '@/components/listing/SheetGrid'
import useTemplateExport from '@/components/listing/useTemplateExport'
import useAiFill from '@/components/listing/useAiFill'
import BillingGateModal from '@/components/billing/BillingGateModal'
import AssignedTemplatePicker from '@/components/listing/AssignedTemplatePicker'
import TemplateHistoryPanel from '@/components/listing/TemplateHistoryPanel'
import { resolveLinkedFill, buildPickerOptions } from '@/components/listing/linkedHeaders'
import { computeVisionTargets } from '@/lib/aiFillPrompt'
import { useToast } from '@/components/admin/Toast'
import { parseUploadedSheetRows } from '@/components/listing/parseUploadedSheet'
import useDebouncedCallback from '@/hooks/useDebouncedCallback'

// `aiFilled` (plan §14) is a bookkeeping key, not a header id.
function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || v === undefined || v === null || String(v).trim() === '')
}

// Renamed from "Prefill Details" — the group's own internal id (`group: 'prefill'`, the
// listing_prefill_details_history hub table, the prefill-details-history API route) is
// unchanged; only the display name and this page's own URL moved, see lib/listingTemplates.js's
// GROUPS/SHEET_LABELS comment. /listing-tools/prefill-details now just redirects here.
//
// Landing state is a picker over the user's assigned templates — same list
// as the Auto Listing sidebar dropdown — nothing loads until one is
// clicked. Clicking sets ?template= and switches into that template's own
// Prefill (brand) sheet, same click-to-open pattern as Product Details.
export default function BrandDetailsPage() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')

  if (!templateId) return <AssignedTemplatePicker basePath="/listing-tools/brand-details" />
  return <ScopedBrandDetails key={templateId} templateId={templateId} />
}

function ScopedBrandDetails({ templateId }) {
  const { addToast } = useToast()
  const router = useRouter()
  const [template, setTemplate] = useState(null)
  const [content, setContent] = useState(null)
  const [search, setSearch] = useState('')
  const uploadInputRef = useRef(null)
  const { exporting, gate, closeGate, runExport } = useTemplateExport(templateId)
  const { gate: aiGate, closeGate: closeAiGate, fillRowFromImage } = useAiFill(templateId)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setTemplate(d.template); setContent(d.content) } })
    return () => { cancelled = true }
  }, [templateId])

  const sheet = content?.sheets.find((s) => s.group === 'prefill')

  // Download exports only the prefill sheet — gate it on that sheet having
  // *more than one* real row (not the trailing empty row every sheet always
  // carries, and not just because headers exist).
  const filledRowCount = (sheet?.rows || []).filter((r) => Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim())).length
  const hasAnyFilledRow = filledRowCount > 1

  const sheetsByGroup = useMemo(
    () => Object.fromEntries((content?.sheets || []).map((s) => [s.group, s])),
    [content]
  )

  const filteredRows = useMemo(() => {
    if (!sheet) return []
    if (!search.trim()) return sheet.rows
    const q = search.toLowerCase()
    return sheet.rows.filter((r, i) => i === sheet.rows.length - 1 || Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').toLowerCase().includes(q)))
  }, [sheet, search])

  // Row edits persist on a short 50ms idle debounce (header/formula edits below still save
  // immediately — those are template-structure changes, not per-listing row data).
  const persistRows = useDebouncedCallback(async (headers, nextRows) => {
    const res = await fetch(`/api/listing-tools/${templateId}/sheets/prefill`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, rows: nextRows }),
    })
    if (!res.ok && res.status !== 401) {
      const data = await res.json().catch(() => ({}))
      addToast(data.message || 'Could not save changes', 'error')
    }
  }, 50)

  function saveRows(nextRows) {
    setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === 'prefill' ? { ...s, rows: nextRows } : s)) }))
    // Local grid state keeps the always-one-trailing-blank row (so there's
    // still somewhere to type the next entry); the server never needs it —
    // it re-derives its own single trailing blank via ensureTrailingEmptyRow
    // regardless of what's sent, so there's no reason to transmit a row we
    // already know is empty.
    persistRows(sheet.headers, nextRows.filter((r) => !isRowEmpty(r)))
  }

  // Merges AI-generated fields into one row and marks them `aiFilled` (plan
  // §14) — reuses the same debounced sheet save every other row edit goes
  // through. Defense in depth: see product-details/page.js's own copy of
  // this comment — a field that already has a value is never overwritten
  // here, no matter what the response contained.
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
  // only actually calls the AI route when the row has an empty
  // Brand/Highlights header to fill, so it's never a wasted coin.
  function handleImageUploaded(rowIndex, headerId, url) {
    const row = sheet?.rows[rowIndex]
    if (!row) return
    const targets = computeVisionTargets({ headers: sheet.headers, row: { ...row, [headerId]: url } })
    if (targets.length === 0) return
    fillRowFromImage('prefill', rowIndex, headerId, handleAiFillRow)
  }

  // Formula headers are editable right from the grid (see SheetGrid.jsx's
  // header-row formula box) — persists the same way a row edit does, via
  // the sheet's PATCH route, just with an updated `headers` array instead
  // of `rows`.
  function handleHeaderChange(headerId, patch) {
    if (!sheet) return
    const nextHeaders = sheet.headers.map((h) => (h.id === headerId ? { ...h, ...patch } : h))
    setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === 'prefill' ? { ...s, headers: nextHeaders } : s)) }))
    fetch(`/api/listing-tools/${templateId}/sheets/prefill`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers: nextHeaders, rows: sheet.rows }),
    }).then(async (res) => {
      if (!res.ok && res.status !== 401) {
        const data = await res.json().catch(() => ({}))
        addToast(data.message || 'Could not save formula', 'error')
      }
    })
  }

  async function handleUploadSheet(file) {
    if (!file || !sheet) return
    try {
      const rows = await parseUploadedSheetRows(file, sheet.headers)
      await saveRows(rows)
      addToast('Brand Details sheet updated', 'success')
    } catch {
      addToast("Couldn't read that file — is it a valid .xlsx?", 'error')
    }
  }

  return (
    <div className="min-h-[70vh] bg-surface px-6 py-6 space-y-4">
      <div className="flex items-center gap-3">
        {/* <button
          type="button"
          onClick={() => router.replace('/listing-tools/brand-details')}
          className="flex items-center gap-1.5 text-[13px] font-medium text-subtle hover:text-foreground flex-shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {template?.templateName}
        </button> */}

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-card-hover rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-light"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <TemplateHistoryPanel templateId={templateId} />
          <PillButton variant="upload" icon={UploadCloud} onClick={() => uploadInputRef.current?.click()}>
            Upload Sheet
          </PillButton>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { handleUploadSheet(e.target.files?.[0]); e.target.value = '' }}
          />
          <PillButton
            variant="download"
            icon={Download}
            loading={exporting}
            disabled={!content || !hasAnyFilledRow}
            title={!content || hasAnyFilledRow ? undefined : 'Add more than 1 row before downloading'}
            onClick={() => runExport({ template: content, groups: ['prefill'], format: 'excel', meta: template })}
          >
            Download Sheet
          </PillButton>
        </div>
      </div>

      <div className="border border-divider rounded-lg overflow-hidden bg-card">
        {!content && <p className="px-4 py-8 text-center text-[13px] text-subtle">Loading…</p>}
        {sheet && (
          <SheetGrid
            headers={sheet.headers}
            rows={filteredRows}
            onRowsChange={saveRows}
            uploadUrl={`/api/listing-tools/${templateId}/images`}
            pickerOptions={buildPickerOptions(sheet.headers, sheetsByGroup)}
            onCellChange={(headerId, value, rowIndex) => resolveLinkedFill(sheet.headers, headerId, value, rowIndex, sheetsByGroup)}
            onHeaderChange={handleHeaderChange}
            onImageUploaded={handleImageUploaded}
          />
        )}
      </div>

      <BillingGateModal gate={gate} onClose={closeGate} onRetry={() => runExport({ template: content, groups: ['prefill'], format: 'excel', meta: template })} />
      <BillingGateModal gate={aiGate} onClose={closeAiGate} />
    </div>
  )
}
