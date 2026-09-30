'use client'
import { useState } from 'react'
import { Bug, ChevronDown, ChevronRight, Columns3, Rows3, Search, Copy, Check, AlertTriangle, Link2 } from 'lucide-react'
import { DROPDOWN_SOURCES, DROPDOWN_SOURCE_META, columnLetter } from '@/lib/dropdownExtraction'

// Bottom-of-page debug view for the bulk mapping page's dropdown extraction
// (lib/dropdownExtraction.js's `report`, for whichever file is active) —
// every fill-sheet header as a table COLUMN with its extracted values listed
// down it, the same shape a Validations sheet itself has. Each column head
// says which source won (Excel dropdown / Validations sheet / Allowed values
// / Input rows), what every other source had for comparison, which
// Validations-sheet header it was matched to and how (exact / normalized /
// fuzzy), and whether any filled input value falls outside the list.
// Validations-sheet columns that matched no header get their own table
// underneath. Read-only — nothing here changes what gets saved.

const SOURCE_STYLES = {
  excel: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
  validation: 'border-accent/30 bg-accent/10 text-accent',
  allowed: 'border-sky-500/30 bg-sky-500/10 text-sky-600',
  input: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
}
const SHORT = { excel: 'Excel', validation: 'Validation', allowed: 'Allowed', input: 'Input' }
const ROW_STEP = 25

// Where a Validations-sheet header's LINE sits (the row holding every
// header when Vertical, the column when Horizontal) vs. its own SLOT (the
// column its values run down when Vertical, the row they run across when
// Horizontal).
const lineText = (orientation, idx) => (orientation === 'horizontal' ? `column ${columnLetter(idx)}` : `row ${idx + 1}`)
const slotText = (orientation, idx) => (orientation === 'horizontal' ? `row ${idx + 1}` : `column ${columnLetter(idx)}`)

function SourceBadge({ source }) {
  if (!source) {
    return <span className="rounded border border-divider bg-card-hover px-1.5 py-0.5 text-[10.5px] font-medium text-subtle">No values</span>
  }
  return (
    <span title={DROPDOWN_SOURCE_META[source].hint} className={`rounded border px-1.5 py-0.5 text-[10.5px] font-semibold ${SOURCE_STYLES[source]}`}>
      {DROPDOWN_SOURCE_META[source].label}
    </span>
  )
}

// Every source's count side by side — the winner bold, empty ones dimmed —
// so a disagreement (Excel list 4 vs Validations sheet 3) is visible at a glance.
function SourceCounts({ counts, winner }) {
  return (
    <div className="flex flex-wrap gap-x-1.5 text-[10.5px]">
      {DROPDOWN_SOURCES.map((s) => (
        <span
          key={s}
          title={`${DROPDOWN_SOURCE_META[s].label}: ${counts[s]} value${counts[s] === 1 ? '' : 's'}`}
          className={s === winner ? 'font-semibold text-foreground' : counts[s] ? 'text-muted' : 'text-subtle/60'}
        >
          {SHORT[s]} {counts[s]}
        </span>
      ))}
    </div>
  )
}

function HeaderMeta({ h }) {
  return (
    <div className="space-y-1">
      <div className="truncate text-[12.5px] font-semibold text-foreground" title={h.label}>{h.label}</div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="rounded bg-card-hover px-1 py-0.5 font-mono text-[10px] text-subtle" title="Column on the fill sheet">{columnLetter(h.colIdx)}</span>
        <SourceBadge source={h.source} />
        {h.source && <span className="text-[10.5px] text-subtle">{h.values.length}</span>}
      </div>
      <SourceCounts counts={h.counts} winner={h.source} />
      {h.validationColumn && (
        <div className="flex items-center gap-1 text-[10.5px] text-muted" title={`Matched to Validations sheet header "${h.validationColumn.name}" (${h.validationColumn.matchType})`}>
          <Link2 className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{h.validationColumn.name}</span>
          <span className="flex-shrink-0 text-subtle">· {h.validationColumn.matchType}</span>
        </div>
      )}
      {h.outsideList.length > 0 && (
        <div className="flex items-center gap-1 text-[10.5px] text-amber-600" title={`Filled in the input rows but not in the list: ${h.outsideList.join(', ')}`}>
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{h.outsideList.length} input value{h.outsideList.length === 1 ? '' : 's'} not in list</span>
        </div>
      )}
    </div>
  )
}

