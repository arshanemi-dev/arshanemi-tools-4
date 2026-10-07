'use client'
import { useState } from 'react'
import { Copy, Check, EyeOff, Search } from 'lucide-react'
import { columnLetter } from '@/lib/dropdownExtraction'

// DropdownDebugPanel's "Headers" tab — every fill-sheet header the extraction
// considered, in sheet order, as one plain list, with a Copy button (one
// header per line, so it pastes into Excel as a single column). Headers
// sitting in columns Excel hides are never considered (lib/sheetVisibility.js's
// isColumnHidden): they're named in a note underneath, only so it's clear why
// they're missing, and are never part of the list or of what gets copied.
// Read-only, like the rest of the panel.

const copyText = (headers) => headers.map((h) => h.label.replace(/[\t\r\n]+/g, ' ')).join('\n')

function HiddenHeadersNote({ headers }) {
  if (!headers.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-divider pt-2.5 text-[12px] text-subtle">
      <EyeOff className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
      <span>
        {headers.length} header{headers.length === 1 ? '' : 's'} in hidden column{headers.length === 1 ? '' : 's'} (hidden in Excel, so not considered and not copied):
      </span>
      {headers.map((h) => (
        <span key={`${h.colIdx}:${h.label}`} className="inline-flex items-center gap-1 rounded border border-divider bg-surface px-1.5 py-0.5">
          <span className="font-mono text-[10px]" title="Column on the fill sheet">{columnLetter(h.colIdx)}</span>
          <span className="font-medium text-muted">{h.label}</span>
        </span>
      ))}
    </div>
  )
}

export default function DebugHeaderList({ headers, hiddenHeaders = [] }) {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)

  const q = query.trim().toLowerCase()
  const shown = q ? headers.filter((h) => h.label.toLowerCase().includes(q)) : headers

  async function copyHeaders() {
    try {
      await navigator.clipboard.writeText(copyText(shown))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked — nothing to fall back to */ }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-[32px] min-w-0 flex-[1_1_220px] items-center gap-2 rounded-md border border-divider bg-background px-2.5">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search headers…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-subtle"
          />
        </label>
        <span className="text-[12.5px] text-subtle">
          {q ? `${shown.length} of ${headers.length}` : headers.length} header{headers.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={copyHeaders}
          disabled={shown.length === 0}
          title="Copy the listed headers, one per line (pastes into Excel as a column)"
          className="flex h-[32px] items-center gap-1.5 rounded-md border border-divider bg-background px-2.5 text-[12.5px] font-medium text-muted hover:text-foreground disabled:opacity-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy headers'}
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-divider px-3 py-6 text-center text-[12.5px] text-subtle">
          {headers.length === 0 ? 'No headers read from this sheet.' : 'No headers match this search.'}
        </p>
      ) : (
        // The scroll box and the multi-column list are separate elements on
        // purpose — a height limit on the columns element itself would spill
        // the overflow sideways into extra columns instead of scrolling.
        <div className="max-h-[520px] overflow-y-auto rounded-md border border-divider">
          <ol className="columns-1 gap-0 sm:columns-2 lg:columns-3 xl:columns-4">
            {shown.map((h, i) => (
              <li key={h.label} className="flex break-inside-avoid items-center gap-2 border-b border-divider px-2.5 py-1.5 text-[12.5px]">
                <span className="w-7 flex-shrink-0 text-right text-[11px] text-subtle">{i + 1}</span>
                <span className="flex-shrink-0 rounded bg-card-hover px-1 py-0.5 font-mono text-[10px] text-subtle" title="Column on the fill sheet">{columnLetter(h.colIdx)}</span>
                <span className="min-w-0 truncate text-foreground" title={h.label}>{h.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <HiddenHeadersNote headers={hiddenHeaders} />
    </div>
  )
}
