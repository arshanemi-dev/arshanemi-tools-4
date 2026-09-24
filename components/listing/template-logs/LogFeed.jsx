'use client'

import { Loader2, ScrollText, SearchX } from 'lucide-react'
import { actionMeta, dayLabel, fmtDateTime, fmtTime, sameDay } from '@/lib/templateLogActions'

const COLS = ['Time', 'Event', 'Template', 'Version', 'Details', 'By', 'Batch']

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function ActionChip({ action, size = 'sm' }) {
  const meta = actionMeta(action)
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${meta.chip} ${
        size === 'lg' ? 'px-2.5 py-1 text-[12.5px]' : 'px-2 py-0.5 text-[11.5px]'
      }`}
    >
      <Icon className={size === 'lg' ? 'h-3.5 w-3.5' : 'h-3 w-3'} /> {meta.label}
    </span>
  )
}

export function VersionPill({ label, isLive }) {
  if (!label) return <span className="text-subtle">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-card-hover px-1.5 py-0.5 font-mono text-[12px] font-semibold text-foreground">
      {label}
      {isLive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Live right now" />}
    </span>
  )
}

function SkeletonRows() {
  return Array.from({ length: 7 }, (_, i) => (
    <tr key={i} className="border-b border-divider last:border-b-0">
      {COLS.map((c, j) => (
        <td key={c} className="px-3 py-3.5">
          <div className={`h-3.5 animate-pulse rounded bg-card-hover ${j === 4 ? 'w-48' : j === 2 ? 'w-32' : 'w-16'}`} />
        </td>
      ))}
    </tr>
  ))
}

// The log itself: rows grouped under day headings (Today / Yesterday /
// date), newest first. A row opens the detail drawer; its batch chip
// narrows the whole feed to that one operation instead.
export default function LogFeed({ rows, loading, hasMore, loadingMore, onLoadMore, onOpen, onBatch, filtered, onClearFilters }) {
  const dayCounts = new Map()
  for (const r of rows) {
    const key = dayLabel(r.createdAt)
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-divider bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-divider bg-surface/70">
              {COLS.map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-wide text-subtle">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows />}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-16">
                  <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                    <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                      {filtered ? <SearchX className="h-5 w-5" /> : <ScrollText className="h-5 w-5" />}
                    </span>
                    <p className="text-[14px] font-semibold text-foreground">{filtered ? 'No events match these filters' : 'No activity yet'}</p>
                    <p className="mt-1 text-[12.5px] text-subtle">
                      {filtered
                        ? 'Try a wider date range, another event type, or clear the filters.'
                        : 'Template and version changes — saves, go-lives, rule edits, deletions — will show up here as they happen.'}
                    </p>
                    {filtered && (
                      <button type="button" onClick={onClearFilters} className="mt-3 text-[12.5px] font-semibold text-accent hover:text-accent-hover">
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((r, i) => {
                const newDay = i === 0 || !sameDay(r.createdAt, rows[i - 1].createdAt)
                const day = dayLabel(r.createdAt)
                return [
                  newDay && (
                    <tr key={`day-${r.id}`} className="border-b border-divider bg-surface/50">
                      <td colSpan={COLS.length} className="px-3 py-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
                        {day} <span className="font-medium text-subtle">· {dayCounts.get(day)} event{dayCounts.get(day) === 1 ? '' : 's'}</span>
                      </td>
                    </tr>
                  ),
                  <tr
                    key={r.id}
                    tabIndex={0}
                    onClick={() => onOpen(r)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(r) } }}
                    className="cursor-pointer border-b border-divider last:border-b-0 transition-colors hover:bg-surface/70 focus:bg-surface/70 focus:outline-none"
                  >
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-subtle" title={fmtDateTime(r.createdAt)}>
                      {fmtTime(r.createdAt)}
                    </td>
                    <td className="px-3 py-3"><ActionChip action={r.action} /></td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-[160px] items-center gap-1.5">
                        <span className={`truncate font-medium ${r.templateExists ? 'text-foreground' : 'text-subtle line-through decoration-subtle/50'}`}>
                          {r.templateName}
                        </span>
                        {r.templateNumber && <span className="flex-shrink-0 font-mono text-[11px] text-subtle">{r.templateNumber}</span>}
                        {!r.templateExists && (
                          <span className="flex-shrink-0 rounded bg-rose-500/10 px-1 py-px text-[10px] font-bold uppercase text-rose-600">Deleted</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3"><VersionPill label={r.versionLabel} isLive={r.versionIsLive} /></td>
                    <td className="max-w-[360px] px-3 py-3 text-muted">
                      <span className="block truncate" title={r.detail?.summary || ''}>{r.detail?.summary || '—'}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="inline-flex items-center gap-2 text-muted">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                          {initialsOf(r.actorName)}
                        </span>
                        <span className="max-w-[120px] truncate">{r.actorName || 'Unknown'}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onBatch(r.batchId) }}
                        title="Show every event from this same operation"
                        className="rounded-md border border-divider px-1.5 py-0.5 font-mono text-[11.5px] text-subtle transition-colors hover:border-accent-light hover:text-accent"
                      >
                        #{r.batchId}
                      </button>
                    </td>
                  </tr>,
                ]
              })}
          </tbody>
        </table>
      </div>

      {!loading && hasMore && (
        <div className="flex justify-center border-t border-divider bg-surface/40 py-3">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-divider bg-card px-4 py-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:bg-card-hover disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loadingMore ? 'Loading…' : 'Load older events'}
          </button>
        </div>
      )}
    </div>
  )
}
