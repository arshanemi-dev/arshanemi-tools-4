'use client'

import { useState } from 'react'
import { Check, Link2, Loader2, Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import Modal from '@/components/admin/Modal'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { useToast } from '@/components/admin/Toast'
import { DEFAULT_LIST_SORT, matchesQuery } from '@/lib/listSort'
import ListSearchSort from './ListSearchSort'
import HeaderMappingTable from './HeaderMappingTable'
import { describeHeaderUsage, isHeaderUsed, listNames } from './ourHeaderUsage'

const btn = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium'

// What deleting an already-mapped Our Header really does, for the delete
// confirms below: the fields saved templates got from it are copies and stay,
// but nothing can map onto it any more — saved rules skip it, so every
// template made from then on comes out without that field in Auto Listing.
const mappedEffect = (many) => (many
  ? "If you delete them, Auto Listing is affected: saved rules will skip them and new templates won't have these fields (templates already saved keep them). This can't be undone."
  : "If you delete it, Auto Listing is affected: saved rules will skip it and new templates won't have this field (templates already saved keep it). This can't be undone.")
// Shown ahead of the plain confirm when the check itself couldn't be completed.
const uncheckedNote = (many) => (many
  ? "Couldn't check whether any of them is already mapped — if one is, deleting it affects Auto Listing. "
  : "Couldn't check whether it's already mapped — if it is, deleting it affects Auto Listing. ")

// Add / Edit one Our Header's name in a popup (tools-5's HeaderEditModal
// look). Type / dropdown defaults / unique key stay in the existing Header
// settings popup — "More settings" jumps there. Mounted per open, so the
// input always starts from the header's current name.
function HeaderNameModal({ header, isDuplicate, saving, onClose, onSave, onOpenSettings }) {
  const [name, setName] = useState(header?.label || '')
  const trimmed = name.trim()
  const dup = !!trimmed && isDuplicate(trimmed, header?.id)
  const canSave = !!trimmed && !dup && !saving
  const save = () => { if (canSave) onSave(trimmed) }

  return (
    <Modal
      open
      onClose={onClose}
      title={header ? `Edit Header — ${header.label}` : 'Add Header'}
      maxWidth="max-w-lg"
      footer={(
        <div className="flex w-full items-center justify-end gap-2">
          {header && onOpenSettings && (
            <button type="button" onClick={() => onOpenSettings(header.id)} className="mr-auto inline-flex items-center gap-1.5 text-[12.5px] font-medium text-subtle hover:text-foreground">
              <Settings size={13} /> More settings
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-full border border-divider px-4 py-1.5 text-[13px] font-medium text-muted hover:bg-card-hover">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!canSave} className="inline-flex items-center gap-1.5 rounded-full bg-action px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-action-hover disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
          </button>
        </div>
      )}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted">Header name</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          placeholder="Enter Header name"
          title={dup ? 'A header with this name already exists' : undefined}
          className={`rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none ${dup ? 'border-neg focus:border-neg' : 'border-divider focus:border-accent'}`}
        />
        {dup && <span className="text-[11.5px] text-neg">&ldquo;{trimmed}&rdquo; is already in Our Headers.</span>}
      </label>
    </Modal>
  )
}

// Our Headers + Header Mapping in one section — tools-5's Header section UI
// on top of the bulk page's own handlers (create / rename / delete / map /
// unmap all go through BulkTemplateDesign.jsx, unchanged):
//   - Toolbar: Add (always); with an Our Header ticked, Edit (name popup),
//     Settings (the existing Header settings popup) and Delete; Delete All;
//     then Mapped.
//   - HeaderMappingTable: tick ONE Our Header + any sheet headers, press
//     Mapped — they map onto it; × on a box unmaps. Rows also carry their
//     own Settings / inline rename / Delete.
//   - Search + Name / Created sort narrow and order the Our Header rows (the
//     search is the same text as the table's Our Header column filter).
// `showMapping` false (sidebar's Header Mapping eye off) leaves just the
// Our Headers list — no sheet columns, no Mapped button.
// `sheets` — every uploaded sheet with its own headers ([{ id, name,
// headers }], the page's sheetsIndex): the table shows one column per sheet.
//
// Deleting asks `onCheckHeaderUsage(ids)` first (→ { usage: {[id]: {templates,
// rules, mappedHere}}, complete }, see ourHeaderUsage.js): a header that's
// already mapped — in a saved template, a saved rule, or the mapping on
// screen — gets an "already mapped" warning instead of the plain confirm.
export default function HeaderMappingSection({
  title, showMapping = true, ourHeaders, creating,
  onCreateHeader, onRenameHeader, onDeleteHeader, onDeleteAllHeaders, onCheckHeaderUsage, onOpenHeaderSettings,
  unmappedRawHeaders, commonHeaderKeys, sheets, mappedHeaders, onMap, onUnmap, onOpenColumnSettings, onOpenRawHeaderSettings,
  categoryForOurHeaderId, categoryOrder,
}) {
  const { addToast } = useToast()
  const [activeId, setActiveId] = useState(null)
  const [checked, setChecked] = useState(() => new Set()) // raw sheet header labels
  const [modal, setModal] = useState(null) // { mode: 'add' } | { mode: 'edit', id }
  const [savingName, setSavingName] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deleteCheck, setDeleteCheck] = useState(null) // onCheckHeaderUsage's answer for whichever delete confirm is open
  const [busyId, setBusyId] = useState(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const [checkingAll, setCheckingAll] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(DEFAULT_LIST_SORT)
  const [selectLabel, setSelectLabel] = useState(null) // a just-added header to tick once it lands in ourHeaders

  const active = ourHeaders.find((h) => h.id === activeId) || null
  const deleteTarget = ourHeaders.find((h) => h.id === deleteId) || null
  const editTarget = modal?.mode === 'edit' ? ourHeaders.find((h) => h.id === modal.id) : null
  const isDuplicate = (label, exceptId) => ourHeaders.some((h) => h.id !== exceptId && h.label.trim().toLowerCase() === label.trim().toLowerCase())
  const liveChecked = [...checked].filter((h) => unmappedRawHeaders.includes(h))
  // What the open delete confirm has to say, from the usage answer it opened with.
  const deleteUsed = deleteTarget ? describeHeaderUsage(deleteCheck?.usage?.[deleteTarget.id]) : ''
  const usedHeaders = deleteAllOpen ? ourHeaders.filter((h) => isHeaderUsed(deleteCheck?.usage?.[h.id])) : []
  const unchecked = !!deleteCheck && !deleteCheck.complete

  // Tick the header just added (tools-5 behaviour) once the page's list has it.
  if (selectLabel) {
    const added = ourHeaders.find((h) => h.label.trim().toLowerCase() === selectLabel)
    if (added) {
      setSelectLabel(null)
      setActiveId(added.id)
    }
  }

  const onToggleCheck = (label) => setChecked((prev) => {
    const next = new Set(prev)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    return next
  })

  function mapChecked() {
    if (!active || !liveChecked.length) return
    for (const h of liveChecked) onMap(h, active.id)
    setChecked(new Set())
    addToast(`${liveChecked.length} header${liveChecked.length === 1 ? '' : 's'} mapped to “${active.label}”.`, 'success')
  }

  async function saveName(label) {
    setSavingName(true)
    try {
      const ok = modal?.mode === 'edit' ? await onRenameHeader(modal.id, label) : await onCreateHeader(label)
      if (ok === false) return
      if (modal?.mode !== 'edit') setSelectLabel(label.toLowerCase())
      setModal(null)
    } finally {
      setSavingName(false)
    }
  }

  async function rename(id, label) {
    setBusyId(id)
    try {
      return await onRenameHeader(id, label)
    } finally {
      setBusyId(null)
    }
  }

  // Where the given headers are in use, or null when the page gave no way to ask.
  async function checkUsage(ids) {
    if (!onCheckHeaderUsage) return null
    try {
      return await onCheckHeaderUsage(ids)
    } catch {
      return { usage: {}, complete: false }
    }
  }

  // Every Delete goes through here: the check runs first (the row shows its
  // spinner meanwhile), then the confirm opens already knowing what to say.
  async function requestDelete(id) {
    if (busyId) return
    setBusyId(id)
    const check = await checkUsage([id])
    setBusyId(null)
    setDeleteCheck(check)
    setDeleteId(id)
  }

  async function requestDeleteAll() {
    if (checkingAll) return
    setCheckingAll(true)
    const check = await checkUsage(ourHeaders.map((h) => h.id))
    setCheckingAll(false)
    setDeleteCheck(check)
    setDeleteAllOpen(true)
  }

  async function confirmDelete() {
    const id = deleteTarget?.id
    setDeleteId(null)
    if (!id) return
    setBusyId(id)
    try {
      await onDeleteHeader(id)
      if (id === activeId) setActiveId(null)
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDeleteAll() {
    setDeleteAllOpen(false)
    setDeletingAll(true)
    try {
      await onDeleteAllHeaders()
      setActiveId(null)
    } finally {
      setDeletingAll(false)
    }
  }

  const openSettings = (id) => {
    setModal(null)
    onOpenHeaderSettings(id)
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-foreground">{title}</h2>

      <div className="space-y-4 rounded-xl border border-divider bg-background py-4">
        {/* Toolbar — Add always; Edit / Settings / Delete once an Our Header is ticked; then Mapped */}
        <div className="flex flex-wrap items-center gap-2 px-4">
          <button type="button" onClick={() => setModal({ mode: 'add' })} className={`${btn} border-dashed border-divider-light text-action hover:bg-action-soft`}>
            <Plus size={14} /> Add
          </button>
          {active && (
            <>
              <button type="button" onClick={() => setModal({ mode: 'edit', id: active.id })} className={`${btn} border-divider-light text-foreground hover:bg-card-hover`}>
                <Pencil size={13} /> Edit
              </button>
              <button type="button" onClick={() => onOpenHeaderSettings(active.id)} className={`${btn} border-divider-light text-foreground hover:bg-card-hover`}>
                <Settings size={13} /> Settings
              </button>
              <button type="button" onClick={() => requestDelete(active.id)} disabled={!!busyId} className={`${btn} border-neg/40 text-neg hover:bg-neg/10 disabled:opacity-40`}>
                <Trash2 size={13} /> Delete
              </button>
              <span className="max-w-[14rem] truncate text-[12px] text-subtle" title={active.label}>· {active.label}</span>
            </>
          )}
          {showMapping && (
            <>
              <span className="mx-1 hidden h-6 w-px bg-divider sm:block" />
              <button
                type="button"
                onClick={mapChecked}
                disabled={!active || !liveChecked.length}
                title={!active ? 'Tick one Our Header first' : !liveChecked.length ? 'Tick the sheet headers to map' : undefined}
                className="inline-flex items-center gap-1.5 rounded-full bg-action px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-action-hover disabled:opacity-40"
              >
                <Link2 size={14} /> Mapped
              </button>
              {liveChecked.length > 0 && (
                <button type="button" onClick={() => setChecked(new Set())} className="rounded-full px-2 py-1 text-[12px] text-subtle hover:text-foreground">Clear ticks</button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={requestDeleteAll}
            disabled={deletingAll || checkingAll || ourHeaders.length === 0}
            title="Delete every header in Our Headers"
            className={`${btn} ml-auto border-neg/40 text-neg hover:bg-neg/10 disabled:opacity-40`}
          >
            {deletingAll || checkingAll ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete All
          </button>
        </div>

        <p className="px-4 text-[11.5px] text-subtle">
          {!showMapping
            ? 'Tick an Our Header to edit, open its settings or delete it — or use the icons on its row.'
            : active && liveChecked.length
              ? <>Map <span className="font-semibold text-foreground">{liveChecked.length}</span> ticked header{liveChecked.length === 1 ? '' : 's'} into <span className="font-semibold text-foreground">{active.label}</span>.</>
              : 'Tick one Our Header and any sheet headers, then press Mapped. × on a box unmaps it.'}
        </p>

        <ListSearchSort
          className="px-4"
          query={query}
          onQuery={setQuery}
          sort={sort}
          onSort={setSort}
          placeholder="Search headers…"
          shown={ourHeaders.filter((h) => matchesQuery(h.label, query)).length}
          total={ourHeaders.length}
        />

        <HeaderMappingTable
          ourHeaders={ourHeaders}
          mappedHeaders={mappedHeaders}
          unmappedRawHeaders={unmappedRawHeaders}
          commonHeaderKeys={commonHeaderKeys}
          sheets={sheets}
          showMapping={showMapping}
          activeId={activeId}
          onSelect={setActiveId}
          checked={checked}
          onToggleCheck={onToggleCheck}
          onUnmap={onUnmap}
          onRename={rename}
          isDuplicate={isDuplicate}
          onDelete={requestDelete}
          busyId={busyId}
          onOpenHeaderSettings={onOpenHeaderSettings}
          onOpenColumnSettings={onOpenColumnSettings}
          onOpenRawHeaderSettings={onOpenRawHeaderSettings}
          categoryForOurHeaderId={categoryForOurHeaderId}
          categoryOrder={categoryOrder}
          ourQuery={query}
          onOurQuery={setQuery}
          ourSort={sort}
        />
      </div>

      {modal && (modal.mode === 'add' || editTarget) && (
        <HeaderNameModal
          key={modal.mode === 'edit' ? `edit:${modal.id}` : 'add'}
          header={editTarget}
          isDuplicate={isDuplicate}
          saving={savingName || (modal.mode === 'add' && creating)}
          onClose={() => setModal(null)}
          onSave={saveName}
          onOpenSettings={openSettings}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteUsed ? `“${deleteTarget?.label || ''}” is already mapped` : `Delete header “${deleteTarget?.label || ''}”?`}
        description={deleteUsed
          ? `Used in ${deleteUsed}. ${mappedEffect(false)}`
          : `${unchecked ? uncheckedNote(false) : ''}It's removed from Our Headers. This can't be undone.`}
        confirmLabel={deleteUsed ? 'Delete anyway' : 'Delete'}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      <ConfirmDialog
        open={deleteAllOpen}
        title={`Delete all ${ourHeaders.length} header${ourHeaders.length === 1 ? '' : 's'}?`}
        description={usedHeaders.length
          ? `${usedHeaders.length} of them ${usedHeaders.length === 1 ? 'is' : 'are'} already mapped (${listNames(usedHeaders.map((h) => h.label))}). ${mappedEffect(usedHeaders.length > 1)}`
          : `${unchecked ? uncheckedNote(true) : ''}Every header in Our Headers is deleted. This can't be undone.`}
        confirmLabel={usedHeaders.length ? 'Delete All anyway' : 'Delete All'}
        onConfirm={confirmDeleteAll}
        onCancel={() => setDeleteAllOpen(false)}
      />
    </div>
  )
}
