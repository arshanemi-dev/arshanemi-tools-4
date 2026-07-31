'use client'
import { useState } from 'react'
import { runBillingGate } from '@/lib/toolBilling'
import { downloadExcel, downloadPdf, countBillableRows } from '@/lib/exports/listingExport'
import { useToast } from '@/components/admin/Toast'

// Shared export flow for every Download Sheet / Download Final Sheet button:
// (1) assign SKUs to any design_system row missing one, (2) generate and
// download the file client-side — unconditionally, (3) fire the billing
// gate alongside for best-effort coin accounting. Per the confirmed billing
// decision the file always finishes downloading regardless of what the
// gate call returns; a `blocked` result only ever surfaces as a
// non-blocking modal via `gate`/`closeGate`.
export default function useTemplateExport(templateId) {
  const { addToast } = useToast()
  const [exporting, setExporting] = useState(false)
  const [gate, setGate] = useState(null)

  async function runExport({ template, groups, format = 'excel' }) {
    if (!template || exporting) return
    setExporting(true)
    try {
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

      if (format === 'excel') await downloadExcel(effectiveTemplate, { groups })
      else await downloadPdf(effectiveTemplate, { groups })

      const quantity = countBillableRows(effectiveTemplate, groups) || 1
      const result = await runBillingGate({ toolSlug: 'listing-tools', featureApiIdentifier: 'listing-export', quantity })
      if (result.status === 'blocked') setGate(result)
      else addToast('Export downloaded', 'success')
    } catch (err) {
      addToast(err.message || 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  return { exporting, gate, closeGate: () => setGate(null), runExport }
}
