'use client'

import { LOG_CATEGORIES } from '@/lib/templateLogActions'

// Headline counts for the current date range / template — and the action
// filter at the same time: clicking a tile narrows the feed to it.
export default function LogStatTiles({ counts, active, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 hidden">
      {LOG_CATEGORIES.map((c) => {
        const Icon = c.icon
        const isActive = active === c.id
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-pressed={isActive}
            className={`flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-all ${
              isActive ? 'border-accent ring-2 ring-accent/15' : 'border-divider hover:border-divider-light hover:bg-card-hover/60'
            }`}
          >
            <span
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                isActive ? 'bg-accent text-white' : 'bg-accent/10 text-accent'
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-subtle">{c.label}</span>
              {counts ? (
                <span className="block text-xl font-bold leading-7 text-foreground tabular-nums">{counts[c.id].toLocaleString()}</span>
              ) : (
                <span className="mt-1 block h-5 w-10 animate-pulse rounded bg-card-hover" />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
