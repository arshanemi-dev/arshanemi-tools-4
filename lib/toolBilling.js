'use client'
// Cross-app tool billing gate — client for the admin panel's coin-based
// billing. This app never decides or stores a coin amount, and never
// activates/deactivates anything — it fires ONE call to
// POST /api/wallet/deduct with {toolSlug, featureApiIdentifier, quantity}
// and displays whatever `error` comes back.
//
// Ported near-verbatim from tools/barmeto-tools-1/lib/toolBilling.js —
// both apps share the NEXT_PUBLIC_ADMIN_API_URL env var name.
//
// Gated on NEXT_PUBLIC_IS_PAID, not NEXT_PUBLIC_IS_CONNECT — IS_CONNECT only
// governs auth/login against the admin panel, IS_PAID is the independent
// switch for whether billing enforcement runs at all. When IS_PAID !==
// 'true', runBillingGate() short-circuits to 'proceed' with zero network
// calls — unchanged behavior for anyone not running paid mode.

import { authFetch } from '@/lib/tokenStore'

const API_BASE = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? ''

// Read-only, display-only (e.g. a "Premium" badge shown before the user
// clicks anything) — never part of a billing decision. runBillingGate()
// below never calls this.
async function getMyTool(toolSlug) {
  try {
    const res = await authFetch(`${API_BASE}/api/tools/my`)
    if (!res.ok) return null
    const tools = await res.json()
    return tools.find((t) => t.slug === toolSlug) ?? null
  } catch {
    return null
  }
}

async function deductFeatureCoins({ toolSlug, featureApiIdentifier, idempotencyKey, quantity }) {
  const res = await authFetch(`${API_BASE}/api/wallet/deduct`, {
    method: 'POST',
    body: JSON.stringify({ toolSlug, featureApiIdentifier, idempotencyKey, quantity }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data }
}

// Accounting only, not a billing gate — reports a storage byte delta
// (positive on upload, negative on delete) so the admin panel's storage
// billing cron can bill for it monthly. Fire-and-forget from the caller's
// perspective: log failures, don't block the UI on this.
async function reportStorageUsage({ provider, deltaBytes }) {
  try {
    const res = await authFetch(`${API_BASE}/api/wallet/storage/report`, {
      method: 'POST',
      body: JSON.stringify({ provider, deltaBytes, idempotencyKey: crypto.randomUUID() }),
    })
    if (!res.ok) console.error('Storage usage report failed:', res.status)
  } catch (err) {
    console.error('Storage usage report failed:', err)
  }
}

// Reasons BillingGateModal renders a specific, purpose-built modal for.
// Anything else (network hiccup, 401, 500, validation error) collapses to
// the generic 'error' reason with the raw message preserved in data.message.
const KNOWN_REASONS = ['access_denied', 'feature_unavailable', 'activation_required', 'insufficient_coins', 'coins_expired']

// The gate — a single call to /api/wallet/deduct. Every decision (access,
// activation, coin cost) is made server-side; this just fires the request
// and maps whatever comes back. Per this tool's billing decision, export
// actions never block on the result — callers fire this alongside file
// generation and only use the result for a non-blocking toast.
export async function runBillingGate({ toolSlug, featureApiIdentifier, quantity = 1 }) {
  if (!featureApiIdentifier) return { status: 'proceed' }
  if (process.env.NEXT_PUBLIC_IS_PAID !== 'true') return { status: 'proceed' }

  const result = await deductFeatureCoins({ toolSlug, featureApiIdentifier, idempotencyKey: crypto.randomUUID(), quantity })
  if (result.ok) return { status: 'proceed', data: { usageId: result.usageId, remainingCoins: result.remainingCoins } }

  const reason = KNOWN_REASONS.includes(result.error) ? result.error : 'error'
  return {
    status: 'blocked',
    reason,
    data: { ...result, message: result.error, toolSlug, featureApiIdentifier },
  }
}

export { getMyTool, deductFeatureCoins, reportStorageUsage }
