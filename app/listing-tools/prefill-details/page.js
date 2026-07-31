'use client'
import { useEffect, useMemo, useState } from 'react'
import { Search, Download, Trash2 } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import SheetGrid from '@/components/listing/SheetGrid'
import SheetUploadButton from '@/components/listing/SheetUploadButton'
import useTemplateExport from '@/components/listing/useTemplateExport'
import BillingGateModal from '@/components/billing/BillingGateModal'
import { useToast } from '@/components/admin/Toast'

// Fixed to the Prefill (brand) sheet of one template at a time — no group
// tabs (unlike Design Details), matching the source screenshot which only
// ever shows a search bar + Upload/Download/Delete Brand here.
export default function PrefillDetailsPage() {
  const { addToast } = useToast()
  const [templates, setTemplates] = useState([])
  const [templateId, setTemplateId] = useState('')
  const [content, setContent] = useState(null)
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')
  const { exporting, gate, closeGate, runExport } = useTemplateExport(templateId)

  useEffect(() => {
    fetch('/api/listing-tools', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates || [])
        if (d.templates?.[0]) setTemplateId(d.templates[0].id)
      })
  }, [])

  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setContent(d.content); setSelected([]) } })
    return () => { cancelled = true }
  }, [templateId])

  const currentContent = content?.templateId === templateId ? content : null
  const sheet = currentContent?.sheets.find((s) => s.group === 'prefill')
  const brandHeaderId = sheet?.headers.find((h) => h.isUniqueKeyPart)?.id

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

  async function handleDeleteSelected() {
    if (selected.length === 0 || !sheet) return
    if (!confirm(`Delete ${selected.length} row(s)?`)) return
    const nextRows = sheet.rows.filter((_, i) => !selected.includes(i))
    setSelected([])
    await saveRows(nextRows)
    addToast('Rows deleted', 'success')
  }

  return (
    <div className="min-h-full bg-gray-50 px-6 py-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="px-3 py-2 text-[13px] font-medium border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {templates.map((t) => <option key={t.id} value={t.id}>{t.templateName}</option>)}
        </select>

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
          {sheet && <SheetUploadButton headers={sheet.headers} onRows={saveRows} />}
          <PillButton
            variant="download"
            icon={Download}
            loading={exporting}
            disabled={!currentContent}
            onClick={() => runExport({ template: currentContent, groups: ['prefill'], format: 'excel' })}
          >
            Download Sheet
          </PillButton>
          <PillButton variant="delete" icon={Trash2} disabled={selected.length === 0} onClick={handleDeleteSelected}>
            Delete Brand
          </PillButton>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        {!currentContent && <p className="px-4 py-8 text-center text-[13px] text-gray-400">Loading…</p>}
        {sheet && (
          <SheetGrid
            headers={sheet.headers}
            rows={filteredRows}
            onRowsChange={saveRows}
            uploadUrl={`/api/listing-tools/${templateId}/images`}
            selectable
            selectedIds={selected}
            onToggleSelect={(i) => setSelected((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))}
            onToggleSelectAll={(checked) => setSelected(checked ? filteredRows.map((_, i) => i) : [])}
          />
        )}
      </div>

      <BillingGateModal gate={gate} onClose={closeGate} onRetry={() => runExport({ template: currentContent, groups: ['prefill'], format: 'excel' })} />
    </div>
  )
}
