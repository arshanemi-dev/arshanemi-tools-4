'use client'
import { useState } from 'react'
import { runBillingGate } from '@/lib/toolBilling'
import { useToast } from '@/components/admin/Toast'

// "AI Autofill Up" bulk entry point (plan §10/§11/§13) — distinct from the
// per-row useAiFill hook, not a replacement for it. Unlike the per-row path,
// billing is a client-side PRE-FLIGHT: the bulk route reports back how many
// text-fill rows and image-fill rows it's about to process, this hook then
// fires up to two runBillingGate calls (Decision #13), and only if BOTH
// clear does it ask the route to actually run Gemini + persist — so an
// insufficient-coins result blocks the entire batch before any row is
// touched, never a partial run.
export default function useAiAutofillBulk(templateId) {
  const { addToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [gate, setGate] = useState(null)
  const [lastSummary, setLastSummary] = useState(null)

  async function runBulk(selections, { onDone } = {}) {
    if (submitting || !selections?.length) return
    setSubmitting(true)
    setLastSummary(null)
    try {
      // Step 1 — dry run: ask the route to compute row counts only, no
      // Gemini calls, no persistence (plan §13's "the route... computes,
      // from the selection" pre-flight).
      const planRes = await fetch(`/api/listing-tools/${templateId}/ai-fill-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections, dryRun: true }),
      })
      const plan = await planRes.json().catch(() => ({}))
      if (!planRes.ok) { addToast(plan.error || 'Could not plan AI Autofill', 'error'); return }

      const { textFillRowCount = 0, imageFillRowCount = 0 } = plan
      if (textFillRowCount === 0 && imageFillRowCount === 0) {
        addToast('Nothing to fill — every selected field is already set')
        return
      }

      if (textFillRowCount > 0) {
        const g = await runBillingGate({ toolSlug: 'listing-tools', featureApiIdentifier: 'listing-ai-fill', quantity: textFillRowCount })
        if (g.status === 'blocked') { setGate(g); return }
      }
      if (imageFillRowCount > 0) {
        const g = await runBillingGate({ toolSlug: 'listing-tools', featureApiIdentifier: 'listing-image-fill', quantity: imageFillRowCount })
        if (g.status === 'blocked') { setGate(g); return }
      }

      // Step 2 — both gates cleared (or nothing needed gating): run for real.
      const res = await fetch(`/api/listing-tools/${templateId}/ai-fill-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { addToast(data.error || 'AI Autofill failed', 'error'); return }

      setLastSummary(data.results || [])
      const filled = (data.results || []).reduce((sum, r) => sum + (r.filledRows || 0), 0)
      addToast(filled > 0 ? `AI Autofill filled ${filled} row(s)` : 'AI Autofill finished — nothing new to fill')
      onDone?.(data.results || [])
    } catch (err) {
      addToast(err.message || 'AI Autofill failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return { submitting, gate, closeGate: () => setGate(null), lastSummary, runBulk }
}
