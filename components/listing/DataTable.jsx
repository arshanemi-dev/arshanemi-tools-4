'use client'

import { Loader2 } from 'lucide-react'
import ColumnHeaderCell from './ColumnHeaderCell'
import TablePager from './TablePager'
import styles from './DataTable.module.css'

// The blue header band's cell — tools-5's dashboard tables (DetailsTable,
// Position Settings › Orders). For a header cell that isn't a sortable /
// filterable column (a checkbox, Actions), pass it in `lead` / `trail` —
// a text one as <PlainTh>, padded like ColumnHeaderCell's label.
export const TH = 'group/cell bg-[#1565C0] px-1 py-1 text-center font-medium text-white'
export const PlainTh = ({ children }) => (
  <th className={TH}><span className="block whitespace-nowrap px-1">{children}</span></th>
)

// A list table the tools-5 way (DetailsTable's frame): a "filters on" bar
// with a one-click way out, the rows in their own scroll area under a pinned
// blue header row whose every column sorts and filters from its header
// (ColumnHeaderCell), grid lines and striped rows (DataTable.module.css),
// and the pager footer (TablePager). `table` = useTableView(); `children` =
// the <tr>s for `table.pageRows` — every row's `<tr>` can set tools-5's
// `data-selected` / `data-active` / `data-child` for its tints.
export default function DataTable({
  table, columns, lead = null, trail = null, colSpan, children,
  loading = false, loadingLabel = 'Loading…', empty = 'Nothing here yet.', noMatch = 'No rows match the current filters.',
  noun = 'row', nounPlural = `${noun}s`, summaryExtra = null, scrollClass = 'max-h-[65vh]', className = '',
}) {
  const span = colSpan ?? columns.length
  const { count, total, pageStart, pageSize } = table
  const plural = (n) => (n === 1 ? noun : nounPlural)

  return (
    <div className={`overflow-hidden rounded-xl border border-divider bg-background ${className}`}>
      {/* Filters on: say so on the table itself, with a one-click way out. */}
      {table.appliedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider bg-action-soft px-3 py-1.5 text-xs text-foreground">
          <span>
            {table.appliedCount} filter{table.appliedCount === 1 ? '' : 's'} on — showing <span className="font-semibold">{count}</span> of {total} {plural(total)}
          </span>
          <button type="button" onClick={table.clearFilters} className="font-semibold text-link hover:underline">
            Clear all filters
          </button>
        </div>
      )}
      {/* min-h while a filter menu is open: with only a few rows the menu would otherwise be cut off by this scroll area */}
      <div data-table-scroll className={`overflow-auto ${scrollClass} ${table.filterOpen ? 'min-h-[30rem]' : ''}`}>
        <table className={`${styles.table} text-sm`}>
          <thead className="sticky top-0 z-10">
            <tr>
              {lead}
              {columns.map((col) => (
                <th key={col.key} className={TH}>
                  <ColumnHeaderCell {...table.headerProps(col)} />
                </th>
              ))}
              {trail}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={span} className="px-4 py-10 text-center text-sm text-muted">
                  <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {loadingLabel}</span>
                </td>
              </tr>
            ) : count === 0 ? (
              <tr>
                <td colSpan={span} className="px-4 py-10 text-center text-sm text-muted">{total ? noMatch : empty}</td>
              </tr>
            ) : children}
          </tbody>
        </table>
      </div>
      <TablePager
        summary={loading ? loadingLabel : (
          <>
            {count === 0 ? `0 ${nounPlural}` : `${pageStart + 1}–${Math.min(pageStart + pageSize, count)} of ${count} ${plural(count)}`}
            {count !== total && ` (${total} in all)`}
            {summaryExtra}
          </>
        )}
        pageSize={pageSize}
        onPageSizeChange={table.setPageSize}
        currentPage={table.page}
        pageCount={table.pageCount}
        onPageChange={table.setPage}
      />
    </div>
  )
}
