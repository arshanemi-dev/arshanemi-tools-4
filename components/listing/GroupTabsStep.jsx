'use client'
import { useState } from 'react'
import { Image as ImageIcon, Type, ListFilter, Key, Pencil, Layers, Plus, Settings, X } from 'lucide-react'

export const UNMAPPED_TAB_ID = 'unmapped'

const TYPE_OPTIONS = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'dropdown', label: 'Dropdown', icon: ListFilter },
  { value: 'image', label: 'Image', icon: ImageIcon },
]

const BADGE_STYLES = {
  [UNMAPPED_TAB_ID]: 'bg-gray-200 text-gray-700',
  compulsory: 'bg-red-100 text-red-800',
  prefill: 'bg-blue-100 text-blue-800',
  optional: 'bg-amber-100 text-amber-800',
}
function badgeClass(tabId) {
  return BADGE_STYLES[tabId] || 'bg-purple-100 text-purple-800'
}

const fieldLabelCls = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wide'

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
export default function GroupTabsStep({ tabs, fields, bulkTargetId, onBulkTargetChange, onUpdateField, onBulkAssign, onRenameTab, onAddTab, allowAddTab = true }) {
  const [newTabName, setNewTabName] = useState('')
  const [editingTabId, setEditingTabId] = useState(null)
  const [tempLabel, setTempLabel] = useState('')
  const [dragOverTabId, setDragOverTabId] = useState(null)

  const [advancedOpenIds, setAdvancedOpenIds] = useState(() => new Set())

  const unmappedFields = fields.filter((f) => f.groupId === UNMAPPED_TAB_ID)

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
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3.5">
          <p className="mb-2 text-[11.5px] font-semibold text-gray-600">
            All headers in this sheet ({fields.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fields.map((f) => {
              const groupLabel = tabs.find((t) => t.id === f.groupId)?.label || f.groupId
              return (
                <span
                  key={f.id}
                  title={`Group: ${groupLabel}`}
                  className={`inline-flex max-w-[220px] items-center gap-1 truncate rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClass(f.groupId)}`}
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
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3.5">
        <label className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-gray-600">
          <Layers className="w-3.5 h-3.5" /> Bulk assign unmapped headers to a target group
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={bulkTargetId}
            onChange={(e) => onBulkTargetChange(e.target.value)}
            className="px-2.5 py-1.5 text-[12.5px] font-semibold text-indigo-600 border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {tabs.map((t) => <option key={t.id} value={t.id}>Target Group: [{t.label}]</option>)}
          </select>
          <span className="text-[11.5px] text-gray-400">{unmappedFields.length} unmapped header{unmappedFields.length === 1 ? '' : 's'} available</span>
        </div>

        {/* Checkbox list, not a native multiple-select — checking a header
            assigns it to the target group immediately (no separate Assign
            button); it then disappears from this list since it's no longer
            Unselected. Each header is its own row, not a cramped native
            option list. */}
        {bulkTargetId !== UNMAPPED_TAB_ID && unmappedFields.length > 0 && (
          <div className="mt-2.5 overflow-hidden rounded-md border border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
              <button type="button" onClick={assignAllUnmapped} className="text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-700">
                Assign all to [{tabs.find((t) => t.id === bulkTargetId)?.label}]
              </button>
              <span className="text-[11.5px] text-gray-400">Check a header to assign it instantly</span>
            </div>

            <div className="max-h-48 divide-y divide-gray-100 overflow-y-auto">
              {unmappedFields.map((f) => (
                <label key={f.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => assignToTarget(f.id)}
                    className="h-3.5 w-3.5 flex-shrink-0 rounded border-gray-300 accent-indigo-600"
                  />
                  <span className="truncate text-[12.5px] text-gray-700">{f.label}</span>
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
          return (
            <div
              key={tab.id}
              className="flex w-[300px] flex-shrink-0 flex-col rounded-lg border border-t-4 border-gray-200 border-t-indigo-500 bg-gray-50"
              style={{ height: '70vh' }}
            >
              <div className="sticky top-0 z-10 rounded-t-md border-b border-gray-200 bg-white px-3.5 py-3">
                {editingTabId === tab.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={tempLabel}
                      onChange={(e) => setTempLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(tab) }}
                      onBlur={() => commitRename(tab)}
                      className="min-w-0 flex-1 rounded border border-indigo-300 px-2 py-1 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => commitRename(tab)}
                      className="rounded bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600"
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
                    className="flex w-full items-center justify-between gap-2 text-left disabled:cursor-default"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-[13.5px] font-semibold text-gray-800">
                      {tab.id !== UNMAPPED_TAB_ID && <Pencil className="w-3 h-3 flex-shrink-0 text-gray-400" />}
                      {tab.label}
                    </span>
                    <span className="shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10.5px] font-bold text-gray-600">{colFields.length}</span>
                  </button>
                )}
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); if (dragOverTabId !== tab.id) setDragOverTabId(tab.id) }}
                onDragLeave={() => setDragOverTabId((cur) => (cur === tab.id ? null : cur))}
                onDrop={(e) => handleDrop(e, tab.id)}
                className={`flex flex-1 flex-col gap-3 overflow-y-auto rounded-b-md p-3 transition-colors ${isDragOver ? 'bg-indigo-50' : ''}`}
              >
                {colFields.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-center text-[12px] italic text-gray-400">No headers in this group.</p>
                  </div>
                ) : (
                  colFields.map((field) => (
                    <div
                      key={field.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, field.id)}
                      className="flex cursor-grab flex-col gap-2.5 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
                        <input
                          value={field.label}
                          onChange={(e) => onUpdateField(field.id, { label: e.target.value })}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="min-w-0 flex-1 border-0 bg-transparent px-0 py-0.5 text-[13px] font-semibold text-gray-800 focus:outline-none focus:ring-0"
                        />
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass(field.groupId)}`}>
                          {tab.label}
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
                          className={`flex shrink-0 items-center gap-0.5 rounded p-1 ${advancedOpenIds.has(field.id) ? 'bg-gray-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                        >
                          {field.isUniqueKeyPart && <Key className="w-3 h-3 text-indigo-500" />}
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className={fieldLabelCls}>Field Type</label>
                        <div className="flex w-fit items-center gap-0.5 rounded-md bg-gray-100 p-0.5">
                          {TYPE_OPTIONS.map((t) => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => onUpdateField(field.id, { dataType: t.value, ...(t.value !== 'dropdown' ? { dropdownColumn: '' } : {}) })}
                              title={t.label}
                              className={`flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                                field.dataType === t.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              <t.icon className="w-3 h-3" /> {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Only shown for dropdown-type fields — hidden entirely
                          otherwise, instead of a dashed "—" placeholder. No
                          source-column picker — just the values themselves,
                          editable per field: type + Enter adds a value, the
                          × on any chip removes it. Still auto-seeded from a
                          matched Dropdown Reference Sheet column on upload
                          (see buildFields), just not re-pickable here. */}
                      {field.dataType === 'dropdown' && (
                        <div className="flex flex-col gap-1.5">
                          <label className={fieldLabelCls}>Dropdown Values</label>
                          <div className="rounded-md border border-gray-200 bg-gray-50 p-1.5">
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
                              className="w-full px-2 py-1 text-[12px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                            {(field.dropdownValues || []).length > 0 ? (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {field.dropdownValues.map((v, i) => (
                                  <span key={`${v}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-700">
                                    {v}
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={() => onUpdateField(field.id, { dropdownValues: field.dropdownValues.filter((_, idx) => idx !== i) })}
                                      className="text-gray-400 hover:text-red-500"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1 text-[11px] text-gray-400">No values yet — type one above.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {advancedOpenIds.has(field.id) && (
                        <div className="flex flex-col gap-1.5 rounded-md border border-gray-100 bg-gray-50 p-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Advanced Settings</p>
                          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-gray-600 select-none">
                            <input
                              type="checkbox"
                              checked={!!field.isUniqueKeyPart}
                              onChange={(e) => onUpdateField(field.id, { isUniqueKeyPart: e.target.checked })}
                              className="h-3.5 w-3.5 rounded border-gray-300 accent-indigo-600"
                            />
                            <Key className="w-3 h-3" /> Unique key part
                          </label>
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
