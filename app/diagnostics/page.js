'use client'
import { useEffect, useState } from 'react'

// Testing-only page — not linked from any nav. Hits /api/diagnostics/urls,
// console.logs the raw result (per the ask: "console.log in front end"), and
// renders it too so it's readable without opening devtools. Delete this page
// and app/api/diagnostics/urls/route.js once the connectivity issue is
// confirmed fixed — this was never meant to ship long-term.
export default function DiagnosticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/diagnostics/urls')
      .then((r) => r.json())
      .then((d) => {
        console.log('[diagnostics] /api/diagnostics/urls ->', d)
        setData(d)
      })
      .catch((err) => console.error('[diagnostics] fetch failed', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <h1 className="text-lg font-semibold text-gray-800 mb-1">URL connectivity check</h1>
      <p className="text-[13px] text-gray-500 mb-4">Full result also logged to the browser console.</p>

      {loading && <p className="text-[13px] text-gray-400">Checking…</p>}

      {data && (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-[12.5px]">
            <p><span className="font-semibold">NEXT_PUBLIC_IS_CONNECT:</span> {String(data.env.NEXT_PUBLIC_IS_CONNECT)}</p>
            <p><span className="font-semibold">NEXT_PUBLIC_ADMIN_API_URL:</span> {String(data.env.NEXT_PUBLIC_ADMIN_API_URL)}</p>
          </div>

          <table className="w-full border-collapse text-[12.5px] bg-white rounded-lg overflow-hidden border border-gray-200">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-3 py-2">URL</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Redirected</th>
                <th className="px-3 py-2">Error</th>
                <th className="px-3 py-2">ms</th>
              </tr>
            </thead>
            <tbody>
              {[...data.results, { ...data.adminLoginCheck, url: `[login proxy] ${data.adminLoginCheck.url}` }].map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 break-all">{r.url}</td>
                  <td className={`px-3 py-2 font-semibold ${r.ok ? 'text-emerald-600' : 'text-red-500'}`}>{r.status ?? '—'}</td>
                  <td className="px-3 py-2">{r.redirected ? `→ ${r.finalUrl}` : '—'}</td>
                  <td className="px-3 py-2 text-red-500">{r.error || '—'}</td>
                  <td className="px-3 py-2 text-gray-400">{r.ms ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
