'use client'
import { useEffect, useMemo, useState } from 'react'
import { Download, Trash2, Pencil, Search } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import SheetTabs from '@/components/listing/SheetTabs'
import SheetGrid from '@/components/listing/SheetGrid'
import useTemplateExport from '@/components/listing/useTemplateExport'
import BillingGateModal from '@/components/billing/BillingGateModal'
import { useToast } from '@/components/admin/Toast'

function countFilled(rows) {
  return rows.filter((r) => Object.values(r).some((v) => String(v ?? '').trim())).length
}

// Scoped to one template at a time (picked from the dropdown) — the four
// group tabs switch which sheet of that template is shown. A true flattened
// view across every template isn't possible here since each template's
// headers are its own (differently shaped) schema — see the per-template
// "Choose Your Template" page for browsing everything at once.
export default function DesignDetailsPage() {
  const { addToast } = useToast()
  const [templates, setTemplates] = useState([])
  const [templateId, setTemplateId] = useState('')
  const [content, setContent] = useState(null)
  const [activeGroup, setActiveGroup] = useState('design_system')
  const [editable, setEditable] = useState(false)
  const [selected, setSelected] = useState([])
  const [designFilter, setDesignFilter] = useState('')
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

  // content lags one fetch behind templateId while a switch is in flight —
  // treat it as "still loading" rather than briefly rendering the previous
  // template's rows under the new selection.
  const currentContent = content?.templateId === templateId ? content : null
  const sheet = currentContent?.sheets.find((s) => s.group === activeGroup)
  const keyHeaderId = sheet?.headers.find((h) => h.isUniqueKeyPart)?.id

  const filteredRows = useMemo(() => {
    if (!sheet) return []
    if (!designFilter.trim() || !keyHeaderId) return sheet.rows
    return sheet.rows.filter((r, i) => i === sheet.rows.length - 1 || String(r[keyHeaderId] ?? '').toLowerCase().includes(designFilter.toLowerCase()))
  }, [sheet, designFilter, keyHeaderId])

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

        {keyHeaderId && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={designFilter}
              onChange={(e) => setDesignFilter(e.target.value)}
              placeholder="Filter by design number…"
              className="pl-8 pr-3 py-2 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <PillButton
            variant="download"
            icon={Download}
            loading={exporting}
            disabled={!currentContent}
            onClick={() => runExport({ template: currentContent, groups: [activeGroup], format: 'excel' })}
          >
            Download Final Sheet
          </PillButton>
          <PillButton variant="delete" icon={Trash2} disabled={selected.length === 0} onClick={handleDeleteSelected}>
            Delete Design
          </PillButton>
          <PillButton variant="edit" icon={Pencil} onClick={() => setEditable((e) => !e)}>
            {editable ? 'Lock Details' : 'Edit Details'}
          </PillButton>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <SheetTabs active={activeGroup} onChange={(g) => { setActiveGroup(g); setSelected([]) }} />
        <div className="p-0">
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
              onToggleSelectAll={(checked) => setSelected(checked ? filteredRows.map((_, i) => i).filter((i) => countFilled([filteredRows[i]]) > 0) : [])}
              readOnly={!editable}
            />
          )}
        </div>
      </div>

      <BillingGateModal gate={gate} onClose={closeGate} onRetry={() => runExport({ template: currentContent, groups: [activeGroup], format: 'excel' })} />
    </div>
  )
}
