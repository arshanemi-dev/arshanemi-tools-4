'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Download, UploadCloud, ArrowLeft } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import SheetGrid from '@/components/listing/SheetGrid'
import useTemplateExport from '@/components/listing/useTemplateExport'
import BillingGateModal from '@/components/billing/BillingGateModal'
import AssignedTemplatePicker from '@/components/listing/AssignedTemplatePicker'
import { useToast } from '@/components/admin/Toast'
import { parseUploadedSheetRows } from '@/components/listing/parseUploadedSheet'

// Landing state is a picker over the user's assigned templates — same list
// as the Auto Listing sidebar dropdown — nothing loads until one is
// clicked. Clicking sets ?template= and switches into that template's own
// Prefill (brand) sheet, same click-to-open pattern as Product Details.
export default function PrefillDetailsPage() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')

  if (!templateId) return <AssignedTemplatePicker basePath="/listing-tools/prefill-details" />
  return <ScopedPrefillDetails key={templateId} templateId={templateId} />
}

function ScopedPrefillDetails({ templateId }) {
  const { addToast } = useToast()
  const router = useRouter()
  const [template, setTemplate] = useState(null)
  const [content, setContent] = useState(null)
  const [search, setSearch] = useState('')
  const uploadInputRef = useRef(null)
  const { exporting, gate, closeGate, runExport } = useTemplateExport(templateId)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setTemplate(d.template); setContent(d.content) } })
    return () => { cancelled = true }
  }, [templateId])

  const sheet = content?.sheets.find((s) => s.group === 'prefill')

  const filteredRows = useMemo(() => {
    if (!sheet) return []
    if (!search.trim()) return sheet.rows
    const q = search.toLowerCase()
    return sheet.rows.filter((r, i) => i === sheet.rows.length - 1 || Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [sheet, search])

  async function saveRows(nextRows) {
    setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === 'prefill' ? { ...s, rows: nextRows } : s)) }))
    const res = await fetch(`/api/listing-tools/${templateId}/sheets/prefill`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers: sheet.headers, rows: nextRows }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      addToast(data.message || 'Could not save changes', 'error')
    }
  }

  async function handleUploadSheet(file) {
    if (!file || !sheet) return
    try {
      const rows = await parseUploadedSheetRows(file, sheet.headers)
      await saveRows(rows)
      addToast('Prefill sheet updated', 'success')
    } catch {
      addToast("Couldn't read that file — is it a valid .xlsx?", 'error')
    }
  }

  return (
    <div className="min-h-[70vh] bg-gray-50 px-6 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.replace('/listing-tools/prefill-details')}
          className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-800 flex-shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {template?.templateName}
        </button>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
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
            disabled={!content}
            onClick={() => runExport({ template: content, groups: ['prefill'], format: 'excel', meta: template })}
          >
            Download Sheet
          </PillButton>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        {!content && <p className="px-4 py-8 text-center text-[13px] text-gray-400">Loading…</p>}
        {sheet && (
          <SheetGrid
            headers={sheet.headers}
            rows={filteredRows}
            onRowsChange={saveRows}
            uploadUrl={`/api/listing-tools/${templateId}/images`}
          />
        )}
      </div>

      <BillingGateModal gate={gate} onClose={closeGate} onRetry={() => runExport({ template: content, groups: ['prefill'], format: 'excel', meta: template })} />
    </div>
  )
}
