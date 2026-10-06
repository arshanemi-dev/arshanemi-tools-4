'use client'
import { LayoutList, Table2 } from 'lucide-react'

const VIEWS = [
  { id: 'boxes', label: 'Input Box View', icon: LayoutList, hint: "Each product's fields as input boxes under its row" },
  { id: 'excel', label: 'Excel View', icon: Table2, hint: 'Every column in a row, one tab per group — like the sheet itself' },
]

// The Input Box View / Excel View switch on the fill pages' toolbar (Auto
// Listing, Product Details) — see useFillView.js for what each one shows.
// Same segmented look as the Columns / Rows switch in DropdownDebugPanel.jsx.
export default function FillViewToggle({ view, onChange }) {
  return (
    <div role="radiogroup" aria-label="Page layout" className="inline-flex h-[38px] shrink-0 rounded-lg border border-divider bg-background p-0.5">
      {VIEWS.map(({ id, label, icon: Icon, hint }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={view === id}
          title={hint}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors ${view === id ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}
