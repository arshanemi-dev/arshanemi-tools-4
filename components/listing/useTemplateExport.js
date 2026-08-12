'use client'
import { useState } from 'react'
import { downloadExcelSmart, downloadPdf } from '@/lib/exports/listingExport'
import { useToast } from '@/components/admin/Toast'

// Shared export flow for every Download Sheet / Download Final Sheet button —
// exactly one request to this template's own /export route (see
// app/api/listing-tools/[templateId]/export/route.js), which does the
// merge+persist (when `sessionRows` is passed — Auto Listing only),
// billing, and SKU assignment all server-side and hands back the final
// content. No confirmation step, no separate persist/SKU calls: a blocked
// result (coins expired) surfaces as BillingGateModal and stops here,
// anything else proceeds straight to generating and downloading the file
// client-side from whatever content the route returned. A billing-call
// network hiccup (not a real blocked decision — no response, or an
// unstructured error) doesn't hold the file hostage; only an actual
// `blocked` decision from the server does.
export default function useTemplateExport(templateId) {
  const { addToast } = useToast()
  const [exporting, setExporting] = useState(false)
  const [gate, setGate] = useState(null)

  async function runExport({ template, groups, format = 'excel', meta, sessionRows }) {
    if (!template || exporting) return
    setExporting(true)
    try {
      const billRes = await fetch(`/api/listing-tools/${templateId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups, sessionRows }),
      }).catch(() => null)
      const billResult = billRes ? await billRes.json().catch(() => ({})) : {}
      if (billRes && !billRes.ok && billResult.blocked) {
        setGate({ reason: billResult.reason, data: billResult.data })
        return
      }

      // The route returns the exact post-merge, post-SKU-assignment content — use it directly
      // instead of re-deriving sheets client-side, so the exported file always matches what was
      // just billed for.
      const effectiveTemplate = billResult.content ? { ...template, sheets: billResult.content.sheets } : template

      if (format === 'excel') await downloadExcelSmart(effectiveTemplate, meta, { groups })
      else await downloadPdf(effectiveTemplate, { groups })

      addToast('Export downloaded', 'success')
    } catch (err) {
      addToast(err.message || 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  return { exporting, gate, closeGate: () => setGate(null), runExport }
}
