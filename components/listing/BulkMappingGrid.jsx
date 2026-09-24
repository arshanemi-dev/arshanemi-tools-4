'use client'
import { useState } from 'react'
import { Minus, Search, Check, Settings } from 'lucide-react'

const colCls = 'min-w-0 flex-1 rounded-[7px] border border-divider p-2.5'
const searchCls = 'w-full rounded-md border border-divider bg-background pl-6 pr-2 py-1 text-[12px] outline-none focus:border-accent-light'
const groupHeadingCls = 'mb-1 px-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-subtle'

function SearchBox({ value, onChange }) {
  return (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-subtle" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search…" className={searchCls} />
    </div>
  )
}

// Splits `items` into [category, items[]] pairs ordered by `order` (falls
// back to first-seen order for any category not listed there, e.g. one
// BulkTemplateDesign.jsx's own category label list didn't anticipate).
function groupByCategory(items, getCategory, order) {
  const buckets = new Map()
  for (const item of items) {
    const cat = getCategory(item) || 'Unassigned'
    if (!buckets.has(cat)) buckets.set(cat, [])
    buckets.get(cat).push(item)
  }
  const ordered = []
  for (const cat of order || []) {
    if (buckets.has(cat)) {
      ordered.push([cat, buckets.get(cat)])
      buckets.delete(cat)
    }
  }
  for (const rest of buckets) ordered.push(rest)
  return ordered
}

