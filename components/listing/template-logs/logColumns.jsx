'use client'

import { actionMeta, fmtDate, fmtDateTime, fmtRelative } from '@/lib/templateLogActions'
import { ActionChip, Avatar, VersionPill } from './LogCells'

const time = (iso) => (iso ? new Date(iso).getTime() : null)

// The Template Logs grid's columns — the column shape useTableView reads
// (tools-5's table: `text` = what the column's filter ticks, `sortValue` =
// what it sorts by), plus `search` (what the page's search box matches, when
// it isn't the text) and `render`. The Date & Time column filters by day —
// one tick per day, not per second — and sorts by the real time. Empty cells
// render blank, same as the Template Settings list.
export const LOG_COLUMNS = [
  {
    key: 'createdAt',
    label: 'Date & Time',
    text: (r) => (r.createdAt ? fmtDate(r.createdAt) : ''),
    search: (r) => fmtDateTime(r.createdAt),
    sortValue: (r) => time(r.createdAt),
    render: (r) => (
      <span className="whitespace-nowrap font-mono text-[12px] text-muted" title={fmtRelative(r.createdAt)}>
        {fmtDateTime(r.createdAt)}
      </span>
    ),
  },
  {
    key: 'event',
    label: 'Event',
    text: (r) => actionMeta(r.action).label,
    render: (r) => <ActionChip action={r.action} />,
  },
  {
    key: 'templateNumber',
    label: 'Template #',
    text: (r) => r.templateNumber || '',
    render: (r) => <span className="font-mono text-[12px] text-subtle">{r.templateNumber}</span>,
  },
  {
    key: 'templateName',
    label: 'Template',
    text: (r) => r.templateName || '',
    render: (r) => (
      <span className="inline-flex min-w-0 max-w-[16rem] items-center gap-1.5">
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
    text: (r) => r.versionLabel || '',
    // V10 after V9 — by the real version number, not the label's text.
    sortValue: (r) => r.versionNumber ?? null,
    render: (r) => <VersionPill label={r.versionLabel} isLive={r.versionIsLive} />,
  },
  {
    key: 'details',
    label: 'Details',
    text: (r) => r.detail?.summary || '',
    render: (r) => <span className="mx-auto block max-w-[28rem] truncate text-muted" title={r.detail?.summary || ''}>{r.detail?.summary}</span>,
  },
  {
    key: 'actor',
    label: 'By',
    text: (r) => r.actorName || '',
    render: (r) =>
      r.actorName ? (
        <span className="inline-flex min-w-0 max-w-[14rem] items-center gap-2 text-muted">
          <Avatar name={r.actorName} />
          <span className="truncate">{r.actorName}</span>
        </span>
      ) : null,
  },
  {
    key: 'batch',
    label: 'Batch',
    text: (r) => (r.batchId == null ? '' : `#${r.batchId}`),
    sortValue: (r) => r.batchId ?? null,
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

// The filter "Filter to every event from this batch" sets on the Batch column.
export const batchFilter = (batchId) => ({ values: [`#${batchId}`] })
