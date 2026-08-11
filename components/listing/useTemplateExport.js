'use client'
import { useState } from 'react'
import { downloadExcelSmart, downloadPdf } from '@/lib/exports/listingExport'
import { useToast } from '@/components/admin/Toast'

// Shared export flow for every Download Sheet / Download Final Sheet button:
// (1) bill server-side FIRST via this template's own /export route (see
// app/api/listing-tools/[templateId]/export/route.js) — a blocked result
// (coins expired) stops right here, nothing else runs; (2) only once that
// clears: assign SKUs to any design_system row missing one, then (3)
// generate and download the file client-side. A billing-call network
// hiccup (not a real blocked decision — no response, or an unstructured
// error) doesn't hold the file hostage; only an actual `blocked` decision
// from the server does.
export default function useTemplateExport(templateId) {
  const { addToast } = useToast()
  const [exporting, setExporting] = useState(false)
  const [gate, setGate] = useState(null)

  async function runExport({ template, groups, format = 'excel', meta }) {
    if (!template || exporting) return
    setExporting(true)
    try {
      const billRes = await fetch(`/api/listing-tools/${templateId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups }),
      }).catch(() => null)
      const billResult = billRes ? await billRes.json().catch(() => ({})) : {}
      if (billRes && !billRes.ok && billResult.blocked) {
        setGate({ reason: billResult.reason, data: billResult.data })
        return
      }

      let effectiveTemplate = template

      if (groups.includes('design_system')) {
        const res = await fetch(`/api/listing-tools/${templateId}/skus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group: 'design_system' }),
        }).catch(() => null)
        if (res?.ok) {
          const { sheet } = await res.json()
          effectiveTemplate = {
            ...template,
            sheets: template.sheets.map((s) => (s.group === 'design_system' ? sheet : s)),
          }
        }
      }

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
