'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { X, ExternalLink, Hash, ArrowRight } from 'lucide-react'
import { actionMeta, fmtDateTime, fmtRelative } from '@/lib/templateLogActions'
import { ActionChip, VersionPill, initialsOf } from './LogCells'

function Field({ label, children }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-start gap-3 py-2">
      <dt className="pt-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="min-w-0 text-[13px] text-foreground">{children}</dd>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="border-t border-divider px-5 py-4">
      <h3 className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-subtle">{title}</h3>
      {children}
    </section>
  )
}

function Value({ text, tone }) {
  if (!text) return <span className="italic text-subtle">empty</span>
  return (
    <span className={`break-words rounded px-1 py-0.5 ${tone === 'before' ? 'bg-rose-500/10 text-rose-700 line-through decoration-rose-400/60' : 'bg-emerald-500/10 text-emerald-700'}`}>
      {text}
    </span>
  )
}

function HeaderChips({ labels, total, tone }) {
  if (!total) return null
  const cls = tone === 'added' ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20' : 'bg-rose-500/10 text-rose-700 ring-rose-500/20'
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold text-muted">
        {tone === 'added' ? 'Added' : 'Removed'} <span className="text-subtle">({total})</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {labels.map((l) => (
          <span key={l} className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-medium ring-1 ring-inset ${cls}`}>{l}</span>
        ))}
        {total > labels.length && <span className="px-1 py-0.5 text-[11.5px] text-subtle">+{total - labels.length} more</span>}
      </div>
    </div>
  )
}

// Right-hand panel for one log row: who/when/what, the before → after of
// every field an edit changed (lib/templateLogDiff.js's detail.changes),
// header adds/removes for structure edits, and a jump to the rest of the
// same batch. Esc or the backdrop closes it.
export default function LogDetailDrawer({ log, onClose, onBatch }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const meta = actionMeta(log.action)
  const Icon = meta.icon
  const detail = log.detail || {}
  const changes = Array.isArray(detail.changes) ? detail.changes : []
  const headers = detail.headers

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${meta.label} details`}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-divider bg-background shadow-2xl">
        <header className="flex items-start gap-3 px-5 pb-4 pt-5">
          <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${meta.chip}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold text-foreground">{meta.label}</h2>
            <p className="text-[12px] text-subtle">{fmtRelative(log.createdAt)} · {fmtDateTime(log.createdAt)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-subtle hover:bg-card-hover hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {detail.summary && (
            <p className="mx-5 mb-4 rounded-lg border border-divider bg-card px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">{detail.summary}</p>
          )}

          <dl className="divide-y divide-divider/60 px-5 pb-2">
            <Field label="Event"><ActionChip action={log.action} /></Field>
            <Field label="By">
              <span className="inline-flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">{initialsOf(log.actorName)}</span>
                {log.actorName || 'Unknown'}
              </span>
            </Field>
            <Field label="Template">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`font-medium ${log.templateExists ? '' : 'text-subtle line-through'}`}>{log.templateName}</span>
                {log.templateNumber && <span className="font-mono text-[11.5px] text-subtle">{log.templateNumber}</span>}
                {log.templateExists ? (
                  <Link
                    href={`/listing-tools/template-settings/${log.templateId}/details?tab=versions`}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:text-accent-hover"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  <span className="rounded bg-rose-500/10 px-1 py-px text-[10px] font-bold uppercase text-rose-600">Deleted</span>
                )}
              </div>
            </Field>
            {log.versionLabel && (
              <Field label="Version">
                <span className="inline-flex items-center gap-2">
                  <VersionPill label={log.versionLabel} isLive={log.versionIsLive} />
                  {log.versionIsLive && <span className="text-[12px] font-medium text-emerald-600">Live right now</span>}
                  {log.versionId && !log.versionExists && <span className="text-[12px] text-subtle">since deleted</span>}
                </span>
              </Field>
            )}
            <Field label="Batch">
              <button
                type="button"
                onClick={() => onBatch(log.batchId)}
                className="inline-flex items-center gap-1 rounded-md border border-divider px-1.5 py-0.5 font-mono text-[12px] text-muted hover:border-accent-light hover:text-accent"
              >
                <Hash className="h-3 w-3" />{log.batchId} · show whole batch
              </button>
            </Field>
          </dl>

          {changes.length > 0 && (
            <Section title={`What changed (${changes.length})`}>
              <ul className="space-y-2.5">
                {changes.map((c) => (
                  <li key={c.field} className="rounded-lg border border-divider bg-card p-2.5">
                    <p className="mb-1.5 text-[12px] font-semibold text-muted">{c.label}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                      <Value text={c.before} tone="before" />
                      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-subtle" />
                      <Value text={c.after} tone="after" />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {headers && (
            <Section title="Headers">
              <p className="mb-3 text-[13px] text-foreground">
                <span className="font-semibold tabular-nums">{headers.before}</span>
                <ArrowRight className="mx-1.5 inline h-3.5 w-3.5 text-subtle" />
                <span className="font-semibold tabular-nums">{headers.after}</span>
                <span className="ml-1.5 text-subtle">headers</span>
              </p>
              {headers.restructured ? (
                <p className="text-[12.5px] text-muted">Same headers — moved between groups, reordered, or given a different data type.</p>
              ) : (
                <div className="space-y-3">
                  <HeaderChips labels={headers.added || []} total={headers.addedCount} tone="added" />
                  <HeaderChips labels={headers.removed || []} total={headers.removedCount} tone="removed" />
                </div>
              )}
            </Section>
          )}

          <Section title="Raw event data">
            <details className="group">
              <summary className="cursor-pointer select-none text-[12.5px] font-semibold text-accent hover:text-accent-hover">Show JSON</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-card p-3 font-mono text-[11px] leading-relaxed text-muted">
                {JSON.stringify({ id: log.id, action: log.action, templateId: log.templateId, versionId: log.versionId, batchId: log.batchId, createdAt: log.createdAt, detail }, null, 2)}
              </pre>
            </details>
          </Section>
        </div>
      </aside>
    </div>
  )
}
