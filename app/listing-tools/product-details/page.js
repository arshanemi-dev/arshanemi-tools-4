'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, UploadCloud, ArrowLeft } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import SheetTabs from '@/components/listing/SheetTabs'
import SheetGrid from '@/components/listing/SheetGrid'
import useTemplateExport from '@/components/listing/useTemplateExport'
import BillingGateModal from '@/components/billing/BillingGateModal'
import AssignedTemplatePicker from '@/components/listing/AssignedTemplatePicker'
import { useToast } from '@/components/admin/Toast'

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
  const [activeGroup, setActiveGroup] = useState('design_system')
  const [activeFilterKey, setActiveFilterKey] = useState(null)
  const [filterValue, setFilterValue] = useState('')
  const uploadInputRef = useRef(null)
  const { exporting, gate, closeGate, runExport } = useTemplateExport(templateId)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setTemplate(d.template); setContent(d.content) } })
    return () => { cancelled = true }
  }, [templateId])

  const sheet = content?.sheets.find((s) => s.group === activeGroup)
  const keyHeaderId = sheet?.headers.find((h) => h.isUniqueKeyPart)?.id

  const filteredRows = useMemo(() => {
    if (!sheet) return []
    if (!activeFilterKey || !filterValue.trim()) return sheet.rows
    return sheet.rows.filter((r, i) => i === sheet.rows.length - 1 || String(r[activeFilterKey] ?? '').toLowerCase().includes(filterValue.toLowerCase()))
  }, [sheet, activeFilterKey, filterValue])

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

  async function saveRows(nextRows) {
    setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === activeGroup ? { ...s, rows: nextRows } : s)) }))
    const res = await fetch(`/api/listing-tools/${templateId}/sheets/${activeGroup}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers: sheet.headers, rows: nextRows }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      addToast(data.message || 'Could not save changes', 'error')
    }
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
        <button
          type="button"
          onClick={() => router.replace('/listing-tools/product-details')}
          className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {template?.templateName}
        </button>
        <div className="flex items-center gap-2">
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
          />
        )}
      </div>

      <BillingGateModal gate={gate} onClose={closeGate} onRetry={() => runExport({ template: content, groups: [activeGroup], format: 'excel', meta: template })} />
    </div>
  )
}
