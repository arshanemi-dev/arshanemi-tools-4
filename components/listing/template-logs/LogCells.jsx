'use client'

import { actionMeta } from '@/lib/templateLogActions'

// Small presentational pieces shared by the Template Logs grid and its
// detail drawer.

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function Avatar({ name }) {
  return (
    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
      {initialsOf(name)}
    </span>
  )
}

export function ActionChip({ action, size = 'sm' }) {
  const meta = actionMeta(action)
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${meta.chip} ${
        size === 'lg' ? 'px-2.5 py-1 text-[12.5px]' : 'px-2 py-0.5 text-[11.5px]'
      }`}
    >
      <Icon className={`flex-shrink-0 ${size === 'lg' ? 'h-3.5 w-3.5' : 'h-3 w-3'}`} />
      <span className="truncate">{meta.label}</span>
    </span>
  )
}

export function VersionPill({ label, isLive }) {
  if (!label) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-card-hover px-1.5 py-0.5 font-mono text-[12px] font-semibold text-foreground">
      {label}
      {isLive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Live right now" />}
    </span>
  )
}
