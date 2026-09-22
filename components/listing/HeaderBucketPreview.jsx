'use client'

// Same 3 real groups + colour scheme as NewTemplateDesign.jsx's SECTIONS
// (Task 3: same visual language, not a re-invented one) — a lighter,
// read-only version: the bulk mapping page shows where each mapped+placed
// header will land as mapping/place rules are applied, but doesn't need
// drag-and-drop reordering here (that happens once via the regular Edit
// Template wizard after save, if needed).
const BUCKETS = [
  { id: 'unplaced', title: 'Unplace', color: '#9aa2ad', tint: 'bg-[#9aa2ad]/12' },
  { id: 'design_system', title: 'Product Details', color: '#e02424', tint: 'bg-[#e02424]/10' },
  { id: 'compulsory', title: 'Compulsory', color: '#16a34a', tint: 'bg-[#16a34a]/10' },
  { id: 'prefill', title: 'Brand Details', color: '#2563eb', tint: 'bg-[#2563eb]/10' },
]

// `headers` = [{ id, label, group }] — group is null/undefined for unplaced.
export default function HeaderBucketPreview({ headers }) {
  return (
    <div className="mt-2 space-y-3">
      {BUCKETS.map((b) => {
        const cards = headers.filter((h) => (h.group || 'unplaced') === b.id)
        return (
          <div key={b.id}>
            <div className="mb-1 flex items-center gap-2 text-[15px] font-bold" style={{ color: b.color }}>
              <span className={`h-3.5 w-1.5 rounded-full border ${b.tint}`} style={{ borderColor: b.color }} aria-hidden />
              {b.title} <span className="text-[12px] font-normal text-subtle">({cards.length})</span>
            </div>
            {cards.length === 0 ? (
              <p className="px-1 py-1 text-[12.5px] italic text-subtle">Nothing here yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {cards.map((h) => (
                  <span
                    key={h.id}
                    className="rounded-md border border-divider bg-card px-2 py-1 text-[12.5px] text-foreground"
                    title={h.label}
                  >
                    {h.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
