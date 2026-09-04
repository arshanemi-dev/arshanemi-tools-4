'use client'
import { ChevronDown } from 'lucide-react'
import ComboboxCell from './ComboboxCell'
import MultiSelectCell from './MultiSelectCell'
import ImageCell from './ImageCell'
import FormulaCell from './FormulaCell'
import HeaderInfoTip from './HeaderInfoTip'
import { recomputeFormulas } from './formula'

// `aiFilled` (plan §14) is a bookkeeping key, not a header id.
function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || v === undefined || v === null || String(v).trim() === '')
}
function blankRow(headers) {
  return Object.fromEntries(headers.map((h) => [h.id, '']))
}

// The Compulsory + Brand Details fields for ONE Product Details row, rendered
// as a sub-block directly under that row (SheetGrid's `renderRowSubRow`). So
// the page reads: PD row 1 → its all-groups fields → PD row 2 → its
// all-groups fields → …
//
// Fields are grouped by their group (each cluster under its group name); every
// field is its label with a fixed-width input box directly below it (240px, or
// 720px when the group name is long — Task 3); disabled headers are never
// shown; image headers show only their URL box (`ImageCell urlOnly`).
// `sections` (≤2: compulsory, prefill) each carry that group's own `label`,
// headers, rows and handlers and an edit routes back to the right one. The per-cell mutation glue (connected-header fill via `onCellChange`,
// formula recompute, always-one-trailing-blank-row, AI-filled marker
// clearing, image auto-read) mirrors SheetGrid.jsx — the canonical copy —
// plus per-section row padding, since a section's own row list can trail the
// Product Details row count until its cells are first touched.
export default function MergedRowFields({ sections = [], rowIndex, uploadUrl, loadingCells, readOnly = false, autoAppendRow = true }) {
  const prepared = sections.map((s) => {
    const all = [...s.headers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    // `allHeaders` stays the full set (blankRow/formula context); `visibleHeaders`
    // is what actually renders — a bucket section ("Big" / "Image Link") passes
    // `visibleHeaderIds` to show only its own slice of the design_system headers.
    const visibleHeaders = all.filter((h) => !h.disabled && (!s.visibleHeaderIds || s.visibleHeaderIds.has(h.id)))
    return { ...s, allHeaders: all, visibleHeaders }
  })
  if (!prepared.length) return null

  function updateCell(secIdx, headerId, value) {
    const s = prepared[secIdx]
    const allHeaders = s.allHeaders
    const header = allHeaders.find((h) => h.id === headerId)

    let workingRows = s.rows
    if (workingRows.length < rowIndex + 1) {
      workingRows = [...workingRows, ...Array.from({ length: rowIndex + 1 - workingRows.length }, () => blankRow(allHeaders))]
    }
    const prevValue = workingRows[rowIndex]?.[headerId]

    let row = { ...workingRows[rowIndex], [headerId]: value }
    if (s.onCellChange) {
      const extra = s.onCellChange(headerId, value, rowIndex, row)
      if (extra) row = { ...row, ...extra }
    }
    const formulaExtra = recomputeFormulas(allHeaders, row, headerId)
    if (formulaExtra) row = { ...row, ...formulaExtra }
    if (row.aiFilled?.includes(headerId)) {
      row = { ...row, aiFilled: row.aiFilled.filter((id) => id !== headerId) }
    }

    let next = workingRows.map((r, i) => (i === rowIndex ? row : r))
    // Only the on-demand "Add Product" button grows the row count now; a filled
    // last row no longer spawns a fresh blank (autoAppendRow === false).
    if (autoAppendRow && rowIndex === next.length - 1 && !isRowEmpty(next[rowIndex])) {
      next = [...next, blankRow(allHeaders)]
    }
    s.onRowsChange(next)
    if (header?.dataType === 'image' && value && value !== prevValue) {
      s.onImageUploaded?.(rowIndex, headerId, value)
    }
  }

  // Every field box is the same width; the "Big" group's boxes are 3× the
  // normal HEIGHT (not width — Task, round 8). Extra right padding + the
  // scroll container's `scrollbar-gutter` (SheetGrid) keep a gap between the
  // fields and the scrollbar.
  const FIELD_W = 'w-[13.65%] min-w-[140px] max-w-full'
  const BOX_BASE = 'block overflow-hidden rounded-md border'

  return (
    <div className="flex flex-col gap-4 border-l-2 border-accent-light/40 bg-surface/40 py-4 pl-6 pr-6">
      {prepared.map((s, secIdx) => {
        const groupName = String(s.label || s.group || '').trim()
        const tall = s.bucket === 'big'
        return (
          <div key={s.bucket || s.group} className="min-w-0">
            <p className="mb-2 border-b border-divider/70 pb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
              {groupName || s.group}
            </p>
            <div className="flex flex-wrap gap-3">
              {s.visibleHeaders.map((h) => {
                const rowObj = s.rows[rowIndex] || {}
                const aiFilled = rowObj.aiFilled?.includes(h.id)
                const isPicker = s.pickerOptions?.[h.id]?.length > 0
                const isFormulaSetter = h.dataType === 'formula' && !!s.onHeaderChange
                const boxCls = `${BOX_BASE} ${tall ? 'min-h-[128px]' : 'min-h-[40px]'} ${aiFilled ? 'border-l-2 border-l-accent-light border-divider bg-accent/10' : 'border-divider bg-background'}`
                return (
                  <div key={`${s.bucket || s.group}:${h.id}`} className={FIELD_W}>
                    <div className="mb-1 flex items-center gap-1">
                      <span className={`truncate text-[12px] font-semibold text-foreground ${isFormulaSetter ? 'min-w-0 max-w-[45%]' : ''}`}>{h.label}</span>
                      {(h.dataType === 'dropdown' || h.dataType === 'multiselect' || isPicker) && (
                        <ChevronDown className="h-3 w-3 shrink-0 text-subtle" />
                      )}
                      {isFormulaSetter ? (
                        <>
                          {/* Formula field: ⓘ sits right after the name, then the
                              formula-setter input fills the rest of the header row. */}
                          <HeaderInfoTip label={h.label} description={h.description} className="shrink-0" />
                          <input
                            key={h.formula || 'empty'}
                            type="text"
                            defaultValue={h.formula || ''}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                            onBlur={(e) => { if (e.target.value !== (h.formula || '')) s.onHeaderChange(h.id, { formula: e.target.value }) }}
                            placeholder="e.g. [MRP] * 1.5"
                            title="Formula — reference other columns as [Column Label]"
                            className="min-w-0 flex-1 rounded border border-divider px-2 py-0.5 text-[11px] italic focus:outline-none focus:ring-1 focus:ring-accent-light"
                          />
                        </>
                      ) : (
                        <HeaderInfoTip label={h.label} description={h.description} className="ml-auto shrink-0" />
                      )}
                    </div>

                    <div className={boxCls}>
                      {h.dataType === 'image' ? (
                        <ImageCell
                          value={rowObj[h.id]}
                          onChange={(url) => updateCell(secIdx, h.id, url)}
                          uploadUrl={uploadUrl}
                          disabled={readOnly || h.disabled}
                          urlOnly
                        />
                      ) : h.dataType === 'dropdown' ? (
                        <ComboboxCell value={rowObj[h.id] || ''} options={h.dropdownSource?.values || []} onChange={(v) => updateCell(secIdx, h.id, v)} disabled={readOnly || h.disabled} />
                      ) : h.dataType === 'multiselect' ? (
                        <MultiSelectCell value={rowObj[h.id] || ''} options={h.dropdownSource?.values || []} onChange={(v) => updateCell(secIdx, h.id, v)} disabled={readOnly || h.disabled} />
                      ) : h.dataType === 'formula' ? (
                        <FormulaCell compact value={rowObj[h.id]} formula={h.formula} headers={s.allHeaders} row={rowObj} disabled={readOnly || h.disabled} onChange={(v) => updateCell(secIdx, h.id, v)} />
                      ) : isPicker ? (
                        <ComboboxCell
                          value={rowObj[h.id] || ''}
                          options={s.pickerOptions[h.id]}
                          onChange={(v) => updateCell(secIdx, h.id, v)}
                          disabled={readOnly || h.disabled}
                          loading={loadingCells?.has(`${rowIndex}:${h.id}`)}
                        />
                      ) : (
                        <textarea
                          value={rowObj[h.id] ?? ''}
                          onChange={(e) => updateCell(secIdx, h.id, e.target.value)}
                          disabled={readOnly || h.disabled}
                          rows={tall ? 5 : 1}
                          className="block w-full resize-none bg-transparent px-3 py-2 text-[13px] leading-tight text-foreground focus:outline-none focus:ring-1 focus:ring-inset focus:ring-accent-light disabled:text-subtle"
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
