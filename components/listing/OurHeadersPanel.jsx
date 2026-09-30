'use client'
import { useState } from 'react'
import { Plus, Search, Trash2, Loader2, Pencil, Settings, Check, X } from 'lucide-react'
import { ConfirmDialog } from './BulkRuleSidebar'

// Our Headers on the right side (shown while the sidebar's "Our Headers"
// section is open — the sidebar itself only carries the title/eye now) —
// the global header dictionary in boxes of at most BOX_SIZE, 5 per row
// (fewer on narrower screens), overflow wrapping onto the next row. Every
// header gets Settings (OurHeaderSettingsModal), inline Rename and Delete;
// Add and Delete All sit in the title row. All of it goes through the
// page's own handle*Header functions, so the mapping grid always sees the
// same dictionary.
const BOX_SIZE = 20

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

const iconBtnCls = 'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded disabled:opacity-50'

export default function OurHeadersPanel({ ourHeaders, onCreateHeader, onRenameHeader, onDeleteHeader, onDeleteAllHeaders, onOpenSettings, creating }) {
  const [search, setSearch] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [confirmState, setConfirmState] = useState(null) // { message, onConfirm } | null

  const q = search.trim().toLowerCase()
  const filtered = q ? ourHeaders.filter((h) => h.label.toLowerCase().includes(q)) : ourHeaders
  const labelTaken = (label, exceptId) => ourHeaders.some((h) => h.id !== exceptId && h.label.trim().toLowerCase() === label.trim().toLowerCase())

  const trimmedNew = newLabel.trim()
  const duplicate = !!trimmedNew && labelTaken(trimmedNew)
  const canAdd = !!trimmedNew && !duplicate && !creating

  const trimmedEdit = editDraft.trim()
  const editDuplicate = !!editingId && !!trimmedEdit && labelTaken(trimmedEdit, editingId)

  async function handleAdd() {
    if (!canAdd) return
    const ok = await onCreateHeader(trimmedNew)
    if (ok !== false) setNewLabel('')
  }

  function startEdit(h) {
    setEditingId(h.id)
    setEditDraft(h.label)
  }
  async function commitEdit(h) {
    if (!trimmedEdit || editDuplicate) return
    if (trimmedEdit === h.label) { setEditingId(null); return }
    setBusyId(h.id)
    try {
      const ok = await onRenameHeader(h.id, trimmedEdit)
      if (ok !== false) setEditingId(null)
    } finally {
      setBusyId(null)
    }
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
  function handleDeleteAll() {
    if (ourHeaders.length === 0) return
    setConfirmState({
      message: `Delete all ${ourHeaders.length} header(s) in Our Headers? This can't be undone.`,
      onConfirm: async () => {
        setDeletingAll(true)
        try {
          await onDeleteAllHeaders()
        } finally {
          setDeletingAll(false)
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
          <div className="relative min-w-0 flex-1 sm:w-44 sm:flex-none">
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
              className={`min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-[12px] outline-none sm:w-44 sm:flex-none ${
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
          <button
            type="button"
            onClick={handleDeleteAll}
            disabled={deletingAll || ourHeaders.length === 0}
            title="Delete every header"
            className="flex flex-shrink-0 items-center gap-1 rounded-full border border-[#e59a9a] px-3 py-1 text-[12px] font-semibold text-[#d14343] hover:bg-[#fdeeee] disabled:opacity-40"
          >
            {deletingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Delete All
          </button>
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
                    {editingId === h.id ? (
                      <>
                        <input
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(h); if (e.key === 'Escape') setEditingId(null) }}
                          autoFocus
                          title={editDuplicate ? 'Another header already has this name' : undefined}
                          className={`min-w-0 flex-1 rounded border bg-background px-1 py-0.5 text-[12px] outline-none ${
                            editDuplicate ? 'border-[#d14343]' : 'border-divider focus:border-accent-light'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => commitEdit(h)}
                          disabled={busyId === h.id || !trimmedEdit || editDuplicate}
                          title="Save name"
                          className={`${iconBtnCls} text-emerald-600`}
                        >
                          {busyId === h.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} title="Cancel" className={`${iconBtnCls} text-subtle`}>
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground" title={h.label}>{h.label}</span>
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => onOpenSettings(h.id)}
                            title="Header settings — type, dropdown default values, unique key…"
                            className={`${iconBtnCls} text-subtle hover:text-foreground`}
                          >
                            <Settings className="h-3 w-3" />
                          </button>
                        )}
                        <button type="button" onClick={() => startEdit(h)} title="Rename" className={`${iconBtnCls} text-subtle hover:text-foreground`}>
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(h)}
                          disabled={busyId === h.id}
                          title="Delete"
                          className={`${iconBtnCls} text-[#d14343] hover:text-[#a83232]`}
                        >
                          {busyId === h.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </button>
                      </>
                    )}
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
