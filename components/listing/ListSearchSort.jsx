'use client'

import { ArrowUpDown, Search, X } from 'lucide-react'
import { LIST_SORTS } from '@/lib/listSort'

// Search box + Name / Created sort picker above the Header Mapping table —
// same as tools-5's ListSearchSort. Purely controlled: the section owns
// `query` / `sort`. `shown` / `total` print a "12 of 78" count while a
// search is narrowing the list.
export default function ListSearchSort({ query, onQuery, sort, onSort, placeholder = 'Search…', shown, total, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-full border border-divider bg-background py-1.5 pl-8 pr-8 text-[13px] text-foreground focus:border-accent focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-subtle hover:bg-card-hover hover:text-foreground"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <label className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-background py-1 pl-2.5 pr-1.5 text-[12.5px] text-muted">
        <ArrowUpDown size={13} className="shrink-0" />
        <span className="sr-only">Sort</span>
        <select value={sort} onChange={(e) => onSort(e.target.value)} className="bg-transparent text-foreground focus:outline-none">
          {LIST_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      {query && total != null && <span className="text-[12px] text-subtle">{shown} of {total}</span>}
    </div>
  )
}
