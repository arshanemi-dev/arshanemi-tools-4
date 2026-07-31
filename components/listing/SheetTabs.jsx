'use client'

const TABS = [
  { group: 'design_system', label: 'Design details' },
  { group: 'compulsory', label: 'Compulsory' },
  { group: 'prefill', label: 'Prefill' },
  { group: 'optional', label: 'Optional' },
]

// variant="light" — the standalone Design Details page's own tab strip
// (light-gray active pill). variant="dark" — the stacked group blocks on
// the Choose Your Template page (solid black active pill), matching the
// two distinct treatments visible across the source screenshots.
export default function SheetTabs({ active, onChange, variant = 'light' }) {
  return (
    <div className="flex items-stretch border-b border-gray-200 bg-white">
      {TABS.map((tab) => {
        const isActive = tab.group === active
        return (
          <button
            key={tab.group}
            type="button"
            onClick={() => onChange(tab.group)}
            className={`px-5 py-2.5 text-[13.5px] font-medium border-r border-gray-200 transition-colors ${
              isActive
                ? variant === 'dark'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-900'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
