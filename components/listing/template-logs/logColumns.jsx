'use client'

import { actionMeta, fmtDateTime, fmtRelative } from '@/lib/templateLogActions'
import { dateFromDayKey, dayKeyOf } from '@/lib/gridFilters'
import { ActionChip, Avatar, VersionPill } from './LogCells'

// The Template Logs grid's columns — the column-definition shape
// lib/gridFilters.js documents, plus `width` (a Tailwind class; the one
// column without a width absorbs the remaining space) and `render`.
// Empty cells render blank, same as the Template Settings list.
export const LOG_COLUMNS = [
  {
    key: 'createdAt',
    label: 'Date & Time',
    type: 'date',
    width: 'w-44',
    value: (r) => dayKeyOf(r.createdAt),
    valueLabel: (key) => dateFromDayKey(key).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
    text: (r) => fmtDateTime(r.createdAt),
    date: (r) => r.createdAt,
    render: (r) => (
      <span className="font-mono text-[12px] text-muted" title={fmtRelative(r.createdAt)}>
        {fmtDateTime(r.createdAt)}
      </span>
    ),
  },
  {
    key: 'event',
    label: 'Event',
    type: 'text',
    width: 'w-48',
    value: (r) => actionMeta(r.action).label,
    render: (r) => <ActionChip action={r.action} />,
  },
  {
    key: 'templateNumber',
    label: 'Template #',
    type: 'text',
    width: 'w-28',
    value: (r) => r.templateNumber || '',
    render: (r) => <span className="font-mono text-[12px] text-subtle">{r.templateNumber}</span>,
  },
  {
    key: 'templateName',
    label: 'Template',
    type: 'text',
    width: 'w-60',
    value: (r) => r.templateName || '',
    render: (r) => (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`truncate font-medium ${r.templateExists ? 'text-foreground' : 'text-subtle line-through decoration-subtle/50'}`}>
          {r.templateName}
        </span>
        {!r.templateExists && (
          <span className="flex-shrink-0 rounded bg-rose-500/10 px-1 py-px text-[10px] font-bold uppercase text-rose-600">Deleted</span>
        )}
      </span>
    ),
  },
  {
    key: 'version',
    label: 'Version',
    type: 'text',
    width: 'w-28',
    value: (r) => r.versionLabel || '',
    // V10 after V9 — by the real version number, not the label's text.
    sortValue: (r) => r.versionNumber ?? '',
    render: (r) => <VersionPill label={r.versionLabel} isLive={r.versionIsLive} />,
  },
  {
    key: 'details',
    label: 'Details',
    type: 'text',
    width: '',
    value: (r) => r.detail?.summary || '',
    render: (r) => <span className="block truncate text-muted">{r.detail?.summary}</span>,
  },
  {
    key: 'actor',
    label: 'By',
    type: 'text',
    width: 'w-44',
    value: (r) => r.actorName || '',
    render: (r) =>
      r.actorName ? (
        <span className="flex min-w-0 items-center gap-2 text-muted">
          <Avatar name={r.actorName} />
          <span className="truncate">{r.actorName}</span>
        </span>
      ) : null,
  },
  {
    key: 'batch',
    label: 'Batch',
    type: 'number',
    width: 'w-24',
    value: (r) => (r.batchId == null ? '' : String(r.batchId)),
    valueLabel: (v) => `#${v}`,
    number: (r) => r.batchId,
    render: (r, { onBatch }) => (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onBatch(r.batchId) }}
        title="Filter to every event from this same operation"
        className="rounded-md border border-divider px-1.5 py-0.5 font-mono text-[11.5px] text-subtle transition-colors hover:border-accent-light hover:text-accent"
      >
        #{r.batchId}
      </button>
    ),
  },
]