// columns: [{ key, head: ReactNode, values: string[] }] — one table column
// each, values listed down it, row numbers pinned left, heads pinned top.
function ColumnsTable({ columns, rowLimit }) {
  const maxLen = Math.max(0, ...columns.map((c) => c.values.length))
  const rows = Math.min(maxLen, rowLimit)
  return (
    <div className="max-h-[520px] overflow-auto rounded-md border border-divider">
      <table className="border-separate border-spacing-0 text-[12.5px]">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 border-b border-r border-divider bg-card px-2 py-2 text-left align-top text-[11px] font-semibold text-subtle">#</th>
            {columns.map((c) => (
              <th key={c.key} className="sticky top-0 z-10 min-w-[170px] max-w-[240px] border-b border-r border-divider bg-card px-2.5 py-2 text-left align-top font-normal">
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} className="hover:bg-card-hover/60">
              <td className="sticky left-0 z-[5] border-b border-r border-divider bg-card px-2 py-1 text-right text-[11px] text-subtle">{i + 1}</td>
              {columns.map((c) => (
                <td key={c.key} className="max-w-[240px] truncate border-b border-r border-divider px-2.5 py-1 text-foreground" title={c.values[i] ?? ''}>
                  {c.values[i] ?? ''}
                </td>
              ))}
            </tr>
          ))}
          {rows === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="px-3 py-4 text-center text-[12px] italic text-subtle">No values in these columns.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// Transposed — one header per ROW, its values as chips across.
function RowsTable({ headers, rowLimit }) {
  return (
    <div className="max-h-[520px] overflow-auto rounded-md border border-divider">
      <table className="w-full border-separate border-spacing-0 text-[12.5px]">
        <thead>
          <tr>
            {['Header', 'Values'].map((t) => (
              <th key={t} className="sticky top-0 z-10 border-b border-divider bg-card px-2.5 py-2 text-left text-[11px] font-semibold text-subtle">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {headers.map((h) => (
            <tr key={h.label} className="align-top">
              <td className="w-[230px] min-w-[200px] border-b border-divider px-2.5 py-2"><HeaderMeta h={h} /></td>
              <td className="border-b border-divider px-2.5 py-2">
                {h.values.length === 0 ? (
                  <span className="text-[12px] italic text-subtle">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {h.values.slice(0, rowLimit).map((v) => (
                      <span key={v} className="rounded-full border border-divider bg-background px-2 py-0.5 text-[11.5px] text-foreground">{v}</span>
                    ))}
                    {h.values.length > rowLimit && <span className="px-1 py-0.5 text-[11.5px] text-subtle">+{h.values.length - rowLimit} more</span>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Visible headers as tab-separated columns (label row, source row, then
// values) — pastes into Excel/Sheets in the same column-wise shape.
function toTsv(headers) {
  const esc = (v) => String(v ?? '').replace(/[\t\r\n]+/g, ' ')
  const maxLen = Math.max(0, ...headers.map((h) => h.values.length))
  const lines = [headers.map((h) => esc(h.label)), headers.map((h) => (h.source ? DROPDOWN_SOURCE_META[h.source].label : 'No values'))]
  for (let i = 0; i < maxLen; i++) lines.push(headers.map((h) => esc(h.values[i])))
  return lines.map((l) => l.join('\t')).join('\n')
}

const chipCls = (active) =>
  `rounded-full border px-2.5 py-1 text-[12px] font-medium ${active ? 'border-accent bg-accent text-white' : 'border-divider bg-background text-muted hover:text-foreground'}`

export default function DropdownDebugPanel({ report, fileName }) {
  const [open, setOpen] = useState(true)
  const [filter, setFilter] = useState('dropdowns') // 'dropdowns' | 'all' | 'none' | a DROPDOWN_SOURCES id
  const [query, setQuery] = useState('')
  const [view, setView] = useState('columns')
  const [rowLimit, setRowLimit] = useState(ROW_STEP)
  const [showUnmatched, setShowUnmatched] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!report) return null
  const { headers, validation, unmatchedValidation } = report

  const count = (pred) => headers.filter(pred).length
  const filters = [
    { id: 'dropdowns', label: 'Dropdowns', n: count((h) => h.source) },
    { id: 'all', label: 'All headers', n: headers.length },
    ...DROPDOWN_SOURCES.map((s) => ({ id: s, label: DROPDOWN_SOURCE_META[s].label, n: count((h) => h.source === s) })),
    { id: 'none', label: 'No values', n: count((h) => !h.source) },
  ]
  const q = query.trim().toLowerCase()
  const visible = headers
    .filter((h) => (filter === 'all' ? true : filter === 'dropdowns' ? !!h.source : filter === 'none' ? !h.source : h.source === filter))
    .filter((h) => !q || h.label.toLowerCase().includes(q) || h.values.some((v) => v.toLowerCase().includes(q)))
  const maxLen = Math.max(0, ...visible.map((h) => h.values.length))

  async function copyTsv() {
    try {
      await navigator.clipboard.writeText(toTsv(visible))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked — nothing to fall back to */ }
  }

  return (
    <section className="rounded-[7px] border border-divider bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        {open ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-subtle" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-subtle" />}
        <Bug className="h-4 w-4 flex-shrink-0 text-accent" />
        <h2 className="whitespace-nowrap text-[15px] font-semibold text-foreground">Dropdown Values Debug</h2>
        <span className="hidden min-w-0 truncate text-[12.5px] text-subtle sm:inline">{fileName}</span>
        <span className="ml-auto flex-shrink-0 rounded-full bg-card-hover px-2 py-0.5 text-[11px] font-semibold text-subtle">
          {filters[0].n} / {headers.length} dropdowns
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-divider px-3 pb-3 pt-3">
          <div className="space-y-0.5 text-[12.5px] text-muted">
            <p>
              <span className="font-semibold text-foreground">Fill sheet:</span> {report.dataSheetName} · headers {lineText('vertical', report.headerRowIdx)} · input rows from {lineText('vertical', report.dataStartIdx)}
            </p>
            <p>
              <span className="font-semibold text-foreground">Validations sheet:</span>{' '}
              {validation
                ? `${validation.sheetName} · ${validation.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'} · headers ${lineText(validation.orientation, validation.headerLine)} · values from ${lineText(validation.orientation, validation.valuesLine)} · ${validation.columnsFound} header${validation.columnsFound === 1 ? '' : 's'} found, ${validation.matched} matched`
                : 'none selected'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={chipCls(filter === f.id)}>
                {f.label} ({f.n})
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-[32px] min-w-0 flex-[1_1_220px] items-center gap-2 rounded-md border border-divider bg-background px-2.5">
              <Search className="h-3.5 w-3.5 flex-shrink-0 text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search headers or values…"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-subtle"
              />
            </label>
            <div role="radiogroup" aria-label="Table layout" className="inline-flex h-[32px] rounded-md border border-divider bg-background p-0.5">
              {[['columns', 'Columns', Columns3], ['rows', 'Rows', Rows3]].map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={view === id}
                  onClick={() => setView(id)}
                  className={`flex items-center gap-1.5 rounded px-2.5 text-[12.5px] font-medium ${view === id ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={copyTsv}
              disabled={visible.length === 0}
              title="Copy the visible headers and values as a tab-separated table (pastes into Excel column-wise)"
              className="flex h-[32px] items-center gap-1.5 rounded-md border border-divider bg-background px-2.5 text-[12.5px] font-medium text-muted hover:text-foreground disabled:opacity-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy TSV'}
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-md border border-dashed border-divider px-3 py-6 text-center text-[12.5px] text-subtle">No headers match this filter.</p>
          ) : view === 'columns' ? (
            <ColumnsTable columns={visible.map((h) => ({ key: h.label, head: <HeaderMeta h={h} />, values: h.values }))} rowLimit={rowLimit} />
          ) : (
            <RowsTable headers={visible} rowLimit={rowLimit} />
          )}

          {maxLen > rowLimit && (
            <div className="flex items-center justify-center gap-2 text-[12.5px]">
              <span className="text-subtle">Showing {rowLimit} of {maxLen} values</span>
              <button type="button" onClick={() => setRowLimit((n) => n + ROW_STEP * 4)} className="font-medium text-accent hover:underline">Show more</button>
              <button type="button" onClick={() => setRowLimit(maxLen)} className="font-medium text-accent hover:underline">Show all</button>
            </div>
          )}

          {unmatchedValidation.length > 0 && (
            <div className="rounded-md border border-divider">
              <button type="button" onClick={() => setShowUnmatched((v) => !v)} className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left">
                {showUnmatched ? <ChevronDown className="h-3.5 w-3.5 text-subtle" /> : <ChevronRight className="h-3.5 w-3.5 text-subtle" />}
                <span className="text-[13px] font-medium text-foreground">Validations sheet headers with no matching fill-sheet header</span>
                <span className="rounded-full bg-card-hover px-1.5 py-0.5 text-[10.5px] font-semibold text-subtle">{unmatchedValidation.length}</span>
              </button>
              {showUnmatched && (
                <div className="px-2.5 pb-2.5">
                  <ColumnsTable
                    rowLimit={rowLimit}
                    columns={unmatchedValidation.map((c) => ({
                      key: `${c.line}:${c.name}`,
                      values: c.values,
                      head: (
                        <div className="space-y-1">
                          <div className="truncate text-[12.5px] font-semibold text-foreground" title={c.name}>{c.name}</div>
                          <div className="text-[10.5px] text-subtle">{slotText(validation?.orientation, c.line)} · {c.values.length} values</div>
                        </div>
                      ),
                    }))}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
