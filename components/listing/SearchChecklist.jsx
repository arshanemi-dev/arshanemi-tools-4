'use client'

import { useMemo, useState } from 'react'
import { ArrowDownAZ, ArrowDownZA, ArrowUpDown, Search } from 'lucide-react'

const MAX_ROWS = 400 // options drawn at once — search narrows a longer list

// Same component as tools-5's components/dashboard/SearchChecklist.jsx.

// Does `text` contain what was typed? (case-insensitive; '' matches everything)
export const matchesSearch = (text, q) => {
  const s = String(q || '').trim().toLowerCase()
  return !s || String(text ?? '').toLowerCase().includes(s)
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

// A dropdown list in the order asked for: 'asc' (A → Z), 'desc' (Z → A), or
// as it was given (null). Natural order — "2 Profit" before "10 Tax".
export function sortByLabel(items, labelOf, dir) {
  if (dir !== 'asc' && dir !== 'desc') return items
  const sign = dir === 'desc' ? -1 : 1
  return [...items].sort((a, b) => sign * collator.compare(String(labelOf(a) ?? ''), String(labelOf(b) ?? '')))
}

const NEXT_SORT = { asc: 'desc', desc: null }
const SORT_TITLE = { asc: 'Sorted A → Z — click for Z → A', desc: 'Sorted Z → A — click for the original order' }

// The search box every dropdown list starts with. Pass `sort` / `onSort` to
// put the list's order toggle beside it (as listed → A → Z → Z → A); the
// list itself is ordered by the caller with sortByLabel.
export function ListSearchBox({ value, onChange, onEnter, placeholder = 'Search…', label = 'Search', autoFocus = true, sort, onSort }) {
  const SortIcon = sort === 'asc' ? ArrowDownAZ : sort === 'desc' ? ArrowDownZA : ArrowUpDown
  return (
    <div className="flex items-center gap-1">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }}
          placeholder={placeholder}
          aria-label={label}
          className="w-full rounded-lg border border-divider-light bg-background py-1.5 pl-8 pr-2 text-[13px] font-normal text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>
      {onSort && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSort(sort ? NEXT_SORT[sort] : 'asc') }}
          aria-label="Sort this list"
          title={sort ? SORT_TITLE[sort] : 'In the original order — click to sort A → Z'}
          className={`shrink-0 rounded-lg border p-1.5 transition-colors hover:bg-card-hover ${sort ? 'border-action text-action' : 'border-divider-light text-subtle'}`}
        >
          <SortIcon size={14} />
        </button>
      )}
    </div>
  )
}

// The body of a "pick several" dropdown, the way a spreadsheet's filter does
// it: a search box over a checklist, "(Select All)" on top, Cancel / OK
// below. Nothing is reported until OK.
//  - Searching narrows the list; "(Select All Search Results)" then ticks /
//    unticks just what is listed, and OK keeps only the ticked options that
//    match the search — type, press Enter, done.
//  - The toggle beside the search orders the list A → Z / Z → A
//    (`sortable={false}` for a list that is already in a meaningful order).
// `options` = [{ value, label, count? }]; `initial` = the values ticked to
// start with. `onSubmit(values, { all })` — `all` = every option is chosen.
// `okLabel` = text, or (count) => text. `header` = extra rows above the
// search (a column's Sort A → Z / Z → A), or (submit) => those rows when
// they hold a field of their own that Enter should OK from; `footer` = an
// extra control on the left of the buttons (e.g. "Clear filter").
// `canSubmit={false}` holds OK back while something in `header` is wrong.
// `allowEmpty` lets OK go with nothing ticked, and `narrowOnSearch={false}`
// makes OK report every ticked option, searched for or not. `columns={3}`
// lays the list out in three columns (a wider panel — two on a narrow
// screen) so long lists show more at once.
export default function SearchChecklist({ label = 'options', options = [], initial = [], onSubmit, onClose, okLabel = 'OK', header = null, footer = null, placeholder = 'Search…', emptyText = 'Nothing to pick.', sortable = true, canSubmit = true, allowEmpty = false, narrowOnSearch = true, columns = 1 }) {
  const multi = columns > 1
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(null)
  const [ticked, setTicked] = useState(() => new Set(initial))

  const visible = useMemo(
    () => sortByLabel(options.filter((o) => matchesSearch(o.label, q)), (o) => o.label, sort),
    [options, q, sort],
  )
  const searching = q.trim() !== ''
  const allTicked = visible.length > 0 && visible.every((o) => ticked.has(o.value))
  const chosen = (searching && narrowOnSearch ? visible : options).filter((o) => ticked.has(o.value)).map((o) => o.value)
  const canOk = (allowEmpty || chosen.length > 0) && canSubmit

  const toggle = (value) => setTicked((prev) => {
    const next = new Set(prev)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  })
  const toggleAll = () => setTicked((prev) => {
    const next = new Set(prev)
    for (const o of visible) {
      if (allTicked) next.delete(o.value)
      else next.add(o.value)
    }
    return next
  })
  const submit = () => {
    if (!canOk) return
    onSubmit(chosen, { all: chosen.length >= options.length })
    onClose()
  }

  const row = 'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[13px] text-foreground hover:bg-card-hover'
  const box = 'shrink-0 accent-[var(--color-action)]'

  return (
    <div className={`flex ${multi ? 'w-[min(42rem,calc(100vw-2rem))]' : 'w-64'} flex-col gap-2 p-1 text-left font-normal whitespace-normal text-foreground`}>
      {typeof header === 'function' ? header(submit) : header}
      <ListSearchBox value={q} onChange={setQ} onEnter={submit} placeholder={placeholder} label={`Search ${label}`} sort={sort} onSort={sortable ? setSort : undefined} />

      <div className={`${multi ? 'max-h-72' : 'max-h-56'} overflow-y-auto rounded-lg border border-divider p-1`}>
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-center text-[12.5px] text-subtle">{options.length ? 'Nothing matches.' : emptyText}</p>
        ) : (
          <div className={multi ? 'grid grid-cols-1 gap-x-1 sm:grid-cols-2 md:grid-cols-3' : ''}>
            <label className={`${row} font-medium ${multi ? 'col-span-full border-b border-divider' : ''}`}>
              <input type="checkbox" checked={allTicked} onChange={toggleAll} className={box} />
              {searching ? '(Select All Search Results)' : '(Select All)'}
            </label>
            {visible.slice(0, MAX_ROWS).map((o) => (
              <label key={o.value} className={row} title={o.label}>
                <input type="checkbox" checked={ticked.has(o.value)} onChange={() => toggle(o.value)} className={box} />
                <span className={`min-w-0 flex-1 truncate ${o.muted ? 'text-subtle' : ''}`}>{o.label}</span>
                {o.count != null && <span className="shrink-0 text-[11px] tabular-nums text-subtle">{o.count}</span>}
              </label>
            ))}
            {visible.length > MAX_ROWS && (
              <p className="col-span-full px-2 py-1.5 text-[11.5px] text-subtle">Showing {MAX_ROWS} of {visible.length} — search to narrow.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {footer}
        <span className="ml-auto text-[11px] text-subtle">{chosen.length} selected</span>
        <button type="button" onClick={onClose} className="rounded-lg border border-divider-light px-2.5 py-1 text-[12px] font-medium text-muted hover:bg-card-hover">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={!canOk} className="rounded-lg bg-action px-3 py-1 text-[12px] font-semibold text-white hover:bg-action-hover disabled:opacity-40">
          {typeof okLabel === 'function' ? okLabel(chosen.length) : okLabel}
        </button>
      </div>
    </div>
  )
}
