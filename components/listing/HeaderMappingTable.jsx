'use client'

import { useMemo, useState } from 'react'
import { Check as CheckIcon, Loader2, Pencil, Settings, SlidersHorizontal, Trash2, X } from 'lucide-react'
import ColumnFilterButton from './ColumnFilterButton'
import { DEFAULT_LIST_SORT, sortItems, matchesQuery } from '@/lib/listSort'

const OUR_COL = '__our__'
const NO_SHEETS = []
const norm = (s) => String(s ?? '').trim().toLowerCase()

// Where a mapped header is placed (Header Place) — same colours as the
// placement grid / New Design tab (red = Product details, green =
// Compulsory, blue = Brand Details).
const PLACE_GROUP = {
  design_system: { label: 'Product details', dot: 'bg-[#e02424]', text: 'text-[#e02424]' },
  compulsory: { label: 'Compulsory', dot: 'bg-[#16a34a]', text: 'text-[#16a34a]' },
  prefill: { label: 'Brand Details', dot: 'bg-[#2563eb]', text: 'text-[#2563eb]' },
}

// A column head with tools-5's funnel (ColumnFilterButton — Sort A → Z /
// Z → A, then search + tick the headers to keep, several at once); `wide` —
// the list in 3 columns, so long header lists show at a glance. Same as
// tools-5's Template Settings HeaderMappingTable.
function ColumnHead({ label, sub, filter, onFilter, getOptions, onOpenChange, sortDir, onSort }) {
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      {/* A sheet column is headed by its file name, which can be long. */}
      <span className="max-w-[16rem] truncate font-normal" title={label}>{label}</span>
      {sub && <span className="text-[10.5px] font-normal text-subtle">· {sub}</span>}
      <ColumnFilterButton label={label} filter={filter} getOptions={getOptions} onChange={onFilter} onOpenChange={onOpenChange} size={13} sortDir={sortDir} onSort={onSort} wide />
    </div>
  )
}

// Distinct names → the funnel's checklist options.
const optionsOf = (names) => [...new Set(names)].map((text) => ({ text }))
const byText = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })

function RowBtn({ title, onClick, disabled, tone, children }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className={`shrink-0 rounded p-1 disabled:opacity-30 ${tone}`}>
      {children}
    </button>
  )
}

function Check({ checked, onChange, label, disabled }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="h-4 w-4 shrink-0 accent-[var(--color-action)] disabled:opacity-30"
    />
  )
}

