'use client'
import { useState } from 'react'
import { ArrowRight, Play, Loader2, X, Pencil, Save, CopyPlus, Check, Minus } from 'lucide-react'
import BulkPlaceGrid, { moveHeaderInList } from './BulkPlaceGrid'

// Mapping entries render as boxes of at most this many, 4 per row (1/2 on
// narrower screens), overflow wrapping onto the next row — instead of one
// long scrolling list.
const MAPPING_BOX_SIZE = 20

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

const pillCls = 'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold disabled:opacity-60'
const outlinePillCls = `${pillCls} border border-divider bg-card text-foreground hover:bg-card-hover`

// Preview of a saved Header Mapping/Mapping Rule (sheetHeader -> our header,
// in boxes of MAPPING_BOX_SIZE) or Header Place/Place Rule (the real
// placement grid, BulkPlaceGrid — same sections/colours/cards as live
// placement) — shown above the section it belongs to when its name is
// clicked in the sidebar.
//
// Edit → edits a local draft (mapping: re-point or remove an entry; place:
// drag exactly like live placement, dropping into Others removes it), then
// Save (overwrite this rule, `onSave(entries)`) or Save As (name input →
// NEW rule, `onSaveAs(name, entries)`). Both resolve true on success. The
// parent keys this panel by rule id, so switching rules resets the draft.
export default function RulePreviewPanel({ type, rule, ourHeaders, onApply, applying, onClose, onSave, onSaveAs, ruleNamePrefix }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState([])
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [busy, setBusy] = useState(null) // 'save' | 'saveAs' | null

  if (!rule) return null

  function labelFor(ourHeaderId) {
    return ourHeaders.find((h) => h.id === ourHeaderId)?.label || ourHeaderId
  }

  const entries = editing ? draft : (rule.entries || [])

  // Rule names always carry their marketplace prefix (same convention as
  // the sidebar's own add row) — the rule's own marketplace first, else the
  // current one.
  const prefix = rule.marketplaceName ? `${rule.marketplaceName.trim()}_` : (ruleNamePrefix || '')
  const typedName = saveAsName.trim()
  const hasPrefix = !prefix || typedName.toLowerCase().startsWith(prefix.toLowerCase())
  const finalSaveAsName = hasPrefix ? typedName : `${prefix}${typedName}`
  const saveAsValid = typedName && typedName.toLowerCase() !== prefix.toLowerCase() && finalSaveAsName !== rule.name

  function startEdit() {
    setDraft((rule.entries || []).map((e, idx) => ({ ...e, position: e.position ?? idx })))
    setEditing(true)
  }
  function cancelEdit() {
    setEditing(false)
    setSaveAsOpen(false)
    setDraft([])
  }
  function cleanEntries() {
    return type === 'mapping'
      ? draft.filter((e) => e.sheetHeader && e.ourHeaderId).map((e) => ({ sheetHeader: e.sheetHeader, ourHeaderId: e.ourHeaderId, matchType: e.matchType || 'exact' }))
      : draft.filter((e) => e.group).map((e) => ({ ourHeaderId: e.ourHeaderId, group: e.group, position: e.position ?? 0, uiBucket: e.uiBucket || null }))
  }
  async function handleSave() {
    setBusy('save')
    const ok = await onSave?.(cleanEntries())
    setBusy(null)
    if (ok) cancelEdit()
  }
  function openSaveAs() {
    setSaveAsName(`${rule.name}_copy`)
    setSaveAsOpen(true)
  }
  async function commitSaveAs() {
    if (!saveAsValid) return
    setBusy('saveAs')
    const ok = await onSaveAs?.(finalSaveAsName, cleanEntries())
    setBusy(null)
    if (ok) cancelEdit()
  }

  const placeHeaders = type === 'place'
    ? entries.map((e, idx) => ({ ...e, position: e.position ?? idx, uiBucket: e.uiBucket || null, ourHeaderLabel: labelFor(e.ourHeaderId) }))
    : []

  return (
    <div className="mb-3 rounded-[7px] border border-accent/30 bg-accent/5 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-[13px] font-semibold text-foreground" title={rule.name}>
          {rule.name}
          {editing && <span className="ml-1.5 text-[11px] font-medium text-accent">— editing</span>}
        </h3>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {editing ? (
            <>
              <button type="button" onClick={handleSave} disabled={!!busy} title="Overwrite this rule with your changes" className={`${pillCls} bg-[#16a34a] text-white hover:bg-[#128a3e]`}>
                {busy === 'save' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </button>
              <button type="button" onClick={openSaveAs} disabled={!!busy} title="Save your changes as a new rule" className={outlinePillCls}>
                <CopyPlus className="h-3 w-3" />
                Save As
              </button>
              <button type="button" onClick={cancelEdit} disabled={!!busy} title="Discard changes" className={outlinePillCls}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {onApply && (
                <button type="button" onClick={onApply} disabled={applying} className={`${pillCls} bg-[#16a34a] text-white hover:bg-[#128a3e]`}>
                  {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  Apply
                </button>
              )}
              {onSave && (
                <button type="button" onClick={startEdit} title="Edit this rule" className={outlinePillCls}>
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}
              <button type="button" onClick={onClose} title="Close preview" className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-subtle hover:bg-card-hover">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {editing && saveAsOpen && (
        <div className="mb-2 flex items-center gap-1.5">
          <input
            value={saveAsName}
            onChange={(e) => setSaveAsName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitSaveAs(); if (e.key === 'Escape') setSaveAsOpen(false) }}
            autoFocus
            placeholder={`${prefix}New rule name`}
            className="min-w-0 max-w-sm flex-1 rounded-md border border-divider bg-background px-2 py-1 text-[12px] outline-none focus:border-accent-light"
          />
          <button type="button" onClick={commitSaveAs} disabled={!saveAsValid || !!busy} title={saveAsValid ? `Create "${finalSaveAsName}"` : 'Enter a new name'} className={`${pillCls} bg-accent text-white hover:opacity-90`}>
            {busy === 'saveAs' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Create
          </button>
          <button type="button" onClick={() => setSaveAsOpen(false)} title="Cancel Save As" className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-subtle hover:bg-card-hover">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {editing && (
        <p className="mb-2 text-[11.5px] text-subtle">
          {type === 'mapping'
            ? 'Pick a different Our Header to re-point an entry, or − to remove it from this rule.'
            : 'Drag to reorder or move between sections, same as placement — drop into Others to remove it from this rule.'}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-[12px] italic text-subtle">{editing ? 'No entries left — Save would empty this rule.' : 'This rule has no saved entries.'}</p>
      ) : type === 'mapping' ? (
        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {chunk(entries, MAPPING_BOX_SIZE).map((box, bi) => (
            <div key={bi} className="min-w-0 rounded-md border border-divider bg-card p-2">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-subtle">
                {bi * MAPPING_BOX_SIZE + 1}–{bi * MAPPING_BOX_SIZE + box.length} of {entries.length}
              </p>
              <div className="space-y-1 pr-0.5">
                {box.map((e, idx) => {
                  const i = bi * MAPPING_BOX_SIZE + idx
                  return (
                    <div key={`${e.sheetHeader}-${i}`} className="flex items-center gap-1.5 rounded-md border border-divider/60 bg-background px-2 py-1 text-[12px]">
                      <span className="min-w-0 flex-1 truncate text-foreground" title={e.sheetHeader}>{e.sheetHeader}</span>
                      <ArrowRight className="h-3 w-3 flex-shrink-0 text-subtle" />
                      {editing ? (
                        <>
                          <select
                            value={e.ourHeaderId}
                            onChange={(ev) => { const id = ev.target.value; setDraft((prev) => prev.map((d, j) => (j === i ? { ...d, ourHeaderId: id } : d))) }}
                            title={labelFor(e.ourHeaderId)}
                            className="min-w-0 flex-1 truncate rounded border border-divider bg-background px-1 py-0.5 text-[11.5px] font-medium text-accent outline-none focus:border-accent-light"
                          >
                            {!ourHeaders.some((h) => h.id === e.ourHeaderId) && <option value={e.ourHeaderId}>{e.ourHeaderId}</option>}
                            {ourHeaders.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => setDraft((prev) => prev.filter((_, j) => j !== i))}
                            title="Remove from this rule"
                            className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-[#d14343] hover:text-[#a83232]"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <span className="min-w-0 flex-1 truncate font-medium text-accent" title={labelFor(e.ourHeaderId)}>{labelFor(e.ourHeaderId)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <BulkPlaceGrid
          headers={placeHeaders}
          readOnly={!editing}
          onMove={(id, group, uiBucket, beforeId, after) => setDraft((prev) => moveHeaderInList(prev, id, group, uiBucket, beforeId, after))}
        />
      )}
    </div>
  )
}
