'use client'
import { useState } from 'react'
import { Image as ImageIcon, Type, ListFilter, Key, Plus } from 'lucide-react'

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

// Section 3 of Template Settings — a flat pool of headers read from the one
// Product Data Sheet, distributed across tabs (the default Compulsory /
// Prefill / Optional groups, plus any custom ones) instead of being
// pre-assigned per source sheet. Mirrors source/10.html's tab strip + bulk
// multi-select + per-row mapping table, with the "Map Target Field" column
// replaced by the field-type toggle / dropdown-source / unique-key columns
// this app's grids (SheetGrid.jsx, ComboboxCell.jsx) actually read.
export default function GroupTabsStep({ tabs, fields, activeTabId, onActiveTabChange, dropdownColumnNames, onUpdateField, onBulkAssign, onAddTab, allowAddTab = true }) {
  const [newTabName, setNewTabName] = useState('')

  const activeFields = fields.filter((f) => f.groupId === activeTabId)
  const unmappedFields = fields.filter((f) => f.groupId === UNMAPPED_TAB_ID)
  const activeTabLabel = tabs.find((t) => t.id === activeTabId)?.label

  function handleBulkSelect(e) {
    const ids = Array.from(e.target.selectedOptions, (o) => o.value)
    if (ids.length === 0) return
    onBulkAssign(ids, activeTabId)
    e.target.selectedIndex = -1
  }

  function handleAddTab() {
    const label = newTabName.trim()
    if (!label) return
    onAddTab(label)
    setNewTabName('')
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 border-b-2 border-gray-200 overflow-x-auto pb-0 flex-wrap">
        {tabs.map((tab) => {
          const count = fields.filter((f) => f.groupId === tab.id).length
          const active = tab.id === activeTabId
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onActiveTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold rounded-t-lg border border-b-0 whitespace-nowrap transition-colors ${
                active ? 'bg-white text-indigo-600 border-gray-200 border-t-2 border-t-indigo-600' : 'bg-gray-100 text-gray-500 border-gray-200 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className="px-1.5 py-0.5 text-[10.5px] font-bold bg-gray-200 text-gray-600 rounded-full">{count}</span>
            </button>
          )
        })}

        {allowAddTab && (
          <div className="flex items-center gap-1.5 pl-1 py-1">
            <input
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTab() }}
              placeholder="New group…"
              className="w-28 px-2 py-1.5 text-[12px] border border-dashed border-emerald-400 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <button
              type="button"
              onClick={handleAddTab}
              disabled={!newTabName.trim()}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-dashed border-emerald-400 rounded-md hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" /> Add Tab
            </button>
          </div>
        )}
      </div>

      {activeTabId !== UNMAPPED_TAB_ID && unmappedFields.length > 0 && (
        <div className="mt-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
          <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">
            Add headers to {activeTabLabel} (hold Ctrl/Cmd to select multiple)
          </label>
          <select multiple size={Math.min(unmappedFields.length, 5)} onChange={handleBulkSelect} className="w-full px-2 py-1.5 text-[12.5px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
            {unmappedFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      )}

      {activeFields.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-gray-400">No headers currently assigned to &quot;{activeTabLabel}&quot;.</p>
      ) : (
        <div className="mt-3 border border-gray-200 border-t-0 rounded-b-lg overflow-x-auto">
          <table className="w-full text-[13px] min-w-[720px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase">Header</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-40">Move to Group</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-52">Field Type</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-56">Dropdown Reference</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase w-20">Unique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {activeFields.map((field) => (
                <tr key={field.id}>
                  <td className="px-4 py-2.5 align-top">
                    <input
                      value={field.label}
                      onChange={(e) => onUpdateField(field.id, { label: e.target.value })}
                      className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${badgeClass(field.groupId)}`}>
                      {activeTabLabel}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <select
                      value={field.groupId}
                      onChange={(e) => onUpdateField(field.id, { groupId: e.target.value })}
                      className="w-full px-2 py-1.5 text-[12.5px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    >
                      {tabs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-md w-fit">
                      {TYPE_OPTIONS.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => onUpdateField(field.id, { dataType: t.value, ...(t.value !== 'dropdown' ? { dropdownColumn: '' } : {}) })}
                          title={t.label}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-medium transition-colors ${
                            field.dataType === t.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <t.icon className="w-3 h-3" /> {t.label}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    {field.dataType === 'dropdown' ? (
                      dropdownColumnNames.length > 0 ? (
                        <select
                          value={field.dropdownColumn || ''}
                          onChange={(e) => onUpdateField(field.id, { dropdownColumn: e.target.value })}
                          className="w-full px-2 py-1.5 text-[12.5px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                          <option value="">Use values from…</option>
                          {dropdownColumnNames.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className="text-[12px] text-gray-400">No dropdown sheet loaded</span>
                      )
                    ) : (
                      <span className="text-[12px] text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <label className="flex items-center gap-1 text-gray-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!field.isUniqueKeyPart}
                        onChange={(e) => onUpdateField(field.id, { isUniqueKeyPart: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600"
                      />
                      <Key className="w-3 h-3" />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
