'use client'

import { useCallback, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Funnel, ScrollText, SearchX } from 'lucide-react'
import { isFilterActive } from '@/lib/gridFilters'
import ColumnMenu from './ColumnMenu'

function SkeletonRows({ columns }) {
  return Array.from({ length: 8 }, (_, i) => (
    <tr key={i}>
      <td className="sticky left-0 z-10 border-b border-r border-divider bg-card px-2 py-2.5">
        <div className="mx-auto h-3 w-4 animate-pulse rounded bg-card-hover" />
      </td>
      {columns.map((c, j) => (
        <td key={c.key} className="border-b border-r border-divider px-3 py-2.5">
          <div className={`h-3.5 animate-pulse rounded bg-card-hover ${j % 3 === 0 ? 'w-3/4' : j % 3 === 1 ? 'w-1/2' : 'w-2/3'}`} />
        </td>
      ))}
    </tr>
  ))
}

// Spreadsheet-style grid for the Template Logs page: sticky header row,
// Excel-like row-number gutter, gridlines, and per column a sort toggle
// (click the header) plus a ColumnMenu (the ▾ / funnel button) for sort,
// filter by condition and filter by values. Filtering/sorting itself lives
// in the parent (it also drives export + counts); this renders the result,
// `renderLimit` rows at a time so a big log stays responsive.
export default function LogGrid({
  columns, rows, totalCount, loading, loadingLabel, filters, sort, onSort, onApplyFilter, optionRowsFor,
  onRowClick, activeRowId, onBatch, renderLimit, onShowMore, isFiltered, onClearFilters,
}) {
  const [menu, setMenu] = useState(null) // { key, anchor }
  const closeMenu = useCallback(() => setMenu(null), [])
  const menuColumn = menu ? columns.find((c) => c.key === menu.key) : null
  const optionRows = useMemo(() => (menu ? optionRowsFor(menu.key) : []), [menu, optionRowsFor])

  function toggleMenu(key, anchor) {
    setMenu((m) => (m?.key === key ? null : { key, anchor }))
  }

  // Header click flips the direction; a column's first click sorts the way
  // people usually want it (dates newest first, everything else A → Z).
  function cycleSort(column) {
    if (sort.key === column.key) onSort(column.key, sort.dir === 'asc' ? 'desc' : 'asc')
    else onSort(column.key, column.type === 'date' ? 'desc' : 'asc')
  }

  const visible = rows.slice(0, renderLimit)
  const remaining = rows.length - visible.length
  const filteredColumns = columns.filter((c) => isFilterActive(c, filters[c.key])).length

  return (
    <div className="overflow-hidden rounded-xl border border-divider bg-background shadow-sm">
      <div className="max-h-[calc(100vh-17rem)] min-h-[320px] overflow-auto">
        <table className="w-full min-w-[1200px] table-fixed border-separate border-spacing-0 text-left text-[12.5px]">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 top-0 z-30 w-12 border-b border-r border-divider bg-card" aria-label="Row number" />
              {columns.map((col) => {
                const sorted = sort.key === col.key
                const filtered = isFilterActive(col, filters[col.key])
                const open = menu?.key === col.key
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`group sticky top-0 z-20 border-b border-r border-divider bg-card p-0 align-middle ${col.width}`}
                  >
                    <div className="flex items-center gap-1 pr-1.5">
                      <button
                        type="button"
                        onClick={() => cycleSort(col)}
                        title={`Sort by ${col.label}`}
                        className={`flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-wide transition-colors ${
                          sorted || filtered ? 'text-foreground' : 'text-muted hover:text-foreground'
                        }`}
                      >
                        <span className="truncate">{col.label}</span>
                        {sorted ? (
                          sort.dir === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0 text-accent" /> : <ArrowDown className="h-3 w-3 flex-shrink-0 text-accent" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => toggleMenu(col.key, e.currentTarget)}
                        aria-haspopup="dialog"
                        aria-expanded={open}
                        aria-label={`Sort and filter ${col.label}`}
                        title={filtered ? `${col.label} is filtered — click to change` : `Sort and filter ${col.label}`}
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                          filtered
                            ? 'border-accent bg-accent text-white hover:bg-accent-hover'
                            : open
                              ? 'border-accent-light bg-card-hover text-foreground'
                              : 'border-divider bg-background text-subtle hover:border-divider-light hover:text-foreground'
                        }`}
                      >
                        {filtered ? <Funnel className="h-3 w-3" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows columns={columns} />}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-16">
                  <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                    <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                      {isFiltered ? <SearchX className="h-5 w-5" /> : <ScrollText className="h-5 w-5" />}
                    </span>
                    <p className="text-[14px] font-semibold text-foreground">{isFiltered ? 'No events match these filters' : 'No activity yet'}</p>
                    <p className="mt-1 text-[12.5px] text-subtle">
                      {isFiltered
                        ? 'Loosen a column filter or clear them all.'
                        : 'Template and version changes — saves, go-lives, rule edits, deletions — will show up here as they happen.'}
                    </p>
                    {isFiltered && (
                      <button type="button" onClick={onClearFilters} className="mt-3 text-[12.5px] font-semibold text-accent hover:text-accent-hover">
                        Clear all filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              visible.map((r, i) => {
                const active = r.id === activeRowId
                return (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    aria-selected={active}
                    onClick={() => onRowClick(r)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(r) } }}
                    className={`group cursor-pointer transition-colors focus:outline-none ${
                      active ? 'bg-accent/10' : 'hover:bg-accent/5 focus-visible:bg-accent/5'
                    }`}
                  >
                    <td
                      className={`sticky left-0 z-10 border-b border-r border-divider px-2 py-2 text-center font-mono text-[11px] ${
                        active ? 'bg-accent text-white' : 'bg-card text-subtle group-hover:text-muted'
                      }`}
                    >
                      {i + 1}
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="overflow-hidden whitespace-nowrap border-b border-r border-divider px-3 py-2 align-middle">
                        {col.render(r, { onBatch })}
                      </td>
                    ))}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider bg-card px-3 py-2 text-[12px] text-subtle">
        <span>
          {loading ? (
            loadingLabel
          ) : (
            <>
              <span className="font-semibold text-foreground tabular-nums">{rows.length.toLocaleString()}</span> of{' '}
              <span className="tabular-nums">{totalCount.toLocaleString()}</span> event{totalCount === 1 ? '' : 's'}
              {filteredColumns > 0 && ` · ${filteredColumns} column${filteredColumns === 1 ? '' : 's'} filtered`}
            </>
          )}
        </span>
        {!loading && remaining > 0 && (
          <span className="flex items-center gap-2">
            Showing first {visible.length.toLocaleString()}
            <button type="button" onClick={() => onShowMore(false)} className="font-semibold text-accent hover:text-accent-hover">
              Show more
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => onShowMore(true)} className="font-semibold text-accent hover:text-accent-hover">
              Show all {rows.length.toLocaleString()}
            </button>
          </span>
        )}
      </div>

      {menuColumn && (
        <ColumnMenu
          key={menuColumn.key}
          column={menuColumn}
          anchor={menu.anchor}
          optionRows={optionRows}
          filter={filters[menuColumn.key]}
          sortDir={sort.key === menuColumn.key ? sort.dir : null}
          onSort={(dir) => { onSort(menuColumn.key, dir); closeMenu() }}
          onApply={(f) => onApplyFilter(menuColumn.key, f)}
          onClose={closeMenu}
        />
      )}
    </div>
  )
}
