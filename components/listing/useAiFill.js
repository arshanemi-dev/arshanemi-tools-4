'use client'
import { useState } from 'react'
import { runBillingGate } from '@/lib/toolBilling'
import { useToast } from '@/components/admin/Toast'

// Per-row "Fill by AI" (plan §5) + image auto-read (plan §6) — both fire the
// existing coin-wallet gate BEFORE calling the API route (Decision #3: AI
// actions block on insufficient coins, unlike export which never blocks).
// Neither path persists server-side — the caller merges the returned
// `fields` into row state via `onFillRow`, and the page's existing
// debounced sheets/[group] PATCH saves it, same as any other cell edit.
export default function useAiFill(templateId) {
  const { addToast } = useToast()
  const [pendingKey, setPendingKey] = useState(null) // `${group}:${rowIndex}` currently being filled, or null
  const [gate, setGate] = useState(null)

  async function runFill({ group, rowIndex, imageHeaderId, featureApiIdentifier, onFillRow }) {
    const key = `${group}:${rowIndex}`
    if (pendingKey) return
    setPendingKey(key)
    try {
      const gateResult = await runBillingGate({ toolSlug: 'listing-tools', featureApiIdentifier, quantity: 1 })
      if (gateResult.status === 'blocked') { setGate(gateResult); return }

      const res = await fetch(`/api/listing-tools/${templateId}/ai-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group, rowIndex, imageHeaderId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { addToast(data.error || 'AI fill failed', 'error'); return }

      const fields = data.fields || {}
      if (Object.keys(fields).length === 0) {
        addToast(imageHeaderId ? 'Nothing new to fill from that image' : 'Nothing to fill — every eligible field is already set')
        return
      }
      onFillRow(rowIndex, fields)
      addToast(imageHeaderId ? 'Filled from image' : 'Filled by AI')
    } catch (err) {
      addToast(err.message || 'AI fill failed', 'error')
    } finally {
      setPendingKey(null)
    }
  }

  function fillRow(group, rowIndex, onFillRow) {
    return runFill({ group, rowIndex, featureApiIdentifier: 'listing-ai-fill', onFillRow })
  }

  function fillRowFromImage(group, rowIndex, imageHeaderId, onFillRow) {
    return runFill({ group, rowIndex, imageHeaderId, featureApiIdentifier: 'listing-image-fill', onFillRow })
  }

  return { pendingKey, gate, closeGate: () => setGate(null), fillRow, fillRowFromImage }
}