// The Header Mapping table — tools-5's HeaderMappingTable look on tools-4's
// own data. The Our Header column IS the Our Headers list (tick one —
// single-select — plus Settings / rename / delete per row); every raw sheet
// header has its own checkbox (multi-select). The section's Mapped button
// maps the ticked sheet headers onto the ticked Our Header.
//
// Raw columns, sheet-wise: "Common Sheet Headers" first (in every uploaded
// sheet, only once 2+ are uploaded), then ONE COLUMN PER UPLOADED SHEET
// (`sheets`, headed by its file name) with the rest of that sheet's own
// headers in the sheet's own order — so between them every header of every
// sheet shows. A name two sheets share (but not all of them) is in both
// their columns; mapping is by name, so ticking / mapping / unmapping it in
// one does the same in the other. "Other Sheet Headers" only appears for a
// name that's in no sheet open right now (a mapping kept after its sheet was
// removed) — nothing mapped is ever hidden. With no `sheets` to split by
// (editing a saved template) it's the one pooled "Sheet Headers" column.
// Rows are "merged first": each mapped Our Header is one row with its mapped
// sheet headers as boxes (× unmaps); below, the Unmapped block lists each
// column's leftovers independently. With `showMapping` off (the sidebar's
// Header Mapping eye) only the Our Header column shows.
//
// Filters and sort — tools-5's: every column has the spreadsheet-style
// funnel (search + tick the headers to keep). `ourQuery` (the section's
// search box) looks in EVERY column on top of that: a Mapped row shows when
// its Our Header or a sheet header mapped to it matches; each Unmapped list
// is searched on its own. Our Header's "Sort A → Z / Z → A" is the section's
// own Name sort (`ourSort` / `onOurSort` — the menu and the sort picker above
// the table are one setting); a sheet column's sort orders that column's
// Unmapped list, and the Mapped rows by the header mapped there (rows with
// nothing mapped in it go last). One sheet column at a time, and it steps
// aside when Our Header is sorted.
export default function HeaderMappingTable({
  ourHeaders, mappedHeaders, unmappedRawHeaders, commonHeaderKeys, sheets = NO_SHEETS, showMapping = true,
  activeId, onSelect, checked, onToggleCheck, onUnmap, onRename, isDuplicate, onDelete, busyId,
  onOpenHeaderSettings, onOpenColumnSettings, onOpenRawHeaderSettings,
  categoryForOurHeaderId, categoryOrder, ourQuery = '', ourSort = DEFAULT_LIST_SORT, onOurSort = () => {},
  // The section is in Full Screen — the table takes the screen's height
  // instead of a fixed box (tools-5's `full`).
  full = false,
}) {
  const [filters, setFilters] = useState({}) // { [column]: { values: [header name, ...] } | null }
  const [colSort, setColSort] = useState(null) // { id, dir } — the sheet column the table is sorted on
  const [menuOpen, setMenuOpen] = useState(false) // a filter menu is open — the table makes room for it
  const setFilter = (col) => (f) => setFilters((prev) => ({ ...prev, [col]: f }))
  const allowed = (col) => (filters[col]?.values ? new Set(filters[col].values) : null)
  const grouping = !!categoryOrder && categoryOrder.length > 2
  const categoryOf = (h) => categoryForOurHeaderId?.get(h.id) || 'Unassigned'

  // ourHeaderId → its mapping entry (only entries with sheet headers count).
  const mappedById = useMemo(() => new Map(mappedHeaders.filter((m) => m.sheetHeaders.length).map((m) => [m.ourHeaderId, m])), [mappedHeaders])
  // A mapping whose Our Header was deleted from the dictionary still shows
  // (read-only row) — nothing mapped is ever hidden. Ordered by the Name /
  // Created sort; when grouping, by category first (stable — the chosen
  // sort holds within each category).
  const rows = useMemo(() => {
    const known = new Set(ourHeaders.map((h) => h.id))
    const orphans = [...mappedById.values()].filter((m) => !known.has(m.ourHeaderId)).map((m) => ({ id: m.ourHeaderId, label: m.ourHeaderLabel, orphan: true }))
    const sorted = sortItems([...ourHeaders, ...orphans], ourSort, (h) => h.label)
    if (!grouping) return sorted
    const rank = (h) => {
      const i = categoryOrder.indexOf(categoryForOurHeaderId?.get(h.id) || 'Unassigned')
      return i < 0 ? Number.MAX_SAFE_INTEGER : i
    }
    return [...sorted].sort((a, b) => rank(a) - rank(b))
  }, [ourHeaders, mappedById, ourSort, grouping, categoryForOurHeaderId, categoryOrder])

  // Each column: `pick` says which sheet-header names belong in it, `unmapped`
  // is its leftover list, `total` (when known) every name it stands for.
  const columns = useMemo(() => {
    if (!showMapping) return []
    const common = (h) => !!commonHeaderKeys?.has(norm(h))
    const unmapped = new Set(unmappedRawHeaders)
    const pooled = (pick) => unmappedRawHeaders.filter(pick)
    const out = []
    if (commonHeaderKeys?.size) {
      const all = new Set(sheets.flatMap((s) => s.headers).filter(common))
      out.push({ id: 'common', name: 'Common Sheet Headers', pick: common, unmapped: pooled(common), total: all.size || null })
    }
    if (!sheets.length) {
      const rest = (h) => !common(h)
      return [...out, { id: 'sheet', name: 'Sheet Headers', pick: rest, unmapped: pooled(rest), total: null }]
    }
    const owned = sheets.map((s) => new Set(s.headers))
    sheets.forEach((s, i) => {
      const own = s.headers.filter((h) => !common(h))
      out.push({ id: `sheet:${s.id}`, name: s.name, pick: (h) => !common(h) && owned[i].has(h), unmapped: own.filter((h) => unmapped.has(h)), total: own.length })
    })
    const other = (h) => !common(h) && !owned.some((set) => set.has(h))
    const otherUsed = unmappedRawHeaders.some(other) || mappedHeaders.some((m) => m.sheetHeaders.some(other))
    if (otherUsed) out.push({ id: 'other', name: 'Other Sheet Headers', pick: other, unmapped: pooled(other), total: null })
    return out
  }, [showMapping, commonHeaderKeys, unmappedRawHeaders, sheets, mappedHeaders])

  const mappedFor = (h, c) => (mappedById.get(h.id)?.sheetHeaders || []).filter(c.pick)
  const ourAllowed = allowed(OUR_COL)
  const inOur = (h) => !ourAllowed || ourAllowed.has(h.label)
  const rowMatches = (h) => matchesQuery(h.label, ourQuery) || columns.some((c) => mappedFor(h, c).some((s) => matchesQuery(s, ourQuery)))
  const colAllowed = columns.map((c) => allowed(c.id))
  const sortCol = colSort ? columns.find((c) => c.id === colSort.id) : null
  const sign = colSort?.dir === 'desc' ? -1 : 1
  const mergedMatches = !showMapping ? [] : rows.filter((h) => mappedById.has(h.id)
    && inOur(h) && rowMatches(h)
    && columns.every((c, ci) => !colAllowed[ci] || mappedFor(h, c).some((s) => colAllowed[ci].has(s))))
  const mergedRows = sortCol
    ? [...mergedMatches].sort((a, b) => {
      const x = mappedFor(a, sortCol)[0]
      const y = mappedFor(b, sortCol)[0]
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1 // nothing mapped here → last
      return sign * byText(x, y)
    })
    : mergedMatches
  const ourUnmapped = rows.filter((h) => (!showMapping || !mappedById.has(h.id)) && inOur(h) && matchesQuery(h.label, ourQuery))
  const colUnmapped = columns.map((c, ci) => {
    const list = c.unmapped.filter((o) => (!colAllowed[ci] || colAllowed[ci].has(o)) && matchesQuery(o, ourQuery))
    return sortCol?.id === c.id ? [...list].sort((a, b) => sign * byText(a, b)) : list
  })
  const raggedCount = Math.max(ourUnmapped.length, ...colUnmapped.map((l) => l.length), 0)
  // Every name a column stands for — what its funnel offers.
  const columnNames = (c) => [...mappedHeaders.flatMap((m) => m.sheetHeaders.filter(c.pick)), ...c.unmapped]
  const ourSortDir = ourSort === 'name-asc' ? 'asc' : ourSort === 'name-desc' ? 'desc' : null
  const sortOur = (dir) => { setColSort(null); onOurSort(dir ? `name-${dir}` : DEFAULT_LIST_SORT) }
  // Only the filters of columns on screen count (a removed sheet's goes quiet).
  const filterCount = [OUR_COL, ...columns.map((c) => c.id)].filter((k) => filters[k]?.values).length

  // Per-row rename: Edit swaps the name for an input with Save ✓ / Cancel ×
  // (Enter / Escape too). A name another Our Header already has can't be saved.
  const [editing, setEditing] = useState(null) // { id, text }
  const editDup = !!editing && isDuplicate(editing.text, editing.id)
  const commitEdit = async () => {
    const text = editing?.text.trim()
    if (!text || editDup) return
    const ok = await onRename(editing.id, text)
    if (ok !== false) setEditing(null)
  }

  const ourCell = (h) => {
    const selected = h.id === activeId
    const isEditing = editing?.id === h.id
    const placed = PLACE_GROUP[mappedById.get(h.id)?.group]
    const busy = busyId === h.id
    return (
      <td className={`sticky left-0 z-[1] border border-divider px-2 py-1.5 ${selected ? 'bg-action-soft' : 'bg-background'}`}>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={editing.text}
              onChange={(e) => setEditing({ id: h.id, text: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null) }}
              aria-label={`Rename ${h.label}`}
              title={editDup ? 'Another Our Header already has this name' : undefined}
              className={`min-w-0 flex-1 rounded-md border bg-background px-2 py-0.5 text-[12.5px] text-foreground focus:outline-none ${editDup ? 'border-neg' : 'border-accent'}`}
            />
            <RowBtn title="Save" onClick={commitEdit} disabled={!editing.text.trim() || editDup || busy} tone="text-action hover:bg-action-soft">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckIcon size={13} />}
            </RowBtn>
            <RowBtn title="Cancel" onClick={() => setEditing(null)} tone="text-subtle hover:bg-card-hover hover:text-foreground"><X size={13} /></RowBtn>
            <RowBtn title="Delete" onClick={() => { setEditing(null); onDelete(h.id) }} tone="text-neg hover:bg-neg/10"><Trash2 size={13} /></RowBtn>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
              <Check checked={selected} disabled={h.orphan} onChange={() => onSelect(selected ? null : h.id)} label={`Select ${h.label}`} />
              {showMapping && mappedById.has(h.id) && (
                <span className={`h-2 w-2 shrink-0 rounded-full ${placed ? placed.dot : 'bg-divider-light'}`} title={placed ? `Placed in ${placed.label}` : 'Not placed yet (Header Place)'} />
              )}
              <span className={`min-w-0 truncate ${selected ? 'font-semibold text-foreground' : 'text-muted'}`} title={h.label}>
                {h.label || 'Untitled'}
                {h.orphan ? (
                  <span className="ml-1.5 text-[9.5px] font-medium uppercase tracking-wide text-neg">deleted</span>
                ) : h.scope && (
                  <span className="ml-1.5 text-[9.5px] font-medium uppercase tracking-wide text-subtle">{h.scope}</span>
                )}
                {grouping && categoryOf(h) !== 'Unassigned' && (
                  <span className="ml-1.5 text-[9.5px] font-medium uppercase tracking-wide text-accent">{categoryOf(h)}</span>
                )}
              </span>
            </label>
            {showMapping && mappedById.has(h.id) && onOpenColumnSettings && (
              <RowBtn
                title="Column settings for this template — type, dropdown values, formula…"
                onClick={() => onOpenColumnSettings(h.id)}
                tone={`hover:bg-card-hover ${placed ? placed.text : 'text-subtle hover:text-foreground'}`}
              >
                <SlidersHorizontal size={12} />
              </RowBtn>
            )}
            {!h.orphan && (
              <>
                <RowBtn title="Header settings — type, dropdown default values, unique key…" onClick={() => onOpenHeaderSettings(h.id)} tone="text-subtle hover:bg-card-hover hover:text-foreground"><Settings size={12} /></RowBtn>
                <RowBtn title="Edit" onClick={() => setEditing({ id: h.id, text: h.label })} tone="text-subtle hover:bg-card-hover hover:text-foreground"><Pencil size={12} /></RowBtn>
                <RowBtn title="Delete" onClick={() => onDelete(h.id)} disabled={busy} tone="text-subtle hover:bg-neg/10 hover:text-neg">
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </RowBtn>
              </>
            )}
          </div>
        )}
      </td>
    )
  }
  const sectionRow = (label) => (
    <tr key={`s:${label}`}>
      <td colSpan={1 + columns.length} className="border border-divider bg-card px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-subtle">{label}</td>
    </tr>
  )
  const mergedRow = (h) => (
    <tr key={h.id}>
      {ourCell(h)}
      {columns.map((c) => {
        const cols = mappedFor(h, c)
        return (
          <td key={c.id} className={`border border-divider px-1.5 py-1 align-top ${h.id === activeId ? 'bg-action-soft/40' : ''}`}>
            {cols.length ? (
              <div className="flex flex-wrap gap-1">
                {cols.map((s) => (
                  <span key={s} className="inline-flex max-w-full items-center gap-1 rounded-md border border-action/40 bg-action-soft px-1.5 py-0.5 text-[12px] text-foreground">
                    <span className="truncate" title={s}>{s}</span>
                    <button type="button" onClick={() => onUnmap(s, h.id)} aria-label={`Unmap ${s} from ${h.label}`} className="shrink-0 rounded p-0.5 text-subtle hover:bg-neg/10 hover:text-neg">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[12px] text-subtle">—</span>
            )}
          </td>
        )
      })}
    </tr>
  )

  // Mapped block — one "Mapped · N" band, or one per category when the batch
  // spans several marketplace categories (same grouping the old grid had).
  const mergedBlocks = !mergedRows.length ? [] : grouping
    ? [...new Set(mergedRows.map(categoryOf))].map((cat) => [`Mapped · ${cat} · ${mergedRows.filter((h) => categoryOf(h) === cat).length}`, mergedRows.filter((h) => categoryOf(h) === cat)])
    : [[`Mapped · ${mergedRows.length}`, mergedRows]]

  return (
    <>
    {filterCount > 0 && (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider bg-action-soft px-4 py-1.5 text-xs text-foreground">
        <span>{filterCount} column filter{filterCount === 1 ? '' : 's'} on</span>
        <button type="button" onClick={() => setFilters({})} className="font-semibold text-link hover:underline">Clear all filters</button>
      </div>
    )}
    {/* Taller while a filter menu is open, so the menu isn't cut off. */}
    <div data-table-scroll className={`${full ? 'max-h-[calc(100vh-17rem)]' : 'max-h-[32rem]'} overflow-auto border-y border-divider ${menuOpen ? 'min-h-[32rem]' : 'min-h-[14rem]'}`}>
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 z-10 bg-background text-muted">
          <tr>
            <th className="sticky left-0 z-20 min-w-[16rem] border border-divider bg-background px-2 py-1.5">
              <ColumnHead
                label="Our Header"
                sub={`${ourHeaders.length}`}
                filter={filters[OUR_COL] || null}
                onFilter={setFilter(OUR_COL)}
                getOptions={() => optionsOf(rows.map((h) => h.label))}
                onOpenChange={setMenuOpen}
                sortDir={sortCol ? null : ourSortDir}
                onSort={sortOur}
              />
            </th>
            {columns.map((c) => (
              <th key={c.id} className="min-w-[12rem] border border-divider px-2 py-1.5">
                <ColumnHead
                  label={c.name}
                  sub={`${c.unmapped.length}${c.total == null ? '' : ` of ${c.total}`} unmapped`}
                  filter={filters[c.id] || null}
                  onFilter={setFilter(c.id)}
                  getOptions={() => optionsOf(columnNames(c))}
                  onOpenChange={setMenuOpen}
                  sortDir={sortCol?.id === c.id ? colSort.dir : null}
                  onSort={(dir) => setColSort(dir ? { id: c.id, dir } : null)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mergedBlocks.flatMap(([label, list]) => [sectionRow(label), ...list.map(mergedRow)])}

          {raggedCount > 0 && showMapping && sectionRow('Unmapped')}
          {Array.from({ length: raggedCount }, (_, i) => (
            <tr key={`u${i}`}>
              {ourUnmapped[i] ? ourCell(ourUnmapped[i]) : <td className="sticky left-0 z-[1] border border-divider bg-background" />}
              {columns.map((c, ci) => {
                const o = colUnmapped[ci][i]
                if (!o) return <td key={c.id} className="border border-divider px-2 py-1.5" />
                const on = checked.has(o)
                return (
                  <td key={c.id} className={`border border-divider px-2 py-1.5 ${on ? 'bg-action-soft/60' : ''}`}>
                    <div className="flex items-center gap-1">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2" title={o}>
                        <Check checked={on} onChange={() => onToggleCheck(o)} label={`Select ${o} (${c.name})`} />
                        <span className={`min-w-0 truncate ${on ? 'text-foreground' : 'text-muted'}`}>{o}</span>
                      </label>
                      {onOpenRawHeaderSettings && (
                        <RowBtn title="Header settings — type, dropdown default values, unique key…" onClick={() => onOpenRawHeaderSettings(o)} tone="text-subtle hover:bg-card-hover hover:text-foreground">
                          <Settings size={12} />
                        </RowBtn>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}

          {!mergedRows.length && !raggedCount && (
            <tr>
              <td colSpan={1 + columns.length} className="px-3 py-6 text-center text-[12px] text-subtle">
                {ourHeaders.length || unmappedRawHeaders.length ? 'Nothing matches the filters.' : 'No headers yet — press Add to create one, or upload a sheet.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </>
  )
}
