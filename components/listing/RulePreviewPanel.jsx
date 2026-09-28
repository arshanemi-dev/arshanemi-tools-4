'use client'
import { ArrowRight, Play, Loader2, X } from 'lucide-react'

// Duplicated from BulkPlaceGrid.jsx on purpose (see that file's own note on
// this pattern) — this panel renders standalone above the mapping/place
// grids, not through them, so it needs its own copy of the canonical group
// order (and matching colours — same red/green/blue as /new's own New
// Design tab) rather than pulling in BulkPlaceGrid's unrelated pick/search
// state.
const GROUPS = [
  { id: 'design_system', label: 'Product Details', text: 'text-[#e02424]' },
  { id: 'compulsory', label: 'Compulsory', text: 'text-[#16a34a]' },
  { id: 'prefill', label: 'Brand Details', text: 'text-[#2563eb]' },
]

// Mapping entries render as boxes of at most this many (each list capped at
// 100px tall, scrolling inside), 4 per row (1/2 on
// narrower screens), overflow wrapping onto the next row — instead of one
// long scrolling list.
const MAPPING_BOX_SIZE = 30

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

// Read-only preview of a saved Header Mapping/Mapping Rule's entries
// (sheetHeader -> our header) or a Header Place/Place Rule's entries (our
// header -> group + position index) — shown right above the section it
// belongs to when its name is clicked in the sidebar, so what a rule
// actually contains is visible before (or instead of) hitting Apply on it.
export default function RulePreviewPanel({ type, rule, ourHeaders, onApply, applying, onClose }) {
  if (!rule) return null

  function labelFor(ourHeaderId) {
    return ourHeaders.find((h) => h.id === ourHeaderId)?.label || ourHeaderId
  }

  const entries = rule.entries || []
  const sortedForPlace = type === 'place' ? entries.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : []
  const knownGroupIds = new Set(GROUPS.map((g) => g.id))
  const extraGroupIds = [...new Set(sortedForPlace.map((e) => e.group).filter((g) => g && !knownGroupIds.has(g)))]
  const groupsToRender = type === 'place' ? [...GROUPS, ...extraGroupIds.map((id) => ({ id, label: id, text: 'text-muted' }))] : []

  return (
    <div className="mb-3 rounded-[7px] border border-accent/30 bg-accent/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-[13px] font-semibold text-foreground" title={rule.name}>
          {rule.name}
        </h3>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {onApply && (
            <button
              type="button"
              onClick={onApply}
              disabled={applying}
              className="flex items-center gap-1 rounded-full bg-[#16a34a] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#128a3e] disabled:opacity-60"
            >
              {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              Apply
            </button>
          )}
          <button type="button" onClick={onClose} title="Close preview" className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-subtle hover:bg-card-hover">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-[12px] italic text-subtle">This rule has no saved entries.</p>
      ) : type === 'mapping' ? (
        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {chunk(entries, MAPPING_BOX_SIZE).map((box, bi) => (
            <div key={bi} className="min-w-0 rounded-md border border-divider bg-card p-2">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-subtle">
                {bi * MAPPING_BOX_SIZE + 1}–{bi * MAPPING_BOX_SIZE + box.length} of {entries.length}
              </p>
              <div className="max-h-[100px] space-y-1 overflow-y-auto pr-0.5">
                {box.map((e, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 rounded-md border border-divider/60 bg-background px-2 py-1 text-[12px]">
                    <span className="min-w-0 flex-1 truncate text-foreground" title={e.sheetHeader}>{e.sheetHeader}</span>
                    <ArrowRight className="h-3 w-3 flex-shrink-0 text-subtle" />
                    <span className="min-w-0 flex-1 truncate font-medium text-accent" title={labelFor(e.ourHeaderId)}>{labelFor(e.ourHeaderId)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // One column per group, side by side; each header numbered by its
        // saved per-group position (0-based in the rule, shown 1-based).
        <div className="flex flex-col items-start gap-2 sm:flex-row">
          {groupsToRender.map((g) => {
            const groupEntries = sortedForPlace.filter((e) => (e.group || null) === g.id)
            return (
              <div key={g.id} className="w-full min-w-0 flex-1 rounded-md border border-divider bg-card p-2">
                <p className={`mb-1 text-[11.5px] font-semibold ${g.text}`}>{g.label} ({groupEntries.length})</p>
                {groupEntries.length === 0 ? (
                  <p className="text-[12px] italic text-subtle">Nothing placed.</p>
                ) : (
                  <div className="max-h-[100px] space-y-1 overflow-y-auto pr-0.5">
                    {groupEntries.map((e, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-md border border-divider/60 bg-background px-2 py-1 text-[12px]">
                        <span
                          title={`Position ${(e.position ?? idx) + 1}`}
                          className="flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-card-hover px-1 text-[10px] font-semibold text-subtle"
                        >
                          {(e.position ?? idx) + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-foreground" title={labelFor(e.ourHeaderId)}>{labelFor(e.ourHeaderId)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
