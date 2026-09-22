'use client'
import { useState } from 'react'
import { Minus, Search, Check } from 'lucide-react'

const colCls = 'min-w-0 flex-1 rounded-[7px] border border-divider p-2.5'
const searchCls = 'w-full rounded-md border border-divider bg-background pl-6 pr-2 py-1 text-[12px] outline-none focus:border-accent-light'

function SearchBox({ value, onChange }) {
  return (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-subtle" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search…" className={searchCls} />
    </div>
  )
}

// 3-column mapping grid — Unmap Header / Our Header / Map Header, same
// shape as the mockup's column names. `ourHeaders` come straight off
// GET /api/listing-tools/mapping/headers (camelCase — proxied through to
// the hub, see lib/db.js's ourHeaderRowToItem). Click-to-select, then
// click-to-assign: select one or more raw headers in the left column
// (toggles highlight), then click a canonical header in the middle column
// to map every selected raw header onto it in one go — many raw headers
// can point at the same canonical header — its "children" — which the
// right column shows grouped under that parent, each removable with its
// own −.
export default function BulkMappingGrid({ unmappedRawHeaders, ourHeaders, mappedHeaders, onMap, onUnmap }) {
  const [selected, setSelected] = useState(() => new Set())
  const [searchUnmap, setSearchUnmap] = useState('')
  const [searchOur, setSearchOur] = useState('')
  const [searchMapped, setSearchMapped] = useState('')

  const mappedIds = new Set(mappedHeaders.filter((m) => m.sheetHeaders.length > 0).map((m) => m.ourHeaderId))

  const unmappedFiltered = unmappedRawHeaders.filter((h) => h.toLowerCase().includes(searchUnmap.toLowerCase()))
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
              <button
                key={h}
                type="button"
                onClick={() => toggleSelected(h)}
                title={h}
                className={`flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left ${
                  selected.has(h) ? 'border-accent bg-accent/10' : 'border-divider bg-background hover:bg-card-hover'
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{h}</span>
                {selected.has(h) && <Check className="h-3 w-3 flex-shrink-0 text-accent" />}
              </button>
            ))
          )}
        </div>
      </div>

      <div className={colCls}>
        <h4 className="mb-2 text-[13px] font-semibold text-foreground">Our Header ({ourFiltered.length})</h4>
        <SearchBox value={searchOur} onChange={setSearchOur} />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {ourFiltered.map((oh) => (
            <button
              key={oh.id}
              type="button"
              onClick={() => mapSelectedTo(oh.id)}
              disabled={selected.size === 0}
              title={selected.size > 0 ? `Map ${selected.size} selected header(s) to "${oh.label}"` : oh.label}
              className="flex w-full items-center gap-1.5 rounded-md border border-divider bg-background px-2 py-1 text-left disabled:cursor-default enabled:hover:border-accent enabled:hover:bg-accent/5"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{oh.label}</span>
              <span
                className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  oh.scope === 'common' ? 'bg-card-hover text-subtle' : 'bg-accent/10 text-accent-hover'
                }`}
              >
                {oh.scope === 'common' ? 'common' : 'unique'}
              </span>
              {mappedIds.has(oh.id) && (
                <span className="flex-shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  mapped
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={colCls}>
        <h4 className="mb-2 text-[13px] font-semibold text-foreground">Map Header ({mappedFiltered.length})</h4>
        <SearchBox value={searchMapped} onChange={setSearchMapped} />
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {mappedFiltered.length === 0 ? (
            <p className="text-[12px] italic text-subtle">No mappings yet.</p>
          ) : (
            mappedFiltered.map((m) => (
              <div key={m.ourHeaderId}>
                <p className="mb-1 text-[12px] font-semibold text-muted">{m.ourHeaderLabel}</p>
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
            ))
          )}
        </div>
      </div>
    </div>
  )
}
