'use client'
import { useState } from 'react'
import { Plus, Search, Trash2, Loader2 } from 'lucide-react'
import { ConfirmDialog } from './BulkRuleSidebar'

// Our Headers on the right side (shown while the sidebar's "Our Headers"
// section is open) — the global header dictionary in boxes of at most
// BOX_SIZE, 5 per row (fewer on narrower screens), overflow wrapping onto
// the next row, same idea as a Mapping Rule's preview boxes. Add/delete go
// through the page's own handleCreateHeader/handleDeleteHeader, so the
// sidebar list and this panel always show the same headers.
const BOX_SIZE = 20

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export default function OurHeadersPanel({ ourHeaders, onCreateHeader, onDeleteHeader, creating }) {
  const [search, setSearch] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [confirmState, setConfirmState] = useState(null) // { message, onConfirm } | null

  const q = search.trim().toLowerCase()
  const filtered = q ? ourHeaders.filter((h) => h.label.toLowerCase().includes(q)) : ourHeaders
  const trimmedNew = newLabel.trim()
  const duplicate = !!trimmedNew && ourHeaders.some((h) => h.label.trim().toLowerCase() === trimmedNew.toLowerCase())
  const canAdd = !!trimmedNew && !duplicate && !creating

  async function handleAdd() {
    if (!canAdd) return
    const ok = await onCreateHeader(trimmedNew)
    if (ok !== false) setNewLabel('')
  }

  function handleDelete(h) {
    setConfirmState({
      message: `Delete "${h.label}" from Our Headers?`,
      onConfirm: async () => {
        setBusyId(h.id)
        try {
          await onDeleteHeader(h.id)
        } finally {
          setBusyId(null)
        }
      },
    })
  }
  function handleConfirm() {
    const action = confirmState?.onConfirm
    setConfirmState(null)
    action?.()
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-foreground">
          Our Headers <span className="text-[12px] font-normal text-subtle">({q ? `${filtered.length} of ${ourHeaders.length}` : ourHeaders.length})</span>
        </h2>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md border border-divider bg-background py-1 pl-6 pr-2 text-[12px] outline-none focus:border-accent-light"
            />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder="New header name…"
              title={duplicate ? 'A header with this name already exists' : undefined}
              className={`min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-[12px] outline-none sm:w-48 sm:flex-none ${
                duplicate ? 'border-[#d14343]' : 'border-divider focus:border-accent-light'
              }`}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              title={duplicate ? 'Already in Our Headers' : 'Add to Our Headers'}
              className="flex flex-shrink-0 items-center gap-1 rounded-full bg-[#16a34a] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#128a3e] disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add
            </button>
          </div>
        </div>
      </div>
      {duplicate && <p className="-mt-1 mb-2 text-right text-[11px] text-[#d14343]">&quot;{trimmedNew}&quot; is already in Our Headers.</p>}

      {filtered.length === 0 ? (
        <p className="rounded-[7px] border border-divider p-3 text-[12px] italic text-subtle">
          {ourHeaders.length === 0 ? 'No headers yet — add one above.' : 'No headers match your search.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {chunk(filtered, BOX_SIZE).map((box, bi) => (
            <div key={bi} className="min-w-0 rounded-md border border-divider bg-card p-2">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-subtle">
                {bi * BOX_SIZE + 1}–{bi * BOX_SIZE + box.length} of {filtered.length}
              </p>
              <div className="space-y-1">
                {box.map((h) => (
                  <div key={h.id} className="flex items-center gap-1 rounded-md border border-divider/60 bg-background px-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-foreground" title={h.label}>{h.label}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(h)}
                      disabled={busyId === h.id}
                      title="Delete"
                      className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-[#d14343] hover:text-[#a83232] disabled:opacity-50"
                    >
                      {busyId === h.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={() => setConfirmState(null)} />
    </div>
  )
}
