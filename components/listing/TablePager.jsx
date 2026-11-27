'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft } from 'lucide-react'

export const PAGE_SIZES = [25, 50, 100]
export const DEFAULT_PAGE_SIZE = 100 // what a table opens at — one of PAGE_SIZES

const NAV_BTN = 'inline-flex items-center gap-1 rounded-lg border border-divider-light px-2 py-1 font-medium text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-40'

// The "1–25 of N rows" summary + First / Previous / Next footer bar under a
// table — same component as tools-5's components/dashboard/TablePager.jsx
// (its rows-per-page picker stays hidden there too; tools-5's portal `slot`
// option is left out — no tools-4 table uses it).
export default function TablePager({ summary, pageSize, onPageSizeChange, currentPage, pageCount, onPageChange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider px-3 py-2 text-xs text-subtle">
      <span>{summary}</span>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Rows per page"
          className="rounded-lg border border-divider-light bg-background px-1.5 py-1 text-xs text-foreground focus:border-accent focus:outline-none hidden"
        >
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button type="button" onClick={() => onPageChange(1)} disabled={currentPage <= 1} title="First page" className={NAV_BTN}>
          <ChevronsLeft size={14} /> First
        </button>
        <button type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} title="Previous page" className={NAV_BTN}>
          <ChevronLeft size={14} /> Previous
        </button>
        <span className="tabular-nums text-foreground">Page {currentPage} of {pageCount}</span>
        <button type="button" onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))} disabled={currentPage >= pageCount} title="Next page" className={NAV_BTN}>
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
