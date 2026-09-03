'use client'
import { Filter, ChevronDown, Lock, Trash2 } from 'lucide-react'
import ComboboxCell from './ComboboxCell'
import MultiSelectCell from './MultiSelectCell'
import ImageCell from './ImageCell'
import FormulaCell from './FormulaCell'
import AutoGrowTextarea from './AutoGrowTextarea'
import HeaderInfoTip from './HeaderInfoTip'
import { recomputeFormulas } from './formula'
import { useBulkImageUpload } from './useBulkImageUpload'

// `aiFilled` (plan §14) is a bookkeeping key, not a header id — same
// excluded-key check SheetGrid.jsx / useBulkImageUpload.js keep their own
// copies of.
function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || v === undefined || v === null || String(v).trim() === '')
}

// Flex-box twin of SheetGrid — same headers/rows contract, same cell types,
// same always-one-trailing-blank-row + formula-recompute + connected-header
// (`onCellChange`) + bulk-image + AI-fill behaviour — but laid out as a
// wrapping "header strip on top, one flex line of inputs per row" block
// instead of a wide scrolling <table>. Used for the stacked Compulsory /
// Brand Details blocks on the Auto Details and Product Details pages, which
// now show every group at once (no tab strip); Product Details itself keeps
// the real SheetGrid table above these.
//
// The row-mutation helpers below (resolveRow / withTrailingBlankRow /
// updateCell) are deliberately a line-for-line copy of SheetGrid's — this
// component only changes the *visual container*, never what an edit does, so
// the two must stay in lock-step. SheetGrid.jsx is the canonical copy.
export default function FlexSheet({
  headers,
  rows,
  onRowsChange,
  uploadUrl,
  readOnly = false,
  onCellChange,
  pickerOptions = {},
  loadingCells,
  onHeaderChange,
  onImageUploaded,
  onDeleteRow,
  // Per-column filter (Product Details' unique-key column only) — same
  // optional trio SheetGrid takes.
  activeFilterHeaderId,
  filterValue = '',
  onFilterChange,
}) {
  const sortedHeaders = [...headers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const bulk = useBulkImageUpload({ headers: sortedHeaders, rows, onRowsChange, uploadUrl, onImageUploaded })

  // ---- identical row-mutation glue to SheetGrid (see class comment) ----
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

  function withTrailingBlankRow(next, rowIndex) {
    if (rowIndex !== rows.length - 1 || isRowEmpty(next[rowIndex])) return next
    return [...next, Object.fromEntries(sortedHeaders.map((h) => [h.id, '']))]
  }

  function updateCell(rowIndex, headerId, value) {
    const header = sortedHeaders.find((h) => h.id === headerId)
    const prevValue = rows[rowIndex]?.[headerId]
    let updatedRow = resolveRow(rowIndex, headerId, value, rows[rowIndex])
    if (updatedRow.aiFilled?.includes(headerId)) {
      updatedRow = { ...updatedRow, aiFilled: updatedRow.aiFilled.filter((id) => id !== headerId) }
    }
    const next = rows.map((r, i) => (i === rowIndex ? updatedRow : r))
    onRowsChange(withTrailingBlankRow(next, rowIndex))
    if (header?.dataType === 'image' && value && value !== prevValue) {
      onImageUploaded?.(rowIndex, headerId, value)
    }
  }
  // --------------------------------------------------------------------

  // Every column keeps the same flex sizing in the header strip and in each
  // row line, so the two stay aligned as they wrap together.
  const colStyle = { flex: '1 1 190px' }
  const colClass = 'min-w-[170px] max-w-full'
  const gutter = onDeleteRow ? 'w-7 shrink-0' : 'hidden'

  return (
    <div className="rounded-lg border border-divider bg-card">
      {bulk.message && (
        <div className="border-b border-divider px-3 py-2">
          <p className={`text-[11.5px] ${bulk.message.warning ? 'font-medium text-red-500' : 'text-subtle'}`}>{bulk.message.text}</p>
        </div>
      )}

      <div className="max-h-[70vh] space-y-2 overflow-auto p-3">
        {/* Header strip — no group name, just the columns, each with its ⓘ note button on the right. */}
        <div className="flex items-start gap-2 border-b border-divider pb-2">
          <div className={gutter} />
          <div className="flex flex-1 flex-wrap gap-x-3 gap-y-2">
            {sortedHeaders.map((h) => (
              <div key={h.id} style={colStyle} className={`flex items-center gap-1 ${colClass}`}>
                <span className="truncate text-[12.5px] font-semibold text-foreground">{h.label}</span>
                {(h.dataType === 'dropdown' || h.dataType === 'multiselect' || pickerOptions[h.id]?.length > 0) && (
                  <ChevronDown className="h-3 w-3 shrink-0 text-subtle" />
                )}
                {h.disabled && <Lock className="h-3 w-3 shrink-0 text-subtle" title="Read-only — filled automatically" />}
                {onFilterChange && h.isUniqueKeyPart && (
                  <button
                    type="button"
                    onClick={() => onFilterChange(h.id)}
                    className={`shrink-0 transition-colors ${activeFilterHeaderId === h.id ? 'text-accent' : 'text-subtle hover:text-accent'}`}
                  >
                    <Filter className="h-3 w-3" />
                  </button>
                )}
                <HeaderInfoTip label={h.label} description={h.description} className="ml-auto shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {activeFilterHeaderId && onFilterChange && (
          <div className="flex gap-2">
            <div className={gutter} />
            <input
              autoFocus
              value={filterValue}
              onChange={(e) => onFilterChange(activeFilterHeaderId, e.target.value)}
              placeholder="Filter…"
              className="w-full max-w-[220px] rounded border border-divider px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-light"
            />
          </div>
        )}

        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="group flex items-stretch gap-2 rounded-md hover:bg-surface/70">
            {onDeleteRow && (
              <div className="flex w-7 shrink-0 items-start justify-center pt-2">
                {!isRowEmpty(row) && (
                  <button
                    type="button"
                    onClick={() => onDeleteRow(row, rowIndex)}
                    title="Delete this row"
                    className="rounded p-1 text-subtle hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            <div className="flex flex-1 flex-wrap gap-x-3 gap-y-2">
              {sortedHeaders.map((h) => {
                const aiFilled = row.aiFilled?.includes(h.id)
                return (
                  <div
                    key={h.id}
                    style={colStyle}
                    title={aiFilled ? 'Filled by AI' : undefined}
                    className={`${colClass} overflow-hidden rounded-md border ${
                      aiFilled ? 'border-l-2 border-l-accent-light border-divider bg-accent/10' : 'border-divider bg-background'
                    }`}
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
                        className="w-full bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-inset focus:ring-accent-light disabled:text-subtle"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
