'use client'

import { Search, X } from 'lucide-react'

// Above the Template Logs grid: one search across every column. The column
// filters themselves live in the grid's header (tools-5's table — hover a
// column header for its sort and filter buttons), and the grid says which
// are on, with "Clear all filters", in its own bar.
export default function LogFilterBar({ search, onSearch }) {
  return (
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
        Hover a column header for its <span className="font-semibold text-muted">sort</span> and <span className="font-semibold text-muted">filter</span> buttons.
      </p>
    </div>
  )
}
