'use client'

import { Search, X, Hash, CalendarClock } from 'lucide-react'
import { LOG_CATEGORIES } from '@/lib/templateLogActions'

export const RANGES = [
  { id: '24h', label: '24h', ms: 864e5 },
  { id: '7d', label: '7 days', ms: 7 * 864e5 },
  { id: '30d', label: '30 days', ms: 30 * 864e5 },
  { id: '90d', label: '90 days', ms: 90 * 864e5 },
  { id: 'all', label: 'All time', ms: null },
]

function Chip({ children, onClear, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-card py-1 pl-2.5 pr-1 text-[12px] font-medium text-muted">
      {children}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label} filter`}
        className="flex h-4 w-4 items-center justify-center rounded-full text-subtle hover:bg-card-hover hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

// Search runs over the rows already loaded (instant, no round trip); every
// other control here is a server-side filter that reloads the feed.
export default function LogFilterBar({ filters, onChange, templates, search, onSearch, onClearAll }) {
  const selectedTemplate = templates?.find((t) => t.id === filters.templateId)
  const category = LOG_CATEGORIES.find((c) => c.id === filters.category)
  const hasChips = filters.batchId || filters.templateId || filters.category !== 'all' || search.trim()
  const sortedTemplates = [...(templates || [])].sort((a, b) => (a.templateName || '').localeCompare(b.templateName || ''))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search template, version, person, detail…"
            className="w-full rounded-lg border border-divider bg-card py-2 pl-9 pr-3 text-[13px] focus:border-accent-light focus:outline-none focus:ring-1 focus:ring-accent-light"
          />
        </div>

        <select
          value={filters.templateId}
          onChange={(e) => onChange({ templateId: e.target.value })}
          aria-label="Filter by template"
          className="max-w-[260px] rounded-lg border border-divider bg-card px-3 py-2 text-[13px] text-foreground focus:border-accent-light focus:outline-none focus:ring-1 focus:ring-accent-light"
        >
          <option value="">All templates</option>
          {sortedTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.templateNumber ? `${t.templateNumber} · ` : ''}{t.templateName}
            </option>
          ))}
        </select>

        <div className="ml-auto inline-flex items-center gap-0.5 rounded-lg bg-card-hover p-1" role="radiogroup" aria-label="Date range">
          <CalendarClock className="mx-1.5 h-3.5 w-3.5 text-subtle" aria-hidden="true" />
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={filters.range === r.id}
              onClick={() => onChange({ range: r.id })}
              className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                filters.range === r.id ? 'bg-card text-accent-hover shadow-sm' : 'text-subtle hover:text-muted'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {hasChips && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-wide text-subtle">Filtered by</span>
          {filters.category !== 'all' && (
            <Chip label="event type" onClear={() => onChange({ category: 'all' })}>{category?.label}</Chip>
          )}
          {filters.templateId && (
            <Chip label="template" onClear={() => onChange({ templateId: '' })}>{selectedTemplate?.templateName || 'Template'}</Chip>
          )}
          {filters.batchId && (
            <Chip label="batch" onClear={() => onChange({ batchId: null })}>
              <Hash className="h-3 w-3" /> Batch {filters.batchId}
            </Chip>
          )}
          {search.trim() && (
            <Chip label="search" onClear={() => onSearch('')}>“{search.trim()}”</Chip>
          )}
          <button type="button" onClick={onClearAll} className="text-[12px] font-semibold text-accent hover:text-accent-hover">
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
