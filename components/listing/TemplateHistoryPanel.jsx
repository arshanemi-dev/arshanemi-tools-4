'use client'
import { useEffect, useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import Modal from '@/components/admin/Modal'
import PillButton from './PillButton'

const ACTION_LABEL = { save: 'Saved', delete: 'Deleted' }
const GROUP_LABEL = { design_system: 'Product Details', compulsory: 'Compulsory', prefill: 'Prefill', optional: 'Optional', template: 'Template' }

// Read-only audit trail for one template — who saved/deleted which sheet
// and when. Write side is lib/listingHistory.js's fire-and-forget
// recordTemplateHistory, already called on every sheet PATCH/DELETE
// (app/api/listing-tools/[templateId]/route.js, .../sheets/[group]/route.js)
// — this is the first UI that ever reads it back, via the new
// app/api/listing-tools/history proxy route. Opens on demand; not fetched
// until the button is actually clicked.
export default function TemplateHistoryPanel({ templateId }) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState(null)

  useEffect(() => {
    if (!open || history !== null) return
    let cancelled = false
    fetch(`/api/listing-tools/history?templateId=${encodeURIComponent(templateId)}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((data) => { if (!cancelled) setHistory(data.history || []) })
      .catch(() => { if (!cancelled) setHistory([]) })
    return () => { cancelled = true }
  }, [open, history, templateId])

  return (
    <>
      <PillButton variant="ghost" icon={History} onClick={() => setOpen(true)}>
        History
      </PillButton>
      <Modal open={open} onClose={() => setOpen(false)} title="Save History" maxWidth="max-w-lg">
        {history === null && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-subtle" />
          </div>
        )}
        {history !== null && history.length === 0 && (
          <p className="text-sm text-muted text-center py-6">No history yet for this template.</p>
        )}
        {history !== null && history.length > 0 && (
          <ul className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-divider bg-surface px-3 py-2.5 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {ACTION_LABEL[entry.action] || entry.action} — {GROUP_LABEL[entry.sheet_group] || entry.sheet_group}
                  </span>
                  {typeof entry.snapshot_meta?.rowCount === 'number' && (
                    <span className="text-xs text-subtle">{entry.snapshot_meta.rowCount} row{entry.snapshot_meta.rowCount === 1 ? '' : 's'}</span>
                  )}
                </div>
                <span className="text-xs text-subtle flex-shrink-0">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  )
}
