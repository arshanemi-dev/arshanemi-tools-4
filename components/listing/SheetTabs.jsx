'use client'

const TABS = [
  { group: 'design_system', label: 'Product details' },
  { group: 'compulsory', label: 'Compulsory' },
  { group: 'prefill', label: 'Prefill' },
  { group: 'optional', label: 'Optional' },
]

// variant="light" — the standalone Product Details page's own tab strip
// (light-gray active pill). variant="dark" — the stacked group blocks on
// the Choose Your Template page (solid black active pill), matching the
// two distinct treatments visible across the source screenshots.
//
// `sheets` — this template's own content.sheets (optional). Two things ride on it:
//  - each sheet's `sheetName` (set at Template Settings' Kanban step, via click-to-rename; see
//    TemplateSettingsWizard.jsx's tabLabelsFromContent) overrides that group's default label
//    below, so a template saved with a renamed group ("Compulsory" → "Mandatory Fields") shows
//    its own name here instead of always falling back to the generic one every template used to
//    share.
//  - a group with zero headers never gets a tab at all. getTemplateContent backfills every
//    template's `content.sheets` with all 4 groups unconditionally (empty ones included) purely
//    so server-side code can always index by group without a null check (see its own comment) —
//    that backfill was never meant to imply every template actually *uses* every group. A
//    template built without, say, a Prefill column mapped to anything ends up with a real
//    `prefill` sheet object but `headers: []`; showing a tab for it just opens onto a permanently
//    blank grid, so it's filtered out here rather than left for every template to render the same
//    fixed 4 tabs regardless of what it was actually set up with.
export default function SheetTabs({ active, onChange, variant = 'light', sheets = [] }) {
  // No `sheets` supplied at all (rather than an empty array) means the caller isn't scoped to a
  // specific template's content yet — fall back to showing every tab instead of hiding all of
  // them, e.g. while `content` is still loading.
  const visibleTabs = sheets.length
    ? TABS.filter((tab) => (sheets.find((s) => s.group === tab.group)?.headers?.length ?? 0) > 0)
    : TABS
  return (
    <div className="flex items-stretch border-b border-divider bg-card">
      {visibleTabs.map((tab) => {
        const isActive = tab.group === active
        const label = sheets.find((s) => s.group === tab.group)?.sheetName || tab.label
        return (
          <button
            key={tab.group}
            type="button"
            onClick={() => onChange(tab.group)}
            className={`px-5 py-2.5 text-[13.5px] font-medium border-r border-divider transition-colors ${
              isActive
                ? variant === 'dark'
                  ? 'bg-background text-foreground'
                  : 'bg-card-hover text-foreground'
                : 'text-subtle hover:text-foreground hover:bg-surface'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
