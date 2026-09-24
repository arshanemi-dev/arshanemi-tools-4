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
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {entries.map((e, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-md border border-divider/60 bg-background px-2 py-1 text-[12px]">
              <span className="min-w-0 flex-1 truncate text-foreground" title={e.sheetHeader}>{e.sheetHeader}</span>
              <ArrowRight className="h-3 w-3 flex-shrink-0 text-subtle" />
              <span className="min-w-0 flex-1 truncate font-medium text-accent" title={labelFor(e.ourHeaderId)}>{labelFor(e.ourHeaderId)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-h-56 space-y-2.5 overflow-y-auto">
          {groupsToRender.map((g) => {
            const groupEntries = sortedForPlace.filter((e) => (e.group || null) === g.id)
            if (groupEntries.length === 0) return null
            return (
              <div key={g.id}>
                <p className={`mb-1 text-[11.5px] font-semibold ${g.text}`}>{g.label}</p>
                <div className="space-y-1">
                  {groupEntries.map((e, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-md border border-divider/60 bg-background px-2 py-1 text-[12px]">
                      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-card-hover text-[10px] font-semibold text-subtle">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-foreground" title={labelFor(e.ourHeaderId)}>{labelFor(e.ourHeaderId)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
