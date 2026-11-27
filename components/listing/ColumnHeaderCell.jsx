'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import ColumnFilterButton from './ColumnFilterButton'

// One <th> body: label + tri-state sort toggle + a spreadsheet-style menu
// (ColumnFilterButton — the same sort as "Sort A → Z / Z → A", a Min / Max
// range on a number column, then search + tick the values to keep). Same
// component as tools-5's components/dashboard/ColumnHeaderCell.jsx (its
// dashboard-only Arrange control and ⓘ note left out — no tools-4 list
// table has either).
// Sort and filter icons take no space: they float right against the label
// only on hover or while their menu is open — red on a small white pill so
// they stand out on the blue header; a sorted / filtered / open one is solid
// red. Not hovered, a sorted / filtered column shows a red dot instead.
// A label of more than two words goes onto lines of two words each, so a
// long header doesn't make its column wide.
const WORDS_PER_LINE = 2
function labelLines(label) {
  const words = String(label ?? '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  for (let i = 0; i < words.length; i += WORDS_PER_LINE) lines.push(words.slice(i, i + WORDS_PER_LINE).join(' '))
  return lines.length ? lines : ['']
}

export default function ColumnHeaderCell({
  col,
  sort,
  onSortChange,
  filter,
  onFilterChange,
  getFilterOptions = () => [],
  getFilterRange = null,
  onFilterOpenChange,
}) {
  const [filterOpen, setFilterOpen] = useState(false)

  const dir = sort?.key === col.key ? sort.dir : null

  const cycleSort = () => {
    if (dir === null) onSortChange({ key: col.key, dir: 'asc' })
    else if (dir === 'asc') onSortChange({ key: col.key, dir: 'desc' })
    else onSortChange(null)
  }

  const SortIcon = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ChevronsUpDown

  const handleFilterOpenChange = (open) => {
    setFilterOpen(open)
    onFilterOpenChange?.(open)
  }

  const hasFilter = !!filter

  return (
    <div className="px-1 group/cell flex items-center justify-center">
      <span className="relative inline-flex min-w-0 max-w-full items-center">
        <span className="text-center">
          {labelLines(col.label).map((line, i) => <span key={i} className="block whitespace-nowrap">{line}</span>)}
        </span>
        {/* A sorted / filtered column, not hovered: a dot on the label's corner — no space taken. */}
        {(dir || hasFilter) && !filterOpen && (
          <span aria-hidden className="absolute -right-1.5 top-0 size-1.5 rounded-full bg-neg ring-1 ring-white group-hover/cell:hidden" />
        )}
        {/* Sort / filter: only on hover or while the menu is open, floating
            right against the label (absolute) — never widening the column. */}
        <span className={`absolute left-full top-1/2 z-20 ml-0.5 -translate-y-1/2 items-center gap-px rounded-md bg-white p-px shadow-md ${filterOpen ? 'flex' : 'hidden group-hover/cell:flex'}`}>
          <button
            type="button"
            onClick={cycleSort}
            className={`inline-flex shrink-0 rounded p-0.5 transition-colors ${dir ? 'bg-neg text-white' : 'text-neg hover:bg-neg/10'}`}
            aria-label={`Sort by ${col.label}`}
          >
            <SortIcon size={12} />
          </button>
          <span className="inline-flex">
            <ColumnFilterButton
              label={col.label}
              filter={filter}
              getOptions={getFilterOptions}
              getRange={getFilterRange}
              onChange={onFilterChange}
              onOpenChange={handleFilterOpenChange}
              sortDir={dir}
              onSort={(d) => onSortChange(d ? { key: col.key, dir: d } : null)}
              highlight
            />
          </span>
        </span>
      </span>
    </div>
  )
}
