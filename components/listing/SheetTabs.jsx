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
export default function SheetTabs({ active, onChange, variant = 'light' }) {
  return (
    <div className="flex items-stretch border-b border-divider bg-card">
      {TABS.map((tab) => {
        const isActive = tab.group === active
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
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
