'use client'
import { useState } from 'react'
import { Plus, Minus, Search } from 'lucide-react'

const GROUPS = [
  { id: 'design_system', label: 'Product Details' },
  { id: 'compulsory', label: 'Compulsory' },
  { id: 'prefill', label: 'Brand Details' },
]

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

// Same 3-panel shape as BulkMappingGrid, one step later in the flow: every
// mapped canonical header (from the mapping grid) needs a Group + Position
// before it shows up in the live preview below. `headers` = [{ourHeaderId,
// ourHeaderLabel, group, position}] — group is null until placed.
export default function BulkPlaceGrid({ headers, onPlace, onUnplace }) {
  const [pick, setPick] = useState({}) // { [ourHeaderId]: groupId }
  const [searchUnplaced, setSearchUnplaced] = useState('')
  const [searchPlaced, setSearchPlaced] = useState('')

  const unplaced = headers.filter((h) => !h.group)
  const placed = headers.filter((h) => h.group)

  const unplacedFiltered = unplaced.filter((h) => h.ourHeaderLabel.toLowerCase().includes(searchUnplaced.toLowerCase()))
  const placedFiltered = placed.filter((h) => h.ourHeaderLabel.toLowerCase().includes(searchPlaced.toLowerCase()))

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row">
      <div className={colCls}>
        <h4 className="mb-2 text-[13px] font-semibold text-foreground">Unplaced ({unplacedFiltered.length})</h4>
        <SearchBox value={searchUnplaced} onChange={setSearchUnplaced} />
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {unplacedFiltered.length === 0 ? (
            <p className="text-[12px] italic text-subtle">Nothing to place.</p>
          ) : (
            unplacedFiltered.map((h) => (
              <div key={h.ourHeaderId} className="flex items-center gap-1.5 rounded-md border border-divider bg-background px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground" title={h.ourHeaderLabel}>{h.ourHeaderLabel}</span>
                <select
                  value={pick[h.ourHeaderId] || ''}
                  onChange={(e) => setPick((p) => ({ ...p, [h.ourHeaderId]: e.target.value }))}
                  className="max-w-[110px] rounded border border-divider bg-card px-1 py-0.5 text-[11.5px] outline-none"
                >
                  <option value="">place in…</option>
                  {GROUPS.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => pick[h.ourHeaderId] && onPlace(h.ourHeaderId, pick[h.ourHeaderId])}
                  disabled={!pick[h.ourHeaderId]}
                  title="Place"
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-[#9dbfe8] text-accent disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={colCls}>
        <h4 className="mb-2 text-[13px] font-semibold text-foreground">Groups</h4>
        <div className="space-y-1.5">
          {GROUPS.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-md border border-divider bg-background px-2 py-1.5">
              <span className="text-[12.5px] text-foreground">{g.label}</span>
              <span className="rounded-full bg-card-hover px-1.5 py-0.5 text-[10.5px] font-semibold text-subtle">
                {placed.filter((h) => h.group === g.id).length}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={colCls}>
        <h4 className="mb-2 text-[13px] font-semibold text-foreground">Placed ({placedFiltered.length})</h4>
        <SearchBox value={searchPlaced} onChange={setSearchPlaced} />
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {GROUPS.map((g) => {
            const cards = placedFiltered.filter((h) => h.group === g.id)
            if (cards.length === 0) return null
            return (
              <div key={g.id}>
                <p className="mb-1 text-[12px] font-semibold text-muted">{g.label}</p>
                <div className="flex flex-wrap gap-1">
                  {cards.map((h) => (
                    <span key={h.ourHeaderId} className="flex items-center gap-1 rounded-full border border-divider bg-background px-2 py-0.5 text-[11.5px] text-foreground">
                      {h.ourHeaderLabel}
                      <button type="button" onClick={() => onUnplace(h.ourHeaderId)} title="Unplace" className="text-[#d14343] hover:text-[#a83232]">
                        <Minus className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
