'use client'
import { Filter, ChevronDown, Lock } from 'lucide-react'
import ComboboxCell from './ComboboxCell'
import MultiSelectCell from './MultiSelectCell'
import ImageCell from './ImageCell'
import FormulaCell from './FormulaCell'
import AutoGrowTextarea from './AutoGrowTextarea'
import { recomputeFormulas } from './formula'
import { useBulkImageUpload } from './useBulkImageUpload'

// `aiFilled` (plan §14) is a bookkeeping key, not a header id — excluded
// here so a row with a stale AI-filled marker but every real header cleared
// still reads as empty, same reasoning as lib/listingTemplates.js's own copy.
function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || v === undefined || v === null || String(v).trim() === '')
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
  // suggested values rendered with the same ComboboxCell used for a real
  // `dropdown` column — still free-typeable (a picker header must stay
  // usable for entering a brand-new value, e.g. a new Product Number), just
  // with the same searchable/clear/keyboard-nav UI everywhere else in the grid.
  onCellChange,
  pickerOptions = {},
  // Set of `${rowIndex}:${headerId}` keys currently mid-async-fill (e.g. Auto Details' Product
  // Group lookup+backfill, see its own `loadingCells`) — optional, only a picker-backed
  // ComboboxCell ever reads it, and only to show/disable while its own commit's follow-up work
  // is still in flight. Every picker commit gets its own brief local spinner flash regardless of
  // this prop (see ComboboxCell.jsx's `justSelected`), so a caller with nothing async to report
  // can simply omit this entirely.
  loadingCells,
  // Formula-type headers can be authored two places: Template Settings'
  // GroupTabsStep card, or directly here in the column header while looking
  // at real data — optional, since not every SheetGrid caller wants to
  // persist a header edit (e.g. a read-only view).
  onHeaderChange,
  // AI Auto-Fill support (plan/gemini-ai-plan.md §6/§14) — optional,
  // SheetGrid stays ignorant of billing/Gemini specifics: fires right after
  // an image cell gets a new non-empty value, so a caller can auto-trigger
  // vision-fill with no extra click. (No per-row action column — bulk
  // "AI Fill Up" in each page's toolbar replaced that.)
  onImageUploaded,
}) {
  const sortedHeaders = [...headers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // Freeze-panes: the header row stays pinned while rows scroll (below, via
  // `max-h-[70vh] overflow-auto` on the table's own wrapper — same 70vh
  // scroll-region convention GroupTabsStep.jsx's Kanban board already uses),
  // and whichever column is this sheet's own unique key (Product Number for
  // design_system/compulsory/optional, Brand for prefill) stays pinned on
  // the left while the rest of the row scrolls horizontally — so no matter
  // how far you've scrolled in either direction, you can always see *which
  // column* (header) and *which product* (key column) a cell belongs to.
  // Falls back to no left-pinned column at all if nothing on this sheet is
  // flagged `isUniqueKeyPart` (some Compulsory/Prefill/Optional sheets may
  // not have one), rather than guessing at some other column.
  const stickyKeyHeaderId = sortedHeaders.find((h) => h.isUniqueKeyPart)?.id
  const stickyLeftCls = selectable ? 'left-10' : 'left-0'
  // The checkbox column is the last (rightmost) frozen column only when there's no
  // isUniqueKeyPart column to its right also being pinned — that's the one whose right edge is
  // the real freeze boundary and needs the harder border below, not the (thin, normal) line
  // between two columns that are both already frozen.
  const checkboxIsLastSticky = selectable && !stickyKeyHeaderId
  // Hard 2px border instead of the grid's normal 1px hairline — marks the actual freeze
  // boundary (bottom of the pinned header row, right edge of the pinned key column) so it reads
  // as a real seam, not just another gridline.
  const stickyRightBorderCls = 'border-r-2 border-r-divider-light'
  const plainRightBorderCls = 'border-r border-divider'

  // One shared bulk-upload session for the whole grid — any ImageCell that
  // receives more than one file at once delegates to this instead of its
  // own single-file path, so a multi-select from inside a cell behaves
  // exactly like the dedicated BulkImageDropZone toolbar above the grid:
  // same row-by-row empty-box fill, same capacity check, same progress UI.
  const bulk = useBulkImageUpload({ headers: sortedHeaders, rows, onRowsChange, uploadUrl, onImageUploaded })

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
    const header = sortedHeaders.find((h) => h.id === headerId)
    const prevValue = rows[rowIndex]?.[headerId]
    let updatedRow = resolveRow(rowIndex, headerId, value, rows[rowIndex])
    // Manual edit clears this cell's AI-filled marker (plan §14) — once a
    // human has touched the value it's no longer purely AI output, so the
    // highlight disappears immediately rather than lingering as a stale
    // signal. Other AI-filled cells on the same row are untouched.
    if (updatedRow.aiFilled?.includes(headerId)) {
      updatedRow = { ...updatedRow, aiFilled: updatedRow.aiFilled.filter((id) => id !== headerId) }
    }
    const next = rows.map((r, i) => (i === rowIndex ? updatedRow : r))
    onRowsChange(withTrailingBlankRow(next, rowIndex))
    if (header?.dataType === 'image' && value && value !== prevValue) {
      onImageUploaded?.(rowIndex, headerId, value)
    }
  }

  const selectableRowIndexes = rows.map((r, i) => i).filter((i) => !isRowEmpty(rows[i]))
  const allSelected = selectable && selectableRowIndexes.length > 0 && selectableRowIndexes.every((i) => selectedIds.includes(i))

  return (
    <div className="border border-divider rounded-lg bg-card">
      {bulk.message && (
        <div className="px-3 py-2 border-b border-divider">
          <p className={`text-[11.5px] ${bulk.message.warning ? 'text-red-500 font-medium' : 'text-subtle'}`}>{bulk.message.text}</p>
        </div>
      )}
      <div className="max-h-[70vh] overflow-auto">
      {/* `border-separate` (not `collapse`) is required for the sticky header/column borders
          above to stay visible while scrolling — `border-collapse` shares a border between two
          adjacent cells, and once one of them is repositioned by `position: sticky`, browsers
          lose track of which cell owns painting that shared edge and it clips/disappears mid-scroll.
          `border-spacing-0` keeps cells touching edge-to-edge exactly as collapse did; no visual
          double-border risk here since every cell only ever declares its own bottom/right border,
          never top/left, so there's nothing for a neighbor to double up against. */}
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="bg-card">
            {selectable && (
              <th
                className={`h-[80px] sticky top-0 left-0 z-30 bg-card border-b-2 border-b-divider-light w-10 px-3 py-2.5 align-top ${
                  checkboxIsLastSticky ? stickyRightBorderCls : plainRightBorderCls
                }`}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-divider-light accent-accent"
                />
              </th>
            )}
            {sortedHeaders.map((h) => (
              <th
                key={h.id}
                className={`h-[80px] sticky top-0 z-20 bg-card border-b-2 border-b-divider-light px-3 py-2.5 text-left font-semibold text-foreground whitespace-nowrap align-top ${
                  h.id === stickyKeyHeaderId ? `${stickyLeftCls} z-30 ${stickyRightBorderCls}` : plainRightBorderCls
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span title={h.description || undefined}>{h.label}</span>
                  {(h.dataType === 'dropdown' || h.dataType === 'multiselect' || pickerOptions[h.id]?.length > 0) && (
                    <ChevronDown className="w-3 h-3 text-subtle" />
                  )}
                  {h.disabled && <Lock className="w-3 h-3 text-subtle" title="Read-only — filled automatically" />}
                  {onFilterChange && h.isUniqueKeyPart && (
                    <button
                      type="button"
                      onClick={() => onFilterChange(h.id)}
                      className={`transition-colors ${activeFilterHeaderId === h.id ? 'text-accent' : 'text-subtle hover:text-accent'}`}
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
                    className="mt-1 w-full px-1.5 py-0.5 text-[11.5px] font-normal border border-divider rounded focus:outline-none focus:ring-1 focus:ring-accent-light"
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
                    className="mt-1 w-full px-1.5 py-0.5 text-[11px] font-normal italic border border-divider rounded focus:outline-none focus:ring-1 focus:ring-accent-light"
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-surface/80 group">
              {selectable && (
                <td
                  className={`sticky left-0 z-10 bg-card group-hover:bg-surface border-b border-divider px-3 py-2 ${
                    checkboxIsLastSticky ? stickyRightBorderCls : plainRightBorderCls
                  }`}
                >
                  {!isRowEmpty(row) && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(rowIndex)}
                      onChange={() => onToggleSelect?.(rowIndex)}
                      className="w-3.5 h-3.5 rounded border-divider-light accent-accent"
                    />
                  )}
                </td>
              )}
              {sortedHeaders.map((h) => {
                const aiFilled = row.aiFilled?.includes(h.id)
                const isStickyKey = h.id === stickyKeyHeaderId
                return (
                <td
                  key={h.id}
                  title={aiFilled ? 'Filled by AI' : undefined}
                  className={`h-[140px] border-b border-divider p-0 align-middle ${isStickyKey ? stickyRightBorderCls : plainRightBorderCls} ${
                    aiFilled ? 'bg-accent/10 border-l-2 border-l-accent-light' : isStickyKey ? 'bg-card group-hover:bg-surface' : ''
                  } ${isStickyKey ? `sticky z-10 ${stickyLeftCls}` : ''}`}
                >
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
                    // Picker headers (connected-header suggestions — Product Number's own
                    // self-lookup, Product Group's cross-template name list, etc.) get the same
                    // searchable-combobox UI as a real `dropdown` column now, not a plain native
                    // <input list>/<datalist> — still just as free-typeable (ComboboxCell commits
                    // whatever's typed on Enter, or on blur if it differs from the current value),
                    // just with the same search/clear/keyboard-nav polish everywhere else in the grid.
                    <ComboboxCell
                      value={row[h.id] || ''}
                      options={pickerOptions[h.id]}
                      onChange={(v) => updateCell(rowIndex, h.id, v)}
                      disabled={readOnly || h.disabled}
                      loading={loadingCells?.has(`${rowIndex}:${h.id}`)}
                    />
                  ) : (
                    <AutoGrowTextarea
                      value={row[h.id] ?? ''}
                      onChange={(e) => updateCell(rowIndex, h.id, e.target.value)}
                      disabled={readOnly || h.disabled}
                      className="w-full min-w-[110px] px-3 py-2 bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-inset focus:ring-accent-light disabled:text-subtle"
                    />
                  )}
                </td>
              )})}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
