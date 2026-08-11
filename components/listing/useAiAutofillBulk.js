'use client'
import { useState } from 'react'
import { useToast } from '@/components/admin/Toast'

// "AI Autofill Up" bulk entry point (plan §10/§11/§13) — distinct from the
// per-row useAiFill hook, not a replacement for it. Billing is now a
// SERVER-SIDE gate inside the ai-fill-bulk route itself (see that route's
// own runServerBillingGate call, right before it touches any row) — this
// hook no longer pre-flights it client-side, so every caller of that route
// bills the same way regardless of which page/button triggered it. A dry
// run still happens first purely for the "nothing to fill" UX early-exit
// (no point firing a real, billable request for a no-op); the real request
// can come back blocked (insufficient coins, not activated, etc.), which
// this hook maps into the same `gate` state BillingGateModal already knows
// how to render.
export default function useAiAutofillBulk(templateId) {
  const { addToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [gate, setGate] = useState(null)
  const [lastSummary, setLastSummary] = useState(null)

  async function runBulk(selections, { onDone, persist = true } = {}) {
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

      // Step 2 — run for real. The route bills itself before touching any
      // row; a blocked result comes back as { blocked: true, reason, data }
      // (402), which maps straight into BillingGateModal's expected shape.
      // `persist: false` (Auto Listing only) tells the route to never touch
      // Blob storage — see the route's own comment for why.
      const res = await fetch(`/api/listing-tools/${templateId}/ai-fill-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections, persist }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.blocked) { setGate({ reason: data.reason, data: data.data }); return }
        addToast(data.error || 'AI Autofill failed', 'error')
        return
      }

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
