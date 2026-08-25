'use client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

// Cross-template save history — every Product Details / Prefill Details row
// this user has ever saved (Auto Listing Save/Download, or a direct Product
// Details/Prefill Details edit), across every template they own, not just
// one. Real row data (write side: lib/listingHistory.js's
// syncProductDetailsHistory/syncPrefillDetailsHistory, fired from the
// /export route's merge step) via the read-only proxies at
// app/api/listing-tools/product-details-history and .../prefill-details-history
// — distinct from TemplateHistoryPanel.jsx's per-template "Saved — Product
// Details, N rows" action log, this shows the actual saved values.
const TABS = [
  { key: 'product', label: 'Product Details', endpoint: '/api/listing-tools/product-details-history', keyLabel: 'Product Number', keyField: 'product_number' },
  { key: 'prefill', label: 'Brand Details', endpoint: '/api/listing-tools/prefill-details-history', keyLabel: 'Brand', keyField: 'brand' },
]

export default function ListingHistoryPage() {
  const [active, setActive] = useState('product')
  const [rows, setRows] = useState(null)
  const tab = TABS.find((t) => t.key === active)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    fetch(tab.endpoint, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((data) => { if (!cancelled) setRows(data.history || []) })
      .catch(() => { if (!cancelled) setRows([]) })
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
              active === t.key ? 'bg-foreground text-foreground' : 'bg-card text-muted border border-divider hover:bg-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="border border-divider rounded-lg overflow-hidden bg-card">
        {rows === null && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-subtle" />
          </div>
        )}
        {rows !== null && rows.length === 0 && (
          <p className="text-center py-16 text-[13px] text-subtle">No {tab.label.toLowerCase()} history yet.</p>
        )}
        {rows !== null && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-surface border-b border-divider">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted">Template</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted">{tab.keyLabel}</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted">SKU</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-divider last:border-0">
                    <td className="px-4 py-2.5 text-muted">{r.template_name}</td>
                    <td className="px-4 py-2.5 text-foreground font-medium">{r[tab.keyField]}</td>
                    <td className="px-4 py-2.5 text-subtle">{r.row_data?.sku || '—'}</td>
                    <td className="px-4 py-2.5 text-subtle">{new Date(r.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
