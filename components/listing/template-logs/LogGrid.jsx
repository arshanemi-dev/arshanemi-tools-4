'use client'

import DataTable from '@/components/listing/DataTable'

// The Template Logs grid — tools-5's table (DataTable): a pinned blue header
// row where every column sorts and filters from its header (sort toggle +
// the spreadsheet-style menu: Sort A → Z / Z → A, then search + tick the
// values to keep), grid lines, striped rows, the "filters on" bar and the
// pager. Sorting / filtering itself lives in the page (useTableView — it
// also drives the export); this renders `table.pageRows`. A row opens its
// detail drawer (click, Enter or Space); the open one is tinted.
export default function LogGrid({ table, columns, loading, loadingLabel, onRowClick, activeRowId, onBatch, empty }) {
  return (
    <DataTable
      table={table}
      columns={columns}
      loading={loading}
      loadingLabel={loadingLabel}
      empty={empty}
      noMatch="No events match these filters — loosen a column filter or clear them all."
      noun="event"
      scrollClass="max-h-[calc(100vh-17rem)]"
    >
      {table.pageRows.map((r) => (
        <tr
          key={r.id}
          tabIndex={0}
          aria-selected={r.id === activeRowId}
          data-active={r.id === activeRowId}
          onClick={() => onRowClick(r)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(r) } }}
          className="cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-light"
        >
          {columns.map((col) => (
            <td key={col.key} className="px-3 py-2 align-middle text-[12.5px]">
              {col.render(r, { onBatch })}
            </td>
          ))}
        </tr>
      ))}
    </DataTable>
  )
}
