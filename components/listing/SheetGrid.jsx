'use client'
import { Filter, ChevronDown } from 'lucide-react'
import ComboboxCell from './ComboboxCell'
import ImageCell from './ImageCell'

function isRowEmpty(row) {
  return Object.values(row || {}).every((v) => v === undefined || v === null || String(v).trim() === '')
}

// Dense spreadsheet grid over `headers`/`rows` — the one component every
// Listing Tools page renders. Typing into the current last row appends a
// fresh blank one (always-one-trailing-empty-row); every other row-shape
// concern (SKU assignment, uniqueness, dropdown source) lives one layer up
// since it needs template-level context this component doesn't have.
export default function SheetGrid({
  headers,
  rows,
  onRowsChange,
  uploadUrl,
  selectable = false,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  activeFilterHeaderId,
  filterValue = '',
  onFilterChange,
  readOnly = false,
}) {
  const sortedHeaders = [...headers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  function updateCell(rowIndex, headerId, value) {
    const next = rows.map((r, i) => (i === rowIndex ? { ...r, [headerId]: value } : r))
    const isLastRow = rowIndex === rows.length - 1
    if (isLastRow && !isRowEmpty(next[rowIndex])) {
      next.push(Object.fromEntries(sortedHeaders.map((h) => [h.id, ''])))
    }
    onRowsChange(next)
  }

  const selectableRowIndexes = rows.map((r, i) => i).filter((i) => !isRowEmpty(rows[i]))
  const allSelected = selectable && selectableRowIndexes.length > 0 && selectableRowIndexes.every((i) => selectedIds.includes(i))

  return (
    <div className="overflow-auto border border-gray-200 rounded-lg bg-white">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-white">
            {selectable && (
              <th className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600"
                />
              </th>
            )}
            {sortedHeaders.map((h) => (
              <th key={h.id} className="border-b border-r border-gray-200 px-3 py-2.5 text-left font-semibold text-gray-800 whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span title={h.description || undefined}>{h.label}</span>
                  {h.dataType === 'dropdown' && <ChevronDown className="w-3 h-3 text-gray-400" />}
                  {onFilterChange && h.isUniqueKeyPart && (
                    <button
                      type="button"
                      onClick={() => onFilterChange(h.id)}
                      className={`transition-colors ${activeFilterHeaderId === h.id ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-500'}`}
                    >
                      <Filter className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {activeFilterHeaderId === h.id && (
                  <input
                    autoFocus
                    value={filterValue}
                    onChange={(e) => onFilterChange(h.id, e.target.value)}
                    placeholder="Filter…"
                    className="mt-1 w-full px-1.5 py-0.5 text-[11.5px] font-normal border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50/80 group">
              {selectable && (
                <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-b border-r border-gray-200 px-3 py-2">
                  {!isRowEmpty(row) && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(rowIndex)}
                      onChange={() => onToggleSelect?.(rowIndex)}
                      className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600"
                    />
                  )}
                </td>
              )}
              {sortedHeaders.map((h) => (
                <td key={h.id} className="border-b border-r border-gray-200 p-0 align-middle">
                  {h.dataType === 'image' ? (
                    <ImageCell value={row[h.id]} onChange={(url) => updateCell(rowIndex, h.id, url)} uploadUrl={uploadUrl} disabled={readOnly} />
                  ) : h.dataType === 'dropdown' ? (
                    <ComboboxCell value={row[h.id] || ''} options={h.dropdownSource?.values || []} onChange={(v) => updateCell(rowIndex, h.id, v)} disabled={readOnly} />
                  ) : (
                    <input
                      type="text"
                      value={row[h.id] ?? ''}
                      onChange={(e) => updateCell(rowIndex, h.id, e.target.value)}
                      disabled={readOnly}
                      className="w-full min-w-[110px] px-3 py-2 bg-transparent text-gray-800 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-400 disabled:text-gray-400"
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
