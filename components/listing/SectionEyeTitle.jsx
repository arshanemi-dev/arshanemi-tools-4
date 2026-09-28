'use client'
import { Eye, EyeOff } from 'lucide-react'

// Right-side section heading with the same eye toggle as BulkRuleSidebar's
// own sections — kept in sync with them (BulkTemplateDesign's SECTION_LINKS),
// and `hidden` collapses the section down to just this title. `children` =
// right-aligned title actions, hidden along with the body.
export default function SectionEyeTitle({ title, hidden, onToggle, children }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <h2 className="truncate text-[15px] font-semibold text-foreground">{title}</h2>
        <button
          type="button"
          onClick={onToggle}
          title={hidden ? `Show ${title}` : `Hide ${title}`}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-subtle hover:bg-card-hover"
        >
          {hidden ? <EyeOff className="h-3.5 w-3.5 text-subtle" /> : <Eye className="h-3.5 w-3.5 text-[#16a34a]" />}
        </button>
      </div>
      {!hidden && children}
    </div>
  )
}
