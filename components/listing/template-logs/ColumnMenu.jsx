'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownAZ, ArrowDownZA, ArrowDown01, ArrowDown10, ArrowUpNarrowWide, ArrowDownWideNarrow, Check, FunnelX, Search } from 'lucide-react'
import { CONDITIONS, SORT_LABELS, conditionDef, distinctValues, isConditionComplete, isFilterActive } from '@/lib/gridFilters'

const MAX_LIST = 300

const SORT_ICONS = {
  text: { asc: ArrowDownAZ, desc: ArrowDownZA },
  number: { asc: ArrowDown01, desc: ArrowDown10 },
  date: { asc: ArrowUpNarrowWide, desc: ArrowDownWideNarrow },
}

const sectionTitle = 'mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle'
const inputCls =
  'w-full rounded-md border border-divider bg-card px-2.5 py-1.5 text-[12.5px] text-foreground focus:border-accent-light focus:outline-none focus:ring-1 focus:ring-accent-light'

// One column's spreadsheet-style menu — Sort, Filter by condition, Filter by
// values (searchable checklist with counts, built from the rows the OTHER
// columns' filters leave, like Excel). Edits are a draft until OK; Sort
// applies immediately. Typing in the values search works like Excel's: the
// matches become the selection, so search + Enter filters to just those.
//
// Positioned `fixed` against its header button (so the grid's own scroll
// box can't clip it). The coordinates are computed at runtime from the
// button's rect, so they're set on the DOM node directly rather than
// through a style prop — the one thing Tailwind classes can't express.
export default function ColumnMenu({ column, anchor, optionRows, filter, sortDir, onSort, onApply, onClose }) {
  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const options = useMemo(() => distinctValues(optionRows, column), [optionRows, column])
  const conditions = CONDITIONS[column.type]
  const icons = SORT_ICONS[column.type]
  const active = isFilterActive(column, filter)

  const [condOp, setCondOp] = useState(filter?.condition?.op || '')
  const [condA, setCondA] = useState(filter?.condition?.a ?? '')
  const [condB, setCondB] = useState(filter?.condition?.b ?? '')
  const [checked, setChecked] = useState(() => (filter?.values ? new Set(filter.values) : new Set(options.map((o) => o.value))))
  const [valueSearch, setValueSearch] = useState('')
  const [searchChecked, setSearchChecked] = useState(null)

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu || !anchor) return undefined
    function place() {
      const r = anchor.getBoundingClientRect()
      const width = menu.offsetWidth
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
      const top = Math.min(r.bottom + 6, window.innerHeight - 200)
      menu.style.left = `${left}px`
      menu.style.top = `${top}px`
      menu.style.maxHeight = `${window.innerHeight - top - 12}px`
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])

  useEffect(() => {
    function onPointerDown(e) {
      if (!menuRef.current?.contains(e.target) && !anchor?.contains(e.target)) onClose()
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        anchor?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [anchor, onClose])

  useEffect(() => { searchRef.current?.focus() }, [])

  const q = valueSearch.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  const activeSet = q ? searchChecked : checked
  const allShownChecked = shown.length > 0 && shown.every((o) => activeSet.has(o.value))
  const someShownChecked = shown.some((o) => activeSet.has(o.value))
  const def = conditionDef(column.type, condOp)
  const inputType = column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'

  function setActiveSet(next) {
    if (q) setSearchChecked(next)
    else setChecked(next)
  }
  function toggleValue(value) {
    const next = new Set(activeSet)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setActiveSet(next)
  }
  function toggleAllShown() {
    const next = new Set(activeSet)
    for (const o of shown) {
      if (allShownChecked) next.delete(o.value)
      else next.add(o.value)
    }
    setActiveSet(next)
  }
  function handleSearch(text) {
    setValueSearch(text)
    const query = text.trim().toLowerCase()
    setSearchChecked(query ? new Set(options.filter((o) => o.label.toLowerCase().includes(query)).map((o) => o.value)) : null)
  }

  // Nothing ticked would hide every row — OK stays disabled, as in Excel.
  const okDisabled = options.length > 0 && activeSet.size === 0

  function apply() {
    if (okDisabled) return
    let values = null
    if (q) values = new Set(searchChecked)
    else if (!options.every((o) => checked.has(o.value))) values = new Set(options.filter((o) => checked.has(o.value)).map((o) => o.value))
    const condition = def ? { op: condOp, a: condA, b: condB } : null
    const hasCondition = isConditionComplete(column.type, condition)
    onApply(values || hasCondition ? { values, condition: hasCondition ? condition : null } : null)
    onClose()
  }

  function onEnter(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      apply()
    }
  }

  return (
    <div
      ref={menuRef}
      role="dialog"
      aria-label={`Sort and filter ${column.label}`}
      className="fixed left-0 top-0 z-50 flex w-72 flex-col overflow-hidden rounded-xl border border-divider bg-background text-[13px] shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-divider bg-card px-3 py-2">
        <span className="truncate text-[12px] font-bold text-foreground">{column.label}</span>
        {active && <span className="rounded-full bg-accent/10 px-2 py-px text-[10.5px] font-semibold text-accent">Filtered</span>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-1.5">
          {['asc', 'desc'].map((dir) => {
            const Icon = icons[dir]
            const on = sortDir === dir
            return (
              <button
                key={dir}
                type="button"
                onClick={() => onSort(dir)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                  on ? 'bg-accent/10 font-semibold text-accent' : 'text-foreground hover:bg-card-hover'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {SORT_LABELS[column.type][dir]}
                {on && <Check className="ml-auto h-3.5 w-3.5" />}
              </button>
            )
          })}
          <button
            type="button"
            disabled={!active}
            onClick={() => { onApply(null); onClose() }}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-foreground transition-colors hover:bg-card-hover disabled:pointer-events-none disabled:opacity-40"
          >
            <FunnelX className="h-4 w-4 flex-shrink-0" />
            Clear filter from “{column.label}”
          </button>
        </div>

        <div className="border-t border-divider px-3 py-2.5">
          <p className={sectionTitle}>Filter by condition</p>
          <select value={condOp} onChange={(e) => setCondOp(e.target.value)} className={inputCls} aria-label="Condition">
            <option value="">None</option>
            {conditions.map((c) => (
              <option key={c.op} value={c.op}>{c.label}</option>
            ))}
          </select>
          {def?.args >= 1 && (
            <div className={`mt-2 grid gap-2 ${def.args === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <input
                type={inputType}
                value={condA}
                onChange={(e) => setCondA(e.target.value)}
                onKeyDown={onEnter}
                placeholder={def.args === 2 ? 'From' : 'Value'}
                aria-label={def.args === 2 ? 'From' : 'Value'}
                className={inputCls}
              />
              {def.args === 2 && (
                <input
                  type={inputType}
                  value={condB}
                  onChange={(e) => setCondB(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder="To"
                  aria-label="To"
                  className={inputCls}
                />
              )}
            </div>
          )}
        </div>

        <div className="border-t border-divider px-3 py-2.5">
          <p className={sectionTitle}>Filter by values</p>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
            <input
              ref={searchRef}
              value={valueSearch}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={onEnter}
              placeholder="Search values…"
              aria-label="Search values"
              className={`${inputCls} pl-8`}
            />
          </div>

          {shown.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-subtle">{options.length ? 'No matching values' : 'No values'}</p>
          ) : (
            <>
              <label className="mb-1 flex cursor-pointer items-center gap-2 border-b border-divider px-1 pb-1.5 pt-0.5">
                <input
                  type="checkbox"
                  checked={allShownChecked}
                  ref={(el) => { if (el) el.indeterminate = !allShownChecked && someShownChecked }}
                  onChange={toggleAllShown}
                  className="h-3.5 w-3.5 accent-accent"
                />
                <span className="font-semibold text-foreground">{q ? 'Select all search results' : 'Select all'}</span>
                <span className="ml-auto text-[11px] tabular-nums text-subtle">{shown.length}</span>
              </label>
              <ul className="max-h-52 overflow-y-auto">
                {shown.slice(0, MAX_LIST).map((o) => (
                  <li key={o.value}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-card-hover">
                      <input
                        type="checkbox"
                        checked={activeSet.has(o.value)}
                        onChange={() => toggleValue(o.value)}
                        className="h-3.5 w-3.5 flex-shrink-0 accent-accent"
                      />
                      <span className={`min-w-0 flex-1 truncate ${o.value === '' ? 'italic text-subtle' : 'text-foreground'}`} title={o.label}>
                        {o.label}
                      </span>
                      <span className="text-[11px] tabular-nums text-subtle">{o.count}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {shown.length > MAX_LIST && (
                <p className="mt-1.5 text-[11.5px] text-subtle">Showing the first {MAX_LIST} of {shown.length} — search to narrow.</p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-divider bg-card px-3 py-2">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:bg-card-hover">
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={okDisabled}
          className="rounded-md bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          OK
        </button>
      </div>
    </div>
  )
}
