// Server-side counterpart to lib/toolBilling.js's runBillingGate. That file
// is 'use client' and depends on browser-only authFetch (reads tokens from
// localStorage) — routes that need to charge coins themselves, rather than
// trust a client hook to have pre-flighted it, use this instead. Same
// POST /api/wallet/deduct contract, forwarded via proxyAdminCall with the
// caller's own request token (authHeaderFrom(req)) so the hub re-derives
// the user server-side exactly like every other cross-app call in this app.
import { randomUUID } from 'crypto'
import { proxyAdminCall, authHeaderFrom } from './connect'

// Mirrors lib/toolBilling.js's KNOWN_REASONS exactly — BillingGateModal on
// the client renders a specific modal for these, everything else collapses
// to the generic 'error' reason.
const KNOWN_REASONS = ['access_denied', 'feature_unavailable', 'activation_required', 'insufficient_coins', 'coins_expired']

export async function runServerBillingGate(req, { toolSlug, featureApiIdentifier, quantity = 1 }) {
  if (!featureApiIdentifier) return { status: 'proceed' }
  if (process.env.NEXT_PUBLIC_IS_PAID !== 'true') return { status: 'proceed' }
console.log(toolSlug, featureApiIdentifier, quantity)
  const { status: httpStatus, data } = await proxyAdminCall('/api/wallet/deduct', {
    method: 'POST',
    body: { toolSlug, featureApiIdentifier, idempotencyKey: randomUUID(), quantity },
    authHeader: authHeaderFrom(req),
  })

  if (httpStatus >= 200 && httpStatus < 300 && data.ok) {
    return { status: 'proceed', data: { usageId: data.usageId, remainingCoins: data.remainingCoins } }
  }

  const reason = KNOWN_REASONS.includes(data.error) ? data.error : 'error'
  return { status: 'blocked', reason, data: { ...data, message: data.error, toolSlug, featureApiIdentifier } }
}
