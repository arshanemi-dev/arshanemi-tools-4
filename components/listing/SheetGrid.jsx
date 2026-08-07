'use client'
import { Filter, ChevronDown, Lock } from 'lucide-react'
import ComboboxCell from './ComboboxCell'
import MultiSelectCell from './MultiSelectCell'
import ImageCell from './ImageCell'
import FormulaCell from './FormulaCell'
import AutoGrowTextarea from './AutoGrowTextarea'
import { recomputeFormulas } from './formula'
import { useBulkImageUpload } from './useBulkImageUpload'

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
  // Connected-headers support (components/listing/linkedHeaders.js) — both
  // optional, SheetGrid stays ignorant of what "linked" actually means:
  // `onCellChange` lets a caller react to one cell's edit with more edits in
  // the same row (e.g. auto-filling other columns once a product is
  // matched); `pickerOptions` is a plain {[headerId]: string[]} map of
  // suggested values rendered as a native <datalist> on that column's text
  // input — browsable, but (unlike ComboboxCell) still free-typeable, since
  // a picker header must stay usable for entering a brand-new value too.
  onCellChange,
  pickerOptions = {},
  // Formula-type headers can be authored two places: Template Settings'
  // GroupTabsStep card, or directly here in the column header while looking
  // at real data — optional, since not every SheetGrid caller wants to
  // persist a header edit (e.g. a read-only view).
  onHeaderChange,
}) {
  const sortedHeaders = [...headers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // One shared bulk-upload session for the whole grid — any ImageCell that
  // receives more than one file at once delegates to this instead of its
  // own single-file path, so a multi-select from inside a cell behaves
  // exactly like the dedicated BulkImageDropZone toolbar above the grid:
  // same row-by-row empty-box fill, same capacity check, same progress UI.
  const bulk = useBulkImageUpload({ headers: sortedHeaders, rows, onRowsChange, uploadUrl })

  // Cascade a single cell's new value into the rest of that same row —
  // connected-header auto-fill, then formula recompute (in that order, so a
  // formula referencing a just-auto-filled column sees the fresh value).
  // `headerId` is passed through as the "don't recompute this one" exception
  // (see formula.js's recomputeFormulas) so a user typing directly into a
  // formula cell isn't fought mid-keystroke — every other formula in the row
  // still recalculates unconditionally, in sync with whatever just changed.
  function resolveRow(rowIndex, headerId, value, baseRow) {
    let row = { ...baseRow, [headerId]: value }
    if (onCellChange) {
      const extra = onCellChange(headerId, value, rowIndex, row)
      if (extra) row = { ...row, ...extra }
    }
    const formulaExtra = recomputeFormulas(sortedHeaders, row, headerId)
    if (formulaExtra) row = { ...row, ...formulaExtra }
    return row
  }

  // Appends one blank trailing row once the edited row (only ever the
  // sheet's previous last row) is no longer empty — the usual
  // always-one-trailing-blank-row invariant.
  function withTrailingBlankRow(next, rowIndex) {
    if (rowIndex !== rows.length - 1 || isRowEmpty(next[rowIndex])) return next
    return [...next, Object.fromEntries(sortedHeaders.map((h) => [h.id, '']))]
  }

  // Multi Select stores every picked option as one comma-joined string in
  // this single cell (see MultiSelectCell.jsx) — the grid stays one row per
  // product, easy to browse/edit. That combined value only splits into one
  // row per option at export time (see lib/exports/expandMultiSelectRows.js),
  // never here — this cell is otherwise just a normal cell edit.
  function updateCell(rowIndex, headerId, value) {
    const updatedRow = resolveRow(rowIndex, headerId, value, rows[rowIndex])
    const next = rows.map((r, i) => (i === rowIndex ? updatedRow : r))
    onRowsChange(withTrailingBlankRow(next, rowIndex))
  }

  const selectableRowIndexes = rows.map((r, i) => i).filter((i) => !isRowEmpty(rows[i]))
  const allSelected = selectable && selectableRowIndexes.length > 0 && selectableRowIndexes.every((i) => selectedIds.includes(i))

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {bulk.message && (
        <div className="px-3 py-2 border-b border-gray-200">
          <p className={`text-[11.5px] ${bulk.message.warning ? 'text-red-500 font-medium' : 'text-gray-500'}`}>{bulk.message.text}</p>
        </div>
      )}
      <div className="overflow-auto">
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
                  {(h.dataType === 'dropdown' || h.dataType === 'multiselect') && <ChevronDown className="w-3 h-3 text-gray-400" />}
                  {h.disabled && <Lock className="w-3 h-3 text-gray-400" title="Read-only — filled automatically" />}
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
                {/* Formula headers carry their own editable formula box
                    right here — no need to leave this page and go back to
                    Template Settings to tweak "[MRP] * 1.5" while looking at
                    real filled-in data. Uncontrolled + commit-on-blur/Enter
                    (not onChange-per-keystroke) so typing doesn't fight a
                    parent re-render on every character. */}
                {h.dataType === 'formula' && onHeaderChange && (
                  <input
                    key={h.formula}
                    type="text"
                    defaultValue={h.formula || ''}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    onBlur={(e) => {
                      const next = e.target.value
                      if (next !== (h.formula || '')) onHeaderChange(h.id, { formula: next })
                    }}
                    placeholder="e.g. [MRP] * 1.5"
                    title="Formula — reference other columns as [Column Label]"
                    className="mt-1 w-full px-1.5 py-0.5 text-[11px] font-normal italic border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
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
                    <ImageCell
                      value={row[h.id]}
                      onChange={(url) => updateCell(rowIndex, h.id, url)}
                      uploadUrl={uploadUrl}
                      disabled={readOnly || h.disabled}
                      onMultipleFiles={bulk.handleFiles}
                      bulkStatus={bulk.slotStatus[`${rowIndex}:${h.id}`]}
                    />
                  ) : h.dataType === 'dropdown' ? (
                    <ComboboxCell value={row[h.id] || ''} options={h.dropdownSource?.values || []} onChange={(v) => updateCell(rowIndex, h.id, v)} disabled={readOnly || h.disabled} />
                  ) : h.dataType === 'multiselect' ? (
                    <MultiSelectCell value={row[h.id] || ''} options={h.dropdownSource?.values || []} onChange={(v) => updateCell(rowIndex, h.id, v)} disabled={readOnly || h.disabled} />
                  ) : h.dataType === 'formula' ? (
                    <FormulaCell
                      value={row[h.id]}
                      formula={h.formula}
                      headers={sortedHeaders}
                      row={row}
                      disabled={readOnly || h.disabled}
                      onChange={(v) => updateCell(rowIndex, h.id, v)}
                    />
                  ) : pickerOptions[h.id]?.length ? (
                    // Datalist-driven suggestion needs a real <input> — <textarea> has no `list`
                    // attribute — so picker headers (connected-header suggestions, typically
                    // short key values like a Product Number) stay single-line.
                    <input
                      type="text"
                      list={`dl-${h.id}`}
                      value={row[h.id] ?? ''}
                      onChange={(e) => updateCell(rowIndex, h.id, e.target.value)}
                      disabled={readOnly || h.disabled}
                      className="w-full min-w-[110px] px-3 py-2 bg-transparent text-gray-800 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-400 disabled:text-gray-400"
                    />
                  ) : (
                    <AutoGrowTextarea
                      value={row[h.id] ?? ''}
                      onChange={(e) => updateCell(rowIndex, h.id, e.target.value)}
                      disabled={readOnly || h.disabled}
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
      {/* One shared <datalist> per column with suggestions — a native
          browsable dropdown that still lets you type a value that isn't in
          the list yet (a brand-new product), unlike ComboboxCell which only
          ever commits a clicked option. */}
      {Object.entries(pickerOptions).map(([headerId, options]) => (
        options?.length ? (
          <datalist key={headerId} id={`dl-${headerId}`}>
            {options.map((v) => <option key={v} value={v} />)}
          </datalist>
        ) : null
      ))}
    </div>
  )
}
