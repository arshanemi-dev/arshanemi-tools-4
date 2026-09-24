'use client'

import { Search, X, ArrowUpDown } from 'lucide-react'

function Chip({ children, onClear, label, tone = 'filter' }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1 text-[12px] font-medium ${
        tone === 'sort' ? 'border-divider bg-card text-muted' : 'border-accent/30 bg-accent/5 text-accent-hover'
      }`}
    >
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label}`}
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full hover:bg-card-hover hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

// Above the Template Logs grid: one search across every column, then a chip
// per active column filter (and a non-default sort) — the at-a-glance
// summary of what the grid is hiding, each removable in one click, since
// the filters themselves live behind the column header menus.
export default function LogFilterBar({ search, onSearch, chips, sortChip, onClearAll }) {
  const hasAny = chips.length > 0 || !!search.trim()

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[240px] flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search all columns…"
            aria-label="Search all columns"
            className="w-full rounded-lg border border-divider bg-card py-2 pl-9 pr-8 text-[13px] focus:border-accent-light focus:outline-none focus:ring-1 focus:ring-accent-light"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-subtle hover:bg-card-hover hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="text-[12px] text-subtle">
          Use the <span className="font-semibold text-muted">▾</span> on any column header to sort, filter by condition, or pick values.
        </p>
      </div>

      {(chips.length > 0 || sortChip) && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Chip key={c.key} label={`${c.label} filter`} onClear={c.onClear}>{c.label}</Chip>
          ))}
          {sortChip && (
            <Chip tone="sort" label="sort" onClear={sortChip.onClear}>
              <ArrowUpDown className="mr-1 inline h-3 w-3" />
              {sortChip.label}
            </Chip>
          )}
          {hasAny && (
            <button type="button" onClick={onClearAll} className="ml-1 text-[12px] font-semibold text-accent hover:text-accent-hover">
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
