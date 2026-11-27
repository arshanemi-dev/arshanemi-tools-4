'use client'
import { useEffect, useMemo, useState } from 'react'
import DataTable from '@/components/listing/DataTable'
import useTableView from '@/components/listing/useTableView'
import { fmtDateTime } from '@/lib/templateLogActions'

// Cross-template save history — every Product Details / Prefill Details row
// this user has ever saved (Auto Listing Save/Download, or a direct Product
// Details/Prefill Details edit), across every template they own, not just
// one. Real row data (write side: lib/listingHistory.js's
// syncProductDetailsHistory/syncPrefillDetailsHistory, fired from the
// /export route's merge step) via the read-only proxies at
// app/api/listing-tools/product-details-history and .../prefill-details-history
// — distinct from TemplateHistoryPanel.jsx's per-template "Saved — Product
// Details, N rows" action log, this shows the actual saved values. Every
// column sorts and filters from its header (tools-5's table — DataTable).
const TABS = [
  { key: 'product', label: 'Product Details', endpoint: '/api/listing-tools/product-details-history', keyLabel: 'Product Number', keyField: 'product_number' },
  { key: 'prefill', label: 'Brand Details', endpoint: '/api/listing-tools/prefill-details-history', keyLabel: 'Brand', keyField: 'brand' },
]

const NO_ROWS = []

export default function ListingHistoryPage() {
  const [active, setActive] = useState('product')
  // Rows remember which tab they were loaded for, so switching tabs shows the
  // spinner (rows === null) until that tab's own fetch lands — no reset needed.
  const [loaded, setLoaded] = useState({ key: null, rows: null })
  const tab = TABS.find((t) => t.key === active)
  const rows = loaded.key === active ? loaded.rows : null

  useEffect(() => {
    let cancelled = false
    fetch(tab.endpoint, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((data) => { if (!cancelled) setLoaded({ key: active, rows: data.history || [] }) })
      .catch(() => { if (!cancelled) setLoaded({ key: active, rows: [] }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <div className="min-h-[70vh] bg-surface px-6 py-6 space-y-4">
      <div className="flex items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              active === t.key ? 'bg-foreground text-white' : 'bg-card text-muted border border-divider hover:bg-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* A new tab is a new table — its filters and sort start fresh. */}
      <HistoryTable key={active} tab={tab} rows={rows} />
    </div>
  )
}

function HistoryTable({ tab, rows }) {
  const columns = useMemo(() => [
    { key: 'template', label: 'Template', text: (r) => r.template_name },
    { key: 'key', label: tab.keyLabel, text: (r) => r[tab.keyField] },
    { key: 'sku', label: 'SKU', text: (r) => r.row_data?.sku || '' },
    { key: 'updated', label: 'Updated', text: (r) => (r.updated_at ? fmtDateTime(r.updated_at) : ''), sortValue: (r) => (r.updated_at ? new Date(r.updated_at).getTime() : null) },
  ], [tab])
  const table = useTableView(rows || NO_ROWS, columns, { defaultSort: { key: 'updated', dir: 'desc' } })

  return (
    <DataTable
      table={table}
      columns={columns}
      loading={rows === null}
      empty={`No ${tab.label.toLowerCase()} history yet.`}
      noun="row"
    >
      {table.pageRows.map((r) => (
        <tr key={r.id}>
          <td className="px-3 py-2.5 text-muted">{r.template_name}</td>
          <td className="px-3 py-2.5 font-medium text-foreground">{columns[1].text(r)}</td>
          <td className="px-3 py-2.5 text-subtle">{r.row_data?.sku || '—'}</td>
          <td className="px-3 py-2.5 whitespace-nowrap text-subtle">{r.updated_at ? fmtDateTime(r.updated_at) : '—'}</td>
        </tr>
      ))}
    </DataTable>
  )
}