// Shared row for a raw (unmapped) sheet header — used by both the Common
// Headers and Unmap Header columns, since selecting one works identically
// from either (same `selected` set, same "click an Our Header to map" flow).
function RawHeaderRow({ h, selected, onToggle, onOpenSettings }) {
  return (
    <div
      className={`flex w-full items-center gap-1 rounded-md border px-2 py-1 ${
        selected ? 'border-accent bg-accent/10' : 'border-divider bg-background hover:bg-card-hover'
      }`}
    >
      <button type="button" onClick={() => onToggle(h)} title={h} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{h}</span>
        {selected && <Check className="h-3 w-3 flex-shrink-0 text-accent" />}
      </button>
      {onOpenSettings && (
        <button
          type="button"
          onClick={() => onOpenSettings(h)}
          title="Header settings — type, dropdown default values, unique key…"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-subtle hover:bg-card-hover hover:text-foreground"
        >
          <Settings className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function OurHeaderRow({ oh, selectedCount, mapped, onMapSelected, onOpenSettings }) {
  return (
    <div
      className={`flex w-full items-center gap-1 rounded-md border border-divider bg-background px-2 py-1 ${
        selectedCount > 0 ? 'hover:border-accent hover:bg-accent/5' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onMapSelected(oh.id)}
        disabled={selectedCount === 0}
        title={selectedCount > 0 ? `Map ${selectedCount} selected header(s) to "${oh.label}"` : oh.label}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:cursor-default"
      >
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{oh.label}</span>
        <span
          className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            oh.scope === 'common' ? 'bg-card-hover text-subtle' : 'bg-accent/10 text-accent-hover'
          }`}
        >
          {oh.scope === 'common' ? 'common' : 'unique'}
        </span>
        {mapped && (
          <span className="flex-shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            mapped
          </span>
        )}
      </button>
      {onOpenSettings && (
        <button
          type="button"
          onClick={() => onOpenSettings(oh.id)}
          title="Header settings — type, dropdown default values, unique key…"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-subtle hover:bg-card-hover hover:text-foreground"
        >
          <Settings className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function MappedHeaderCard({ m, onUnmap, onOpenSettings }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-muted">{m.ourHeaderLabel}</p>
        {onOpenSettings && (
          <button
            type="button"
            onClick={() => onOpenSettings(m.ourHeaderId)}
            title="Header settings — type, dropdown values, formula, unique key…"
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-subtle hover:bg-card-hover hover:text-foreground"
          >
            <Settings className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {m.sheetHeaders.map((sh) => (
          <span key={sh} className="flex items-center gap-1 rounded-full border border-divider bg-background px-2 py-0.5 text-[11.5px] text-foreground">
            {sh}
            <button type="button" onClick={() => onUnmap(sh, m.ourHeaderId)} title="Unmap" className="text-[#d14343] hover:text-[#a83232]">
              <Minus className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

// 4-column mapping grid — Common Headers / Unmap Header / Our Header / Map
// Header. `unmappedRawHeaders` is every still-unmapped raw header pooled
// across the whole batch; `commonHeaderKeys` (lowercased) splits that same
// pool into "shows up in every uploaded sheet" (Common Headers — GST/Brand
// Name/Manufacturer Details-type fields, only ever non-empty once 2+ sheets
// are uploaded) vs "specific to fewer sheets" (Unmap Header) — the two
// never overlap. `ourHeaders` come straight off
// GET /api/listing-tools/mapping/headers (camelCase — proxied through to
// the hub, see lib/db.js's ourHeaderRowToItem). Click-to-select from either
// raw column, then click-to-assign: select one or more raw headers (toggles
// highlight across BOTH raw columns via the same `selected` set), then
// click a canonical header in the Our Header column to map every selected
// raw header onto it in one go — many raw headers can point at the same
// canonical header — its "children" — which the Map Header column shows
// grouped under that parent, each removable with its own −.
//
// `categoryForOurHeaderId` (Map<ourHeaderId, categoryLabel>) + `categoryOrder`
// (string[]) — same Marketplace/Category grouping the Sheets & Headers tree
// uses (BulkTemplateDesign.jsx's own categoryForOurHeaderId/categoryOrder),
// applied here as sub-headings inside the Our Header and Map Header
// columns. Only actually sub-divides once the batch has real per-category
// sheets to distinguish (categoryOrder carrying more than just Common/
// Unassigned) — a single-sheet or real-template edit session just renders
// each column as one flat list, same as before.
export default function BulkMappingGrid({
  unmappedRawHeaders, commonHeaderKeys, ourHeaders, mappedHeaders, onMap, onUnmap, onOpenSettings,
  onOpenRawHeaderSettings, onOpenOurHeaderSettings, categoryForOurHeaderId, categoryOrder,
}) {
  const [selected, setSelected] = useState(() => new Set())
  const [searchCommon, setSearchCommon] = useState('')
  const [searchUnmap, setSearchUnmap] = useState('')
  const [searchOur, setSearchOur] = useState('')
  const [searchMapped, setSearchMapped] = useState('')

  const mappedIds = new Set(mappedHeaders.filter((m) => m.sheetHeaders.length > 0).map((m) => m.ourHeaderId))
  const grouping = categoryOrder && categoryOrder.length > 2

  const isCommon = (h) => commonHeaderKeys?.has(h.trim().toLowerCase())
  const commonHeaders = unmappedRawHeaders.filter(isCommon)
  const uniqueRawHeaders = unmappedRawHeaders.filter((h) => !isCommon(h))
  const commonFiltered = commonHeaders.filter((h) => h.toLowerCase().includes(searchCommon.toLowerCase()))
  const unmappedFiltered = uniqueRawHeaders.filter((h) => h.toLowerCase().includes(searchUnmap.toLowerCase()))
  const ourFiltered = ourHeaders.filter((h) => h.label.toLowerCase().includes(searchOur.toLowerCase()))
  const mappedFiltered = mappedHeaders
    .filter((m) => m.sheetHeaders.length > 0)
    .filter((m) => m.ourHeaderLabel.toLowerCase().includes(searchMapped.toLowerCase()))

  function toggleSelected(h) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(h)) next.delete(h)
      else next.add(h)
      return next
    })
  }

  function mapSelectedTo(ourHeaderId) {
    if (selected.size === 0) return
    for (const h of selected) onMap(h, ourHeaderId)
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row">
      {commonHeaderKeys && commonHeaderKeys.size > 0 && (
        <div className={colCls}>
          <h4 className="mb-2 text-[13px] font-semibold text-foreground">Common Headers ({commonFiltered.length})</h4>
          <SearchBox value={searchCommon} onChange={setSearchCommon} />
          <p className="mb-2 text-[11px] text-subtle">In every uploaded sheet — usually shared fields like GST, Brand Name.</p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {commonFiltered.length === 0 ? (
              <p className="text-[12px] italic text-subtle">Nothing common left unmapped.</p>
            ) : (
              commonFiltered.map((h) => (
                <RawHeaderRow key={h} h={h} selected={selected.has(h)} onToggle={toggleSelected} onOpenSettings={onOpenRawHeaderSettings} />
              ))
            )}
          </div>
        </div>
      )}

      <div className={colCls}>
        <h4 className="mb-2 text-[13px] font-semibold text-foreground">Unmap Header ({unmappedFiltered.length})</h4>
        <SearchBox value={searchUnmap} onChange={setSearchUnmap} />
        <p className="mb-2 text-[11px] text-subtle">
          {selected.size > 0 ? `${selected.size} selected — click an Our Header to map.` : 'Click one or more to select, then click an Our Header.'}
        </p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {unmappedFiltered.length === 0 ? (
            <p className="text-[12px] italic text-subtle">Nothing unmapped.</p>
          ) : (
            unmappedFiltered.map((h) => (
              <RawHeaderRow key={h} h={h} selected={selected.has(h)} onToggle={toggleSelected} onOpenSettings={onOpenRawHeaderSettings} />
            ))
          )}
        </div>
      </div>

      <div className={colCls}>
        <h4 className="mb-2 text-[13px] font-semibold text-foreground">Our Header ({ourFiltered.length})</h4>
        <SearchBox value={searchOur} onChange={setSearchOur} />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {grouping ? (
            groupByCategory(ourFiltered, (oh) => categoryForOurHeaderId?.get(oh.id), categoryOrder).map(([cat, items]) => (
              <div key={cat} className="mb-2 last:mb-0">
                <p className={groupHeadingCls}>{cat} ({items.length})</p>
                <div className="space-y-1">
                  {items.map((oh) => (
                    <OurHeaderRow key={oh.id} oh={oh} selectedCount={selected.size} mapped={mappedIds.has(oh.id)} onMapSelected={mapSelectedTo} onOpenSettings={onOpenOurHeaderSettings} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            ourFiltered.map((oh) => (
              <OurHeaderRow key={oh.id} oh={oh} selectedCount={selected.size} mapped={mappedIds.has(oh.id)} onMapSelected={mapSelectedTo} onOpenSettings={onOpenOurHeaderSettings} />
            ))
          )}
        </div>
      </div>

      <div className={colCls}>
        <h4 className="mb-2 text-[13px] font-semibold text-foreground">Map Header ({mappedFiltered.length})</h4>
        <SearchBox value={searchMapped} onChange={setSearchMapped} />
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {mappedFiltered.length === 0 ? (
            <p className="text-[12px] italic text-subtle">No mappings yet.</p>
          ) : grouping ? (
            groupByCategory(mappedFiltered, (m) => categoryForOurHeaderId?.get(m.ourHeaderId), categoryOrder).map(([cat, items]) => (
              <div key={cat} className="mb-2 last:mb-0">
                <p className={groupHeadingCls}>{cat} ({items.length})</p>
                <div className="space-y-2">
                  {items.map((m) => (
                    <MappedHeaderCard key={m.ourHeaderId} m={m} onUnmap={onUnmap} onOpenSettings={onOpenSettings} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            mappedFiltered.map((m) => (
              <MappedHeaderCard key={m.ourHeaderId} m={m} onUnmap={onUnmap} onOpenSettings={onOpenSettings} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
