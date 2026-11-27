'use client'

import { useState } from 'react'
import { ArrowDownAZ, ArrowDownZA, Check } from 'lucide-react'
import SearchChecklist from './SearchChecklist'
import { BLANK_LABEL, makeFilter } from '@/lib/columnFilter'

const SORTS = [
  ['asc', ArrowDownAZ, 'Sort A → Z', 'smallest · oldest first'],
  ['desc', ArrowDownZA, 'Sort Z → A', 'largest · newest first'],
]

// A typed Min / Max → its number, or null for an empty box.
const typed = (text) => (String(text).trim() === '' || !Number.isFinite(Number(text)) ? null : Number(text))
const boxText = (n) => (typeof n === 'number' && Number.isFinite(n) ? String(n) : '')

// One end of the range. `hint` = the column's own lowest / highest number,
// shown while the box is empty; Enter is the menu's OK.
function RangeBox({ name, value, onChange, hint, onEnter, crossed, label, title }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter() } }}
      placeholder={hint == null ? name : `${name} ${hint}`}
      aria-label={label}
      title={title}
      className={`min-w-0 flex-1 rounded-lg border bg-background px-2 py-1.5 text-[13px] font-normal text-foreground placeholder:text-subtle focus:outline-none ${crossed ? 'border-neg' : 'border-divider-light focus:border-accent'}`}
    />
  )
}

// A column's dropdown, spreadsheet-style — same component as tools-5's
// components/dashboard/ColumnFilterMenu.jsx: sort the table by this column
// (A → Z / Z → A — picking the one already on clears it), then — on a number
// column — a Min / Max range, then a SearchChecklist over every value the
// column holds (with how many rows have each) to filter it:
//  - No filter yet → everything starts ticked; untick what to hide.
//  - Ticking everything (with no search) is the same as no filter.
//  - Min, Max or both keep the rows whose number is inside (the ends count);
//    an empty box is no limit. Ticks and range together: a row needs both.
//  - "Clear filter" (only while one is on) removes it.
// `getOptions()` → [{ text, count }] ('' = blank cells), read once when the
// menu opens; `selected` = the current filter's values, or null.
// `getRange()` → { min, max } the column's numbers span, or null when it has
// none — leave it out for a column that is never a number. `range` = the
// current filter ({ min, max }), or null. `onApply({ values, min, max } |
// null)`; `onClose()`. `sortDir` ('asc' | 'desc' | null) + `onSort(dir |
// null)` — leave `onSort` out for a column that can't be sorted.
export default function ColumnFilterMenu({ label, getOptions, selected = null, getRange = null, range = null, onApply, onClose, sortDir = null, onSort = null, columns = 1 }) {
  const [options] = useState(() => getOptions().map((o) => ({ value: o.text, label: o.text === '' ? BLANK_LABEL : o.text, count: o.count, muted: o.text === '' })))
  const [span] = useState(() => (getRange ? getRange() : null))
  const [lo, setLo] = useState(() => boxText(range?.min))
  const [hi, setHi] = useState(() => boxText(range?.max))

  const min = typed(lo)
  const max = typed(hi)
  const crossed = min != null && max != null && min > max
  // A range already on stays editable even if the column has no numbers left.
  const ranged = !!span || lo !== '' || hi !== ''

  return (
    <SearchChecklist
      label={`${label} values`}
      options={options}
      initial={selected || options.map((o) => o.value)}
      onSubmit={(values, { all }) => onApply(makeFilter(all ? null : values, min, max))}
      onClose={onClose}
      canSubmit={!crossed}
      emptyText="This column has no values."
      sortable={false}
      columns={columns}
      header={(submit) => (
        <>
          {onSort && (
            <div className="border-b border-divider pb-1">
              {SORTS.map(([dir, Icon, text, hint]) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => { onSort(sortDir === dir ? null : dir); onClose() }}
                  aria-pressed={sortDir === dir}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-card-hover ${sortDir === dir ? 'font-semibold text-action' : 'text-foreground'}`}
                >
                  <Icon size={14} className="shrink-0" />
                  <span>{text}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-normal text-subtle">{hint}</span>
                  {sortDir === dir && <Check size={13} className="shrink-0" />}
                </button>
              ))}
            </div>
          )}
          {ranged && (
            <div className="border-b border-divider px-1 pb-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Number range</span>
                {(lo !== '' || hi !== '') && (
                  <button type="button" onClick={() => { setLo(''); setHi('') }} className="text-[11px] font-medium text-link hover:underline">
                    Reset
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <RangeBox name="Min" value={lo} onChange={setLo} hint={span?.min} onEnter={submit} crossed={crossed} label={`Minimum ${label}`} title="Hide rows below this — empty = no limit" />
                <span className="text-[12px] text-subtle">to</span>
                <RangeBox name="Max" value={hi} onChange={setHi} hint={span?.max} onEnter={submit} crossed={crossed} label={`Maximum ${label}`} title="Hide rows above this — empty = no limit" />
              </div>
              {crossed && <p className="pt-1 text-[11px] text-neg">Min can’t be more than Max.</p>}
            </div>
          )}
        </>
      )}
      footer={(selected || range) && (
        <button type="button" onClick={() => { onApply(null); onClose() }} className="rounded-lg px-2 py-1 text-[12px] font-medium text-muted hover:bg-card-hover hover:text-foreground">
          Clear filter
        </button>
      )}
    />
  )
}
