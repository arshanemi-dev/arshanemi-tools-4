'use client'
import { useEffect, useState } from 'react'
import { Search, Play, PlayCircle, Pencil, Trash2, Plus, Loader2, Check, X, Eye, EyeOff, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/components/admin/Toast'

const titleBtnCls = 'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full'
const addBtnCls = `${titleBtnCls} bg-[#16a34a] text-white hover:bg-[#128a3e]`
const deleteBtnCls = `${titleBtnCls} border border-[#e59a9a] text-[#d14343] hover:bg-[#fdeeee]`
const eyeBtnCls = `${titleBtnCls} text-subtle hover:bg-card-hover`

// One collapsible section — used 4 times below for Header Mapping / Mapping
// Rule (both backed by /api/listing-tools/mapping/rules, split by `kind`)
// and Header Place / Place Rule (/api/listing-tools/mapping/place-rules).
function RuleSection({ title, apiBase, kind, onApply, onSaveNew, refreshToken, showApplyAll }) {
  const { addToast } = useToast()
  const [items, setItems] = useState(null)
  const [search, setSearch] = useState('')
  const [hidden, setHidden] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [applyingAll, setApplyingAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${apiBase}?kind=${kind}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { rules: [] }))
      .then((data) => { if (!cancelled) setItems(data.rules || []) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [apiBase, kind, refreshToken])

  const filtered = (items || []).filter((r) => !search.trim() || r.name.toLowerCase().includes(search.toLowerCase()))

  async function handleDelete(id) {
    if (!window.confirm('Delete this saved item?')) return
    setBusyId(id)
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setItems((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteAll() {
    if (!items || items.length === 0) return
    if (!window.confirm(`Delete all ${items.length} saved item(s) under "${title}"? This can't be undone.`)) return
    setDeletingAll(true)
    try {
      for (const item of items) {
        try { await fetch(`${apiBase}/${item.id}`, { method: 'DELETE' }) } catch { /* best-effort */ }
      }
      setItems([])
    } finally {
      setDeletingAll(false)
    }
  }

  async function handleApplyAll() {
    if (!items || items.length === 0) { addToast('Nothing saved to apply yet.', 'error'); return }
    setApplyingAll(true)
    try {
      // Sequential, not Promise.all — each apply mutates shared parent state
      // (mappedHeaders) via functional setState, and running them one after
      // another avoids two applies racing over the same in-flight state.
      for (const item of items) await onApply(item)
    } finally {
      setApplyingAll(false)
    }
  }

  function startRename(item) {
    setRenamingId(item.id)
    setRenameDraft(item.name)
  }

  async function commitRename(id) {
    const name = renameDraft.trim()
    if (!name) return
    setBusyId(id)
    try {
      const res = await fetch(`${apiBase}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Rename failed')
      setItems((prev) => prev.map((r) => (r.id === id ? data.rule : r)))
      setRenamingId(null)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="border-b border-divider pb-3 mb-3">
      <div className="flex items-center justify-between gap-1.5 px-2 pt-2">
        <h3 className="min-w-0 truncate text-[12.5px] font-semibold text-foreground">{title}</h3>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setHidden(!hidden)}
            title={hidden ? `Show ${title}` : `Hide ${title}`}
            className={eyeBtnCls}
          >
            {hidden ? <EyeOff className="h-3.5 w-3.5 text-subtle" /> : <Eye className="h-3.5 w-3.5 text-[#16a34a]" />}
          </button>
          {showApplyAll && (
            <button
              type="button"
              onClick={handleApplyAll}
              disabled={applyingAll}
              title={`Apply every saved ${title} in order`}
              className="flex h-6 items-center gap-1 rounded-full bg-[#16a34a] px-2 text-[10.5px] font-semibold text-white hover:bg-[#128a3e] disabled:opacity-60"
            >
              {applyingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
              Apply Rules
            </button>
          )}
          <button type="button" onClick={onSaveNew} title={`Save the current arrangement as a new ${title}`} className={addBtnCls}>
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={handleDeleteAll} disabled={deletingAll} title={`Delete every saved ${title}`} className={deleteBtnCls}>
            {deletingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </div>
      {!hidden && (
        <>
          <div className="relative mx-2 mt-1.5 mb-1.5">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md border border-divider bg-background pl-6 pr-2 py-1 text-[12px] outline-none focus:border-accent-light"
            />
          </div>
          {items === null ? (
            <p className="px-2 text-[11.5px] text-subtle">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 text-[11.5px] italic text-subtle">Nothing saved yet.</p>
          ) : (
        <ul className="space-y-0.5">
          {filtered.map((item) => (
            <li key={item.id} className="group flex items-center gap-1 rounded-md px-2 py-1 hover:bg-card-hover">
              {renamingId === item.id ? (
                <>
                  <input
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitRename(item.id)}
                    autoFocus
                    className="min-w-0 flex-1 rounded border border-divider bg-background px-1.5 py-0.5 text-[12px] outline-none focus:border-accent-light"
                  />
                  <button type="button" onClick={() => commitRename(item.id)} disabled={busyId === item.id} className="text-emerald-600">
                    {busyId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  </button>
                  <button type="button" onClick={() => setRenamingId(null)} className="text-subtle">
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground" title={item.name}>
                    {item.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onApply(item)}
                    title="Apply"
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-accent opacity-0 group-hover:opacity-100 hover:bg-accent/10"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startRename(item)}
                    title="Rename"
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-subtle opacity-0 group-hover:opacity-100 hover:bg-card-hover"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={busyId === item.id}
                    title="Delete"
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[#d14343] opacity-0 group-hover:opacity-100 hover:bg-[#fdeeee]"
                  >
                    {busyId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
        </>
      )}
    </div>
  )
}

// "Our Headers" — the global canonical dictionary. The title's + adds a new
// blank, editable row (click it again for another — several can be open at
// once); type a name and confirm to create it. Existing headers get the
// same rename/delete affordances the rule sections already have. The
// search box still supports the quicker "type a name that doesn't exist,
// press Enter" shortcut too.
function OurHeadersSection({ ourHeaders, onCreateHeader, onRenameHeader, onDeleteHeader, onDeleteAllHeaders, creating }) {
  const [search, setSearch] = useState('')
  const [hidden, setHidden] = useState(false)
  const [drafts, setDrafts] = useState([]) // [{tempId, text}]
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [deletingAll, setDeletingAll] = useState(false)

  const q = search.trim().toLowerCase()
  const filtered = ourHeaders.filter((h) => h.label.toLowerCase().includes(q))
  const exactMatch = ourHeaders.some((h) => h.label.toLowerCase() === q)

  function commitSearchCreate() {
    if (!search.trim() || exactMatch || creating) return
    onCreateHeader(search.trim())
    setSearch('')
  }

  function addDraftRow() {
    setDrafts((prev) => [...prev, { tempId: `draft_${Date.now()}_${prev.length}`, text: '' }])
  }
  function updateDraft(tempId, text) {
    setDrafts((prev) => prev.map((d) => (d.tempId === tempId ? { ...d, text } : d)))
  }
  function removeDraft(tempId) {
    setDrafts((prev) => prev.filter((d) => d.tempId !== tempId))
  }
  function commitDraft(tempId) {
    const draft = drafts.find((d) => d.tempId === tempId)
    if (!draft?.text.trim()) return
    onCreateHeader(draft.text.trim())
    removeDraft(tempId)
  }

  function startEdit(h) {
    setEditingId(h.id)
    setEditDraft(h.label)
  }
  async function commitEdit(id) {
    const label = editDraft.trim()
    if (!label) return
    setBusyId(id)
    try {
      await onRenameHeader(id, label)
      setEditingId(null)
    } finally {
      setBusyId(null)
    }
  }
  async function handleDelete(id) {
    if (!window.confirm('Delete this header?')) return
    setBusyId(id)
    try {
      await onDeleteHeader(id)
    } finally {
      setBusyId(null)
    }
  }
  async function handleDeleteAll() {
    setDeletingAll(true)
    try {
      await onDeleteAllHeaders()
    } finally {
      setDeletingAll(false)
    }
  }

  return (
    <div className="border-b border-divider pb-3 mb-3">
      <div className="flex items-center justify-between gap-1.5 px-2 pt-2">
        <h3 className="text-[12.5px] font-semibold text-foreground">Our Headers</h3>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setHidden(!hidden)}
            title={hidden ? "Show Our Headers" : "Hide Our Headers"}
            className={eyeBtnCls}
          >
            {hidden ? <EyeOff className="h-3.5 w-3.5 text-subtle" /> : <Eye className="h-3.5 w-3.5 text-[#16a34a]" />}
          </button>
          <button type="button" onClick={addDraftRow} title="Add a new header" className={addBtnCls}>
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={handleDeleteAll} disabled={deletingAll || ourHeaders.length === 0} title="Delete every header" className={`${deleteBtnCls} disabled:opacity-40`}>
            {deletingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
      </div>
      {!hidden && (
        <>
          <div className="relative mx-2 mt-1.5 mb-1.5">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-subtle" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitSearchCreate()}
          placeholder="Search or type to create…"
          className="w-full rounded-md border border-divider bg-background pl-6 pr-2 py-1 text-[12px] outline-none focus:border-accent-light"
        />
      </div>
      {q && !exactMatch && (
        <button
          type="button"
          onClick={commitSearchCreate}
          disabled={creating}
          className="mx-2 mb-1.5 flex w-[calc(100%-1rem)] items-center gap-1 rounded-md border border-dashed border-accent/40 px-2 py-1 text-[11.5px] text-accent-hover hover:bg-accent/5 disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Create &ldquo;{search.trim()}&rdquo;
        </button>
      )}
      <ul className="max-h-52 space-y-0.5 overflow-y-auto">
        {drafts.map((d) => (
          <li key={d.tempId} className="flex items-center gap-1 rounded-md px-2 py-1">
            <input
              value={d.text}
              onChange={(e) => updateDraft(d.tempId, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitDraft(d.tempId)}
              autoFocus
              placeholder="New header name…"
              className="min-w-0 flex-1 rounded border border-divider bg-background px-1.5 py-0.5 text-[12px] outline-none focus:border-accent-light"
            />
            <button type="button" onClick={() => commitDraft(d.tempId)} disabled={creating} className="text-emerald-600">
              <Check className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => removeDraft(d.tempId)} className="text-subtle">
              <X className="h-3 w-3" />
            </button>
          </li>
        ))}
        {filtered.length === 0 && drafts.length === 0 ? (
          <p className="px-2 text-[11.5px] italic text-subtle">No headers yet.</p>
        ) : (
          filtered.map((h) => (
            <li key={h.id} className="group flex items-center gap-1 rounded-md px-2 py-1 hover:bg-card-hover">
              {editingId === h.id ? (
                <>
                  <input
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitEdit(h.id)}
                    autoFocus
                    className="min-w-0 flex-1 rounded border border-divider bg-background px-1.5 py-0.5 text-[12px] outline-none focus:border-accent-light"
                  />
                  <button type="button" onClick={() => commitEdit(h.id)} disabled={busyId === h.id} className="text-emerald-600">
                    {busyId === h.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-subtle">
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground" title={h.label}>
                    {h.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(h)}
                    title="Rename"
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-subtle opacity-0 group-hover:opacity-100 hover:bg-card-hover"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(h.id)}
                    disabled={busyId === h.id}
                    title="Delete"
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[#d14343] opacity-0 group-hover:opacity-100 hover:bg-[#fdeeee]"
                  >
                    {busyId === h.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </>
              )}
            </li>
          ))
        )}
      </ul>
        </>
      )}
    </div>
  )
}

// "Templates" — every template currently in the working set (selected on
// the list page before arriving here, added via the + picker below, or
// just created in this session). Single-select: clicking one loads it into
// the naming/sheet-selector/mapping panels on the right.
// Task 2: display finalName when available (marketplace_cat1…cat6_version).
// Task 3: the marketplace name is the first underscore-separated token of
// finalName (composeFinalName always writes marketplaceName first).
function TemplatesSection({ templates, activeTemplateId, onSelectTemplate }) {
  const [search, setSearch] = useState('')
  const [hidden, setHidden] = useState(false)

  // Search against both finalName and templateName so nothing gets lost.
  const filtered = templates.filter((t) => {
    const q = search.toLowerCase()
    return (
      (t.finalName || t.templateName || '').toLowerCase().includes(q) ||
      (t.templateName || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="border-b border-divider pb-3 mb-3">
      <div className="flex items-center justify-between gap-1.5 px-2 pt-2">
        <h3 className="text-[12.5px] font-semibold text-foreground">Templates</h3>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setHidden(!hidden)}
            title={hidden ? "Show Templates" : "Hide Templates"}
            className={eyeBtnCls}
          >
            {hidden ? <EyeOff className="h-3.5 w-3.5 text-subtle" /> : <Eye className="h-3.5 w-3.5 text-[#16a34a]" />}
          </button>
        </div>
      </div>
      {!hidden && (
        <>

      <div className="relative mx-2 mt-1.5 mb-1.5">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-subtle" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-md border border-divider bg-background pl-6 pr-2 py-1 text-[12px] outline-none focus:border-accent-light"
        />
      </div>
      <ul className="max-h-52 space-y-0.5 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-2 text-[11.5px] italic text-subtle">No templates yet.</p>
        ) : (
          filtered.map((t) => {
            // Task 2: prefer finalName (marketplace_cat1…_version) over
            // the raw internal templateName.
            // Task 3: the first underscore-separated token of finalName is
            // always the marketplace name (composeFinalName writes it first).
            const displayName = t.finalName || t.templateName || ''
            const firstToken = displayName.split('_')[0] || ''
            const rest = displayName.slice(firstToken.length + 1) // everything after first _
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelectTemplate(t.id)}
                  title={displayName}
                  className={`w-full rounded-md px-2 py-1 text-left ${
                    t.id === activeTemplateId ? 'bg-[#16a34a]/10 font-semibold text-[#16a34a]' : 'text-foreground hover:bg-card-hover'
                  }`}
                >
                  {firstToken ? (
                    <span className="block truncate text-[12.5px] font-semibold hidden">{firstToken}</span>
                  ) : null}
                  {rest ? (
                    <span className="block truncate text-[12.5px] font-semibold">{firstToken}_{rest}</span>
                  ) : null}
                  {!firstToken && !rest ? (
                    <span className="block truncate text-[12.5px]">{displayName}</span>
                  ) : null}
                </button>
              </li>
            )
          })
        )}
      </ul>
        </>
      )}
    </div>
  )
}

function UploadedSheetsSection({ uploadedFiles, onClearUpload }) {
  const [hidden, setHidden] = useState(false)
  const [search, setSearch] = useState('')

  if (!uploadedFiles || uploadedFiles.length === 0) return null

  const filtered = uploadedFiles.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="border-b border-divider pb-3 mb-3">
      <div className="flex items-center justify-between gap-1.5 px-2 pt-2">
        <h3 className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5 min-w-0 truncate">
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">Uploaded Sheets ({uploadedFiles.length})</span>
        </h3>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setHidden(!hidden)}
            title={hidden ? "Show Uploaded Sheets" : "Hide Uploaded Sheets"}
            className={eyeBtnCls}
          >
            {hidden ? <EyeOff className="h-3.5 w-3.5 text-subtle" /> : <Eye className="h-3.5 w-3.5 text-[#16a34a]" />}
          </button>
          {onClearUpload && (
            <button
              type="button"
              onClick={onClearUpload}
              title="Remove uploaded sheets"
              className={deleteBtnCls}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {!hidden && (
        <>
          {uploadedFiles.length > 3 && (
            <div className="relative mx-2 mt-1.5 mb-1.5">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sheets…"
                className="w-full rounded-md border border-divider bg-background pl-6 pr-2 py-1 text-[12px] outline-none focus:border-accent-light"
              />
            </div>
          )}
          <ul className="max-h-48 space-y-1 overflow-y-auto px-2 mt-1.5">
            {filtered.map((item, idx) => (
              <li key={idx} className="rounded-md border border-divider/60 bg-background p-1.5 text-[12px]">
                <div className="font-semibold text-foreground truncate flex items-center gap-1.5" title={item.name}>
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </div>
                {item.sheets && item.sheets.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 pl-4">
                    {item.sheets.map((s, sIdx) => (
                      <span key={sIdx} className="inline-block rounded bg-card px-1.5 py-0.5 text-[10.5px] text-subtle border border-divider/40">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// Templates + Our Headers (above), then the four rule/preset sections:
// Header Mapping/Mapping Rule (kind=preset/rule on listing_mapping_rules)
// and Header Place/Place Rule (kind=preset/rule on listing_place_rules) —
// matching the sidebar in the original mockup. Mapping Rule/Place Rule get
// an extra title-row "Apply Rules" button that runs every saved rule in
// that section at once; every section's title gets a blue + and a delete.
export default function BulkRuleSidebar({
  ourHeaders, onCreateHeader, onRenameHeader, onDeleteHeader, onDeleteAllHeaders, creatingHeader,
  templates, activeTemplateId, onSelectTemplate,
  uploadedFiles, onClearUpload,
  onApplyMappingPreset, onApplyMappingRule, onApplyPlacePreset, onApplyPlaceRule,
  onSaveMappingPreset, onSaveMappingRule, onSavePlacePreset, onSavePlaceRule,
  refreshToken,
}) {
  return (
    <aside className="w-full flex-shrink-0 rounded-[7px] border border-divider bg-card sm:w-60">
      <TemplatesSection
        templates={templates}
        activeTemplateId={activeTemplateId}
        onSelectTemplate={onSelectTemplate}
      />
      <UploadedSheetsSection
        uploadedFiles={uploadedFiles}
        onClearUpload={onClearUpload}
      />
      <OurHeadersSection
        ourHeaders={ourHeaders}
        onCreateHeader={onCreateHeader}
        onRenameHeader={onRenameHeader}
        onDeleteHeader={onDeleteHeader}
        onDeleteAllHeaders={onDeleteAllHeaders}
        creating={creatingHeader}
      />
      <RuleSection title="Header Mapping" apiBase="/api/listing-tools/mapping/rules" kind="preset" onApply={onApplyMappingPreset} onSaveNew={onSaveMappingPreset} refreshToken={refreshToken} />
      <RuleSection title="Mapping Rule" apiBase="/api/listing-tools/mapping/rules" kind="rule" onApply={onApplyMappingRule} onSaveNew={onSaveMappingRule} refreshToken={refreshToken} showApplyAll />
      <RuleSection title="Header Place" apiBase="/api/listing-tools/mapping/place-rules" kind="preset" onApply={onApplyPlacePreset} onSaveNew={onSavePlacePreset} refreshToken={refreshToken} />
      <RuleSection title="Place Rule" apiBase="/api/listing-tools/mapping/place-rules" kind="rule" onApply={onApplyPlaceRule} onSaveNew={onSavePlaceRule} refreshToken={refreshToken} showApplyAll />
    </aside>
  )
}
