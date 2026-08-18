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
      if (billRes && !billRes.ok) {
        // A plain 401 (no session at all) isn't a billing `blocked` decision
        // — the shared login-required modal already surfaced for it (see
        // lib/authGate.js). Either way, don't fall through to generating a
        // file from stale/incomplete client state.
        if (billResult.blocked) setGate({ reason: billResult.reason, data: billResult.data })
        return
      }

      // `exportContent` (only present when this call sent `sessionRows`, i.e. Auto Listing) holds
      // just this session's own rows, post-SKU-assignment — the file should show exactly what was
      // just typed, not the full accumulated history `content` carries. Product Details/Prefill
      // Details never send `sessionRows`, so they keep falling back to `content` (their whole
      // point is exporting every previously-saved row).
      const exportSource = billResult.exportContent || billResult.content
      const effectiveTemplate = exportSource ? { ...template, sheets: exportSource.sheets } : template

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
