'use client'
import { useState } from 'react'
import { Image as ImageIcon, Type, ListFilter, ListChecks, Calculator, Key, Lock, Pencil, Layers, Plus, Settings, X, Trash2, Copy, ClipboardPaste } from 'lucide-react'

export const UNMAPPED_TAB_ID = 'unmapped'

const TYPE_OPTIONS = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'dropdown', label: 'Dropdown', icon: ListFilter },
  { value: 'multiselect', label: 'Multi Select', icon: ListChecks },
  { value: 'formula', label: 'Formula', icon: Calculator },
  { value: 'image', label: 'Image', icon: ImageIcon },
]
// Dropdown and Multi Select both edit the same `dropdownValues` option list
// (see the "Dropdown Values" card section below) — Multi Select just lets
// the fill-time cell hold more than one of them at once.
const DROPDOWN_LIKE_TYPES = ['dropdown', 'multiselect']

// Every class string below is written out in full (never built with
// template-string interpolation) so Tailwind's build actually generates it —
// a dynamically-assembled class like `border-t-${color}-500` would work in
// dev but silently vanish from the production CSS since Tailwind can't see
// a literal class name to scan for.
const COLOR_PALETTE = {
  gray: { border: 'border-t-divider-light', dot: 'bg-subtle', badge: 'bg-card-hover text-muted' },
  indigo: { border: 'border-t-accent', dot: 'bg-accent', badge: 'bg-accent/15 text-accent-hover' },
  purple: { border: 'border-t-purple-500', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-800' },
  red: { border: 'border-t-red-500', dot: 'bg-red-500', badge: 'bg-red-100 text-red-800' },
  blue: { border: 'border-t-blue-500', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800' },
  amber: { border: 'border-t-amber-500', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
  emerald: { border: 'border-t-emerald-500', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
  pink: { border: 'border-t-pink-500', dot: 'bg-pink-500', badge: 'bg-pink-100 text-pink-800' },
  orange: { border: 'border-t-orange-500', dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800' },
  teal: { border: 'border-t-teal-500', dot: 'bg-teal-500', badge: 'bg-teal-100 text-teal-800' },
}
// Sensible starting color per group, same family the badges always used —
// the picker lets you override any of these per column.
const DEFAULT_TAB_COLOR = {
  [UNMAPPED_TAB_ID]: 'gray',
  design_system: 'purple',
  compulsory: 'red',
  prefill: 'blue',
  optional: 'amber',
}

const fieldLabelCls = 'text-[11px] font-semibold text-subtle uppercase tracking-wide'

// Identity badge (per the user's ask: "some identity mentioned this is
// default headers... this is created... this is by sheets") — where a
// header actually came from: a built-in default (defaultHeaders.json), the
// uploaded Product Data Sheet, or hand-added via "+ Add Header". Set on
// every field by TemplateSettingsWizard.jsx (buildFields/addHeaderToGroup/
// withDefaultHeaders), read-only here — purely informational, never edited
// from the card itself.
const SOURCE_LABEL = { default: 'Default', upload: 'From Sheet', manual: 'Manual' }
const SOURCE_BADGE_CLS = {
  default: 'bg-purple-100 text-purple-700',
  upload: 'bg-card-hover text-muted',
  manual: 'bg-emerald-100 text-emerald-700',
}

// Section 3 of Template Settings — a Kanban board (source/11.html's "CRM
// Kanban Multi-Column View"): every group renders as its own column,
// side-by-side, instead of one active tab at a time. Cards move between
// columns two ways only — dragging a card onto another column (plain HTML5
// drag events, no DnD library needed) or the bulk-assign toolbar above the
// board (picks several still-Unselected headers at once). There's no
// per-card "Move to Group" select anymore; drag-and-drop replaced it.
// Column titles are click-to-rename inline, matching 11.html's pencil-icon
// rename — see TemplateSettingsWizard's `tabLabels` for why this only ever
// changes the display label, never the group id fields are stored under.
export default function GroupTabsStep({ tabs, fields, bulkTargetId, onBulkTargetChange, onUpdateField, onBulkAssign, onRenameTab, onAddTab, onRemoveTab, onAddHeader, onDeleteHeader, allowAddTab = true }) {
  const [newTabName, setNewTabName] = useState('')
  const [editingTabId, setEditingTabId] = useState(null)
  const [tempLabel, setTempLabel] = useState('')
  const [dragOverTabId, setDragOverTabId] = useState(null)

  const [advancedOpenIds, setAdvancedOpenIds] = useState(() => new Set())
  const [tabColors, setTabColors] = useState({}) // { [tabId]: colorKey } — overrides DEFAULT_TAB_COLOR, UI-only
  const [colorPickerOpenId, setColorPickerOpenId] = useState(null)
  // Copy/Paste dropdown options across fields — a plain array of strings,
  // not the OS clipboard, so it works the same regardless of browser
  // clipboard permissions and never leaves this board. Shared across every
  // card/column so "Copy" on one field's options and "Paste" on any other
  // dropdown-like field (same or different group) just works.
  const [copiedValues, setCopiedValues] = useState(null)

  const unmappedFields = fields.filter((f) => f.groupId === UNMAPPED_TAB_ID)

  function colorFor(tabId) {
    return tabColors[tabId] || DEFAULT_TAB_COLOR[tabId] || 'indigo'
  }
  function badgeClassFor(tabId) {
    return COLOR_PALETTE[colorFor(tabId)].badge
  }
  function setTabColor(tabId, colorKey) {
    setTabColors((prev) => ({ ...prev, [tabId]: colorKey }))
    setColorPickerOpenId(null)
  }

  // Checking a header assigns it to the target group immediately — no
  // separate "Assign" confirm button. The row disappears from this list on
  // the next render since it's no longer Unselected.
  function assignToTarget(fieldId) {
    onBulkAssign([fieldId], bulkTargetId)
  }
  function assignAllUnmapped() {
    if (unmappedFields.length === 0) return
    onBulkAssign(unmappedFields.map((f) => f.id), bulkTargetId)
  }

  function toggleAdvanced(fieldId) {
    setAdvancedOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(fieldId)) next.delete(fieldId)
      else next.add(fieldId)
      return next
    })
  }

  function handleAddTab() {
    const label = newTabName.trim()
    if (!label) return
    onAddTab(label)
    setNewTabName('')
  }

  function startRename(tab) {
    if (tab.id === UNMAPPED_TAB_ID) return // staging bucket, not a real saved sheet — nothing to rename
    setEditingTabId(tab.id)
    setTempLabel(tab.label)
  }
  function commitRename(tab) {
    const trimmed = tempLabel.trim()
    setEditingTabId(null)
    if (!trimmed || trimmed === tab.label) return
    onRenameTab(tab.id, trimmed)
  }

  function handleDragStart(e, fieldId) {
    e.dataTransfer.setData('text/plain', fieldId)
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDrop(e, tabId) {
    e.preventDefault()
    setDragOverTabId(null)
    const fieldId = e.dataTransfer.getData('text/plain')
    if (fieldId) onUpdateField(fieldId, { groupId: tabId })
  }

  return (
    <div>
      {/* Full header list from the selected Product Data Sheet, all in one
          place — once headers are dragged into their groups they're spread
          across separate Kanban columns below, so this is the one spot to
          see every column the sheet actually has at a glance. Colored by
          current group so it doubles as a quick "what's mapped where" check. */}
      {fields.length > 1000 && (
        <div className="mb-4 rounded-lg border border-divider bg-card p-3.5">
          <p className="mb-2 text-[11.5px] font-semibold text-muted">
            All headers in this sheet ({fields.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fields.map((f) => {
              const groupLabel = tabs.find((t) => t.id === f.groupId)?.label || f.groupId
              return (
                <span
                  key={f.id}
                  title={`Group: ${groupLabel}`}
                  className={`inline-flex max-w-[220px] items-center gap-1 truncate rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClassFor(f.groupId)}`}
                >
                  {f.label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Bulk-assign toolbar — dropdown picks the target group instead of a
          clicked "active tab" (every group is already visible at once below) */}
      <div className="mb-4 rounded-lg border border-divider bg-surface p-3.5">
        <label className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted">
          <Layers className="w-3.5 h-3.5" /> Bulk assign unmapped headers to a target group
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={bulkTargetId}
            onChange={(e) => onBulkTargetChange(e.target.value)}
            className="px-2.5 py-1.5 text-[12.5px] font-semibold text-accent border border-divider rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-accent-light"
          >
            {tabs.map((t) => <option key={t.id} value={t.id}>Target Group: [{t.label}]</option>)}
          </select>
          <span className="text-[11.5px] text-subtle">{unmappedFields.length} unmapped header{unmappedFields.length === 1 ? '' : 's'} available</span>
        </div>

        {/* Checkbox list, not a native multiple-select — checking a header
            assigns it to the target group immediately (no separate Assign
            button); it then disappears from this list since it's no longer
            Unselected. Each header is its own row, not a cramped native
            option list. */}
        {bulkTargetId !== UNMAPPED_TAB_ID && unmappedFields.length > 0 && (
          <div className="mt-2.5 overflow-hidden rounded-md border border-divider bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-divider px-3 py-2">
              <button type="button" onClick={assignAllUnmapped} className="text-[11.5px] font-semibold text-accent hover:text-accent-hover">
                Assign all to [{tabs.find((t) => t.id === bulkTargetId)?.label}]
              </button>
              <span className="text-[11.5px] text-subtle">Check a header to assign it instantly</span>
            </div>

            <div className="max-h-48 divide-y divide-divider overflow-y-auto">
              {unmappedFields.map((f) => (
                <label key={f.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => assignToTarget(f.id)}
                    className="h-3.5 w-3.5 flex-shrink-0 rounded border-divider-light accent-accent"
                  />
                  <span className="truncate text-[12.5px] text-muted">{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Kanban board — every group column visible side-by-side */}
      <div className="flex items-start gap-4 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const colFields = fields.filter((f) => f.groupId === tab.id)
          const isDragOver = dragOverTabId === tab.id
          const colorKey = colorFor(tab.id)
          return (
            <div
              key={tab.id}
              className={`flex w-[300px] flex-shrink-0 flex-col rounded-lg border border-t-4 border-divider bg-surface ${COLOR_PALETTE[colorKey].border}`}
              style={{ height: '70vh' }}
            >
              <div className="sticky top-0 z-10 rounded-t-md border-b border-divider bg-card px-3.5 py-3">
                <div className="flex items-center gap-2">
                  {editingTabId === tab.id ? (
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <input
                        autoFocus
                        value={tempLabel}
                        onChange={(e) => setTempLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(tab) }}
                        onBlur={() => commitRename(tab)}
                        className="min-w-0 flex-1 rounded border border-accent-light px-2 py-1 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-accent-light"
                      />
                      <button
                        type="button"
                        onClick={() => commitRename(tab)}
                        className="rounded bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-emerald-600"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startRename(tab)}
                      disabled={tab.id === UNMAPPED_TAB_ID}
                      title={tab.id === UNMAPPED_TAB_ID ? undefined : 'Click to rename group'}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left disabled:cursor-default"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-[13.5px] font-semibold text-foreground">
                        {tab.id !== UNMAPPED_TAB_ID && <Pencil className="w-3 h-3 flex-shrink-0 text-subtle" />}
                        {tab.label}
                      </span>
                      <span className="shrink-0 rounded-full bg-card-hover px-1.5 py-0.5 text-[10.5px] font-bold text-muted">{colFields.length}</span>
                    </button>
                  )}

                  {/* Color picker — right end of the column header. Sets this
                      column's top-border/badge color; UI preference only,
                      not saved with the template. */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setColorPickerOpenId((cur) => (cur === tab.id ? null : tab.id))}
                      title="Change group color"
                      className={`h-4 w-4 rounded-full ring-1 ring-inset ring-foreground/10 ${COLOR_PALETTE[colorKey].dot}`}
                    />
                    {colorPickerOpenId === tab.id && (
                      <div className="absolute right-0 top-full z-20 mt-1 grid w-[124px] grid-cols-5 gap-1.5 rounded-lg border border-divider bg-card p-2 shadow-lg">
                        {Object.keys(COLOR_PALETTE).map((key) => (
                          <button
                            key={key}
                            type="button"
                            title={key}
                            onClick={() => setTabColor(tab.id, key)}
                            className={`h-5 w-5 rounded-full ${COLOR_PALETTE[key].dot} ${colorKey === key ? 'ring-2 ring-offset-1 ring-subtle' : ''}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Remove group — any group can go except Unselected
                      (the staging bucket, not a real column). Any header
                      sitting in it moves back to Unselected first, never
                      dropped — see TemplateSettingsWizard's removeTab. */}
                  {tab.id !== UNMAPPED_TAB_ID && (
                    <button
                      type="button"
                      onClick={() => onRemoveTab(tab.id)}
                      title="Remove this group"
                      className="flex-shrink-0 rounded p-1 text-subtle hover:bg-red-50 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); if (dragOverTabId !== tab.id) setDragOverTabId(tab.id) }}
                onDragLeave={() => setDragOverTabId((cur) => (cur === tab.id ? null : cur))}
                onDrop={(e) => handleDrop(e, tab.id)}
                className={`flex flex-1 flex-col gap-3 overflow-y-auto rounded-b-md p-3 transition-colors ${isDragOver ? 'bg-accent/10' : ''}`}
              >
                {/* Add a brand-new header directly into this group — not
                    extracted from the upload, just a manually-added field
                    you rename/configure afterward. */}
                <button
                  type="button"
                  onClick={() => onAddHeader(tab.id)}
                  className="flex w-full flex-shrink-0 items-center justify-center gap-1 rounded-md border border-dashed border-divider-light px-2 py-1.5 text-[11.5px] font-medium text-subtle hover:border-accent-light hover:text-accent"
                >
                  <Plus className="w-3 h-3" /> Add Header
                </button>

                {colFields.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-center text-[12px] italic text-subtle">No headers in this group.</p>
                  </div>
                ) : (
                  colFields.map((field) => (
                    <div
                      key={field.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, field.id)}
                      className="flex cursor-grab flex-col gap-2.5 rounded-lg border border-divider bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-divider pb-2">
                        <input
                          value={field.label}
                          onChange={(e) => onUpdateField(field.id, { label: e.target.value })}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="min-w-0 flex-1 border-0 bg-transparent px-0 py-0.5 text-[13px] font-semibold text-foreground focus:outline-none focus:ring-0"
                        />
                        <span
                          title="Where this header came from"
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${SOURCE_BADGE_CLS[field.source] || SOURCE_BADGE_CLS.upload}`}
                        >
                          {SOURCE_LABEL[field.source] || 'From Sheet'}
                        </span>
                        {/* Advanced settings toggle — right side of the card.
                            Unique key part lives behind this now instead of
                            always taking up card space; the small key icon
                            stays visible as a glanceable "is unique" marker
                            even while the panel is collapsed. */}
                        <button
                          type="button"
                          onClick={() => toggleAdvanced(field.id)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Advanced settings"
                          className={`flex shrink-0 items-center gap-0.5 rounded p-1 ${advancedOpenIds.has(field.id) ? 'bg-card-hover text-accent' : 'text-subtle hover:bg-card-hover hover:text-muted'}`}
                        >
                          {field.isUniqueKeyPart && <Key className="w-3 h-3 text-accent" />}
                          {field.disabled && <Lock className="w-3 h-3 text-accent" />}
                          <Settings className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete this header entirely — not a move to
                            Unselected, the field is gone. No confirm dialog,
                            matching the same plain-click convention as
                            removing a whole group column above. */}
                        <button
                          type="button"
                          onClick={() => onDeleteHeader(field.id)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Delete this header"
                          className="flex shrink-0 items-center rounded p-1 text-subtle hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Instructional note the source cell carried alongside
                          the title (see splitHeaderCell in
                          TemplateSettingsWizard.jsx) — shown here so it's
                          obviously not lost, not welded onto the label above. */}
                      {field.description && (
                        <p className="line-clamp-2 text-[11px] italic text-subtle" title={field.description}>
                          {field.description}
                        </p>
                      )}

                      <div className="flex flex-col gap-1">
                        <label className={fieldLabelCls}>Field Type</label>
                        {/* Grid, not a single flex row — 5 types (was 3) no
                            longer fit on one line inside a fixed 300px card
                            without wrapping/overflowing, so each button gets
                            its own cell and wraps to more rows instead. */}
                        <div className="grid grid-cols-2 gap-1 rounded-md bg-card-hover p-1">
                          {TYPE_OPTIONS.map((t) => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => onUpdateField(field.id, {
                                dataType: t.value,
                                ...(DROPDOWN_LIKE_TYPES.includes(t.value) ? {} : { dropdownColumn: '' }),
                                ...(t.value === 'formula' ? {} : { formula: '' }),
                              })}
                              title={t.label}
                              className={`flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors truncate ${
                                field.dataType === t.value ? 'bg-card text-accent shadow-sm' : 'text-subtle hover:text-muted'
                              }`}
                            >
                              <t.icon className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Shown for both dropdown-like types (plain Dropdown
                          and Multi Select share the same option list) —
                          hidden entirely otherwise, instead of a dashed "—"
                          placeholder. No source-column picker — just the
                          values themselves, editable per field: type + Enter
                          adds a value, the × on any chip removes it. Still
                          auto-seeded from a matched Dropdown Reference Sheet
                          column on upload (see buildFields), just not
                          re-pickable here. */}
                      {DROPDOWN_LIKE_TYPES.includes(field.dataType) && (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <label className={fieldLabelCls}>Dropdown Values</label>
                            {/* Copy this field's whole option list, Paste it
                                onto any other dropdown-like field — saves
                                retyping the same values (e.g. Size options)
                                across several headers by hand. Paste
                                replaces the target's current list outright,
                                same as a normal copy/paste would. */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setCopiedValues(field.dropdownValues || [])}
                                onMouseDown={(e) => e.stopPropagation()}
                                disabled={!(field.dropdownValues || []).length}
                                title="Copy these options"
                                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium text-subtle hover:bg-card-hover hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-subtle"
                              >
                                <Copy className="w-3 h-3" /> Copy
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateField(field.id, { dropdownValues: [...copiedValues] })}
                                onMouseDown={(e) => e.stopPropagation()}
                                disabled={!copiedValues}
                                title={copiedValues ? `Paste ${copiedValues.length} value${copiedValues.length === 1 ? '' : 's'}` : 'Copy a dropdown\'s values first'}
                                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-medium text-subtle hover:bg-card-hover hover:text-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-subtle"
                              >
                                <ClipboardPaste className="w-3 h-3" /> Paste
                              </button>
                            </div>
                          </div>
                          <div className="rounded-md border border-divider bg-surface p-1.5">
                            <input
                              type="text"
                              placeholder="Type a value, press Enter to add…"
                              onMouseDown={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key !== 'Enter') return
                                e.preventDefault()
                                const v = e.target.value.trim()
                                if (!v) return
                                const existing = field.dropdownValues || []
                                if (existing.includes(v)) { e.target.value = ''; return }
                                onUpdateField(field.id, { dropdownValues: [...existing, v] })
                                e.target.value = ''
                              }}
                              className="w-full px-2 py-1 text-[12px] border border-divider rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-accent-light"
                            />
                            {(field.dropdownValues || []).length > 0 ? (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {field.dropdownValues.map((v, i) => (
                                  <span key={`${v}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-divider bg-card px-2 py-0.5 text-[11px] text-muted">
                                    {v}
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={() => onUpdateField(field.id, { dropdownValues: field.dropdownValues.filter((_, idx) => idx !== i) })}
                                      className="text-subtle hover:text-red-500"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1 text-[11px] text-subtle">No values yet — type one above.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Formula fields are computed, never typed by hand at
                          fill time — the value shown live-recalculates from
                          [Column Label] references against that same row
                          (components/listing/formula.js). References are by
                          label text, not header id, so they read naturally
                          ("[Cost] * 1.5") but silently stop resolving if the
                          referenced column is later renamed. */}
                      {field.dataType === 'formula' && (
                        <div className="flex flex-col gap-1.5">
                          <label className={fieldLabelCls}>Formula</label>
                          <input
                            type="text"
                            value={field.formula || ''}
                            onChange={(e) => onUpdateField(field.id, { formula: e.target.value })}
                            onMouseDown={(e) => e.stopPropagation()}
                            placeholder="e.g. [MRP] * 1.5  or  [Col1] power [Col2]"
                            className="w-full px-2 py-1.5 text-[12px] border border-divider rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-accent-light"
                          />
                          <p className="text-[11px] text-subtle">
                            Reference other columns by name in brackets. Supports +, -, *, /, ^ (or the word &quot;power&quot;), and parentheses.
                          </p>
                        </div>
                      )}

                      {advancedOpenIds.has(field.id) && (
                        <div className="flex flex-col gap-2 rounded-md border border-divider bg-surface p-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle">Advanced Settings</p>
                          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted select-none">
                            <input
                              type="checkbox"
                              checked={!!field.isUniqueKeyPart}
                              onChange={(e) => onUpdateField(field.id, { isUniqueKeyPart: e.target.checked })}
                              className="h-3.5 w-3.5 rounded border-divider-light accent-accent"
                            />
                            <Key className="w-3 h-3" /> Unique key part
                          </label>

                          {/* Locks this header's cell at fill time — can't be
                              typed/clicked into anywhere it's rendered (Auto
                              Listing/Product Details/Prefill Details). Meant
                              for columns that only ever get their value from
                              elsewhere (a connected-header cascade, a
                              cross-group sync) — never from someone directly
                              editing this cell. */}
                          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted select-none">
                            <input
                              type="checkbox"
                              checked={!!field.disabled}
                              onChange={(e) => onUpdateField(field.id, { disabled: e.target.checked })}
                              className="h-3.5 w-3.5 rounded border-divider-light accent-accent"
                            />
                            <Lock className="w-3 h-3" /> Disabled (read-only at fill time)
                          </label>

                          {/* Connect this header to a header in a different
                              group — at fill time, picking an existing
                              record via that group's own unique-key header
                              auto-fills this one. See
                              components/listing/linkedHeaders.js. */}
                          <div className="flex flex-col gap-1">
                            <label className={fieldLabelCls}>Auto-fill from</label>
                            <div className="flex gap-1.5">
                              <select
                                value={field.linkedGroup || ''}
                                onChange={(e) => onUpdateField(field.id, { linkedGroup: e.target.value || null, linkedHeaderId: null })}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="min-w-0 flex-1 rounded-md border border-divider bg-card px-1.5 py-1 text-[11.5px] focus:outline-none focus:ring-1 focus:ring-accent-light"
                              >
                                <option value="">Not connected</option>
                                {tabs.filter((t) => t.id !== field.groupId && t.id !== UNMAPPED_TAB_ID).map((t) => (
                                  <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                              </select>
                              {field.linkedGroup && (
                                <select
                                  value={field.linkedHeaderId || ''}
                                  onChange={(e) => onUpdateField(field.id, { linkedHeaderId: e.target.value || null })}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="min-w-0 flex-1 rounded-md border border-divider bg-card px-1.5 py-1 text-[11.5px] focus:outline-none focus:ring-1 focus:ring-accent-light"
                                >
                                  <option value="">Pick a header…</option>
                                  {fields.filter((f) => f.groupId === field.linkedGroup).map((f) => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}

        {allowAddTab && (
          <div className="flex w-[220px] flex-shrink-0 flex-col gap-1.5 pt-1">
            <input
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTab() }}
              placeholder="New group…"
              className="w-full rounded-md border border-dashed border-emerald-400 px-2 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <button
              type="button"
              onClick={handleAddTab}
              disabled={!newTabName.trim()}
              className="flex items-center justify-center gap-1 rounded-md border border-dashed border-emerald-400 bg-emerald-50 px-2.5 py-2 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="w-3 h-3" /> Add Group Column
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
