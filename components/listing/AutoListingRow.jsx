'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Download, Trash2 } from 'lucide-react'
import PillButton from './PillButton'
import SheetGrid from './SheetGrid'
import SheetUploadButton from './SheetUploadButton'
import useTemplateExport from './useTemplateExport'
import BillingGateModal from '@/components/billing/BillingGateModal'
import { useToast } from '@/components/admin/Toast'
import useDebouncedCallback from '@/hooks/useDebouncedCallback'

// Expanding a row previews that template's Prefill (brand) sheet inline —
// screenshots show Upload Sheet / Download Sheet / Delete Brand acting on
// exactly this grid shape from the Auto Listing list itself, without
// navigating away.
export default function AutoListingRow({ template, expanded, onToggle, onDeleted }) {
  const { addToast } = useToast()
  const [content, setContent] = useState(null)
  const loading = expanded && !content
  const { exporting, gate, closeGate, runExport } = useTemplateExport(template.id)

  useEffect(() => {
    if (!expanded || content) return
    let cancelled = false
    fetch(`/api/listing-tools/${template.id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setContent(d.content) })
    return () => { cancelled = true }
  }, [expanded, content, template.id])

  const saveRows = useDebouncedCallback(async (rows, headers) => {
    const res = await fetch(`/api/listing-tools/${template.id}/sheets/prefill`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, rows }),
    })
    if (!res.ok && res.status !== 401) {
      const data = await res.json().catch(() => ({}))
      addToast(data.message || 'Could not save changes', 'error')
    }
  }, 1000)

  const prefillSheet = content?.sheets.find((s) => s.group === 'prefill')

  function handleRowsChange(nextRows) {
    if (!prefillSheet) return
    setContent((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) => (s.group === 'prefill' ? { ...s, rows: nextRows } : s)),
    }))
    saveRows(nextRows, prefillSheet.headers)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${template.templateName}"? This can't be undone.`)) return
    const res = await fetch(`/api/listing-tools/${template.id}`, { method: 'DELETE' })
    if (res.ok) { addToast('Template deleted', 'success'); onDeleted() }
    else if (res.status !== 401) addToast('Could not delete template', 'error')
  }

  return (
    <>
      <tr className="border-b border-divider hover:bg-surface/60">
        <td className="px-4 py-3">
          <button type="button" onClick={onToggle} className="flex items-center gap-1.5 text-muted font-medium">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            My Template
          </button>
        </td>
        <td className="px-4 py-3 text-foreground font-medium">{template.templateName}</td>
        <td className="px-4 py-3 text-subtle">{template.description || '—'}</td>
        <td className="px-4 py-3 text-right">
          <Link href={`/listing-tools/auto-details?template=${template.id}`}>
            <PillButton variant="view">View Details</PillButton>
          </Link>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="bg-surface px-4 py-4">
            {loading && <p className="text-[13px] text-subtle">Loading…</p>}
            {prefillSheet && (
              <div className="space-y-3">
                <div className="flex items-center justify-end gap-2">
                  <SheetUploadButton headers={prefillSheet.headers} onRows={handleRowsChange} />
                  <PillButton
                    variant="download"
                    icon={Download}
                    loading={exporting}
                    onClick={() => runExport({ template: content, groups: ['prefill'], format: 'excel', meta: template })}
                  >
                    Download Sheet
                  </PillButton>
                  <PillButton variant="delete" icon={Trash2} onClick={handleDelete}>Delete Brand</PillButton>
                </div>
                <SheetGrid
                  headers={prefillSheet.headers}
                  rows={prefillSheet.rows}
                  onRowsChange={handleRowsChange}
                  uploadUrl={`/api/listing-tools/${template.id}/images`}
                  selectable
                />
              </div>
            )}
          </td>
        </tr>
      )}
      <BillingGateModal
        gate={gate}
        onClose={closeGate}
        onRetry={() => runExport({ template: content, groups: ['prefill'], format: 'excel', meta: template })}
      />
    </>
  )
}
