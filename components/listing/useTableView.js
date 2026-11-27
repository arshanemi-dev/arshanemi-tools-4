'use client'

import { useMemo, useState } from 'react'
import { activeFilters, cellNumber, cellPasses, cellText, columnOptions, columnRange, compareCellValues } from '@/lib/columnFilter'
import { DEFAULT_PAGE_SIZE } from './TablePager'

// The sort / filter / page state of one list table — tools-5's DetailsTable
// and Position Settings › Orders logic (lib/columnFilter.js), kept in one
// place so every tools-4 list table behaves the same. Render it with
// DataTable.jsx.
//
// `columns` = [{ key, label, text(row) → what the cell SHOWS (what the
// filter ticks), sortValue?(row) → what it sorts by (a number / timestamp;
// default: the text), numeric?: true → the filter also offers a Min / Max
// range }]. Keep `rows` and `columns` stable (state / useMemo) — the cells
// are rebuilt whenever either changes.
//
// A column's checklist offers what the OTHER columns' filters leave, the way
// a sheet does. `defaultSort` ({ key, dir } | null) is the order a table
// opens in; the sort toggle cycles A → Z, Z → A, then unsorted (the rows'
// own order). `groupOf(row)` keeps rows of one group together (a template's
// versions): groups sort by their first row, keep their own inner order, and
// page as one — `count` / `total` then count groups.
export default function useTableView(rows, columns, { defaultSort = null, pageSize: firstPageSize = DEFAULT_PAGE_SIZE, groupOf = null } = {}) {
  const [picked, setPicked] = useState(undefined) // undefined = still the default sort
  const [filters, setFilters] = useState({}) // { [columnKey]: { values, min, max } | null }
  const [filterOpen, setFilterOpen] = useState(false) // a filter menu is open — the table makes room for it
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(firstPageSize)
  const sort = picked === undefined ? defaultSort : picked

  // Each row's cells — { [key]: { raw, display } }, the shape columnFilter.js reads.
  const entries = useMemo(
    () => rows.map((row, i) => ({
      row,
      i,
      cells: Object.fromEntries(columns.map((c) => {
        const display = String(c.text(row) ?? '').trim()
        return [c.key, { display, raw: c.sortValue ? c.sortValue(row) : display }]
      })),
    })),
    [rows, columns],
  )

  // Only the filters of columns that are on screen count.
  const keys = columns.map((c) => c.key).join('\u0000')
  const applied = useMemo(() => activeFilters(filters, keys.split('\u0000')), [filters, keys])
  const passes = (e, except = null) => applied.every(([key, f]) => key === except || cellPasses(f, e.cells[key]))

  const view = useMemo(() => {
    let out = applied.length ? entries.filter((e) => applied.every(([key, f]) => cellPasses(f, e.cells[key]))) : entries
    if (sort?.key) {
      const dir = sort.dir === 'desc' ? -1 : 1
      out = [...out].sort((a, b) => compareCellValues(a.cells[sort.key]?.raw, b.cells[sort.key]?.raw, dir) || a.i - b.i)
    }
    return out
  }, [entries, applied, sort])

  // What pages: one row each, or one group each (its rows in their own order).
  const units = (list) => {
    if (!groupOf) return list.map((e) => [e])
    const byGroup = new Map()
    for (const e of list) {
      const g = groupOf(e.row)
      if (!byGroup.has(g)) byGroup.set(g, [])
      byGroup.get(g).push(e)
    }
    return [...byGroup.values()].map((group) => group.sort((a, b) => a.i - b.i))
  }
  const shown = units(view)
  const total = groupOf ? new Set(rows.map(groupOf)).size : rows.length

  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * pageSize
  const pageRows = shown.slice(pageStart, pageStart + pageSize).flat().map((e) => e.row)
  const viewRows = useMemo(() => view.map((e) => e.row), [view])

  // One column's checklist: the values in the rows every OTHER filter leaves
  // — and its Min / Max range: the numbers those same rows span.
  const optionsFor = (key) => columnOptions(entries.filter((e) => passes(e, key)), (e) => cellText(e.cells[key]), (e) => e.cells[key]?.raw)
  const rangeFor = (key) => columnRange(entries.filter((e) => passes(e, key)), (e) => cellNumber(e.cells[key]))

  // A new sort or filter starts again on page 1.
  const changeSort = (next) => { setPicked(next); setPage(1) }
  const setFilter = (key, f) => { setFilters((prev) => ({ ...prev, [key]: f })); setPage(1) }
  const replaceFilters = (next) => { setFilters(next || {}); setPage(1) }

  return {
    rows: viewRows, // every filtered + sorted row, all pages (export, select-all)
    pageRows,
    count: shown.length, // rows (or groups) left by the filters
    total, // rows (or groups) before them
    sort,
    setSort: changeSort,
    filters,
    setFilter,
    replaceFilters,
    clearFilters: () => replaceFilters({}),
    appliedCount: applied.length,
    filterOpen,
    page: currentPage,
    pageCount,
    pageStart,
    pageSize,
    setPage,
    setPageSize: (n) => { setPageSize(n); setPage(1) },
    // Everything a ColumnHeaderCell needs for one column.
    headerProps: (col) => ({
      col,
      sort,
      onSortChange: changeSort,
      filter: filters[col.key] || null,
      onFilterChange: (f) => setFilter(col.key, f),
      getFilterOptions: () => optionsFor(col.key),
      getFilterRange: col.numeric ? () => rangeFor(col.key) : null,
      onFilterOpenChange: setFilterOpen,
    }),
  }
}
