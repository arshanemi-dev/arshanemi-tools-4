'use client'

import AccessUnauthorizedModal from './AccessUnauthorizedModal'
import InsufficientCoinsModal from './InsufficientCoinsModal'
import BillingErrorModal from './BillingErrorModal'

// Orchestrator — one mounted instance per call site, driven by whatever
// runBillingGate() last returned. Every reason here is non-blocking by the
// time it's shown (Listing Tools never gates the download itself, see
// lib/toolBilling.js) — these modals are purely informational accounting
// feedback, not an access control surface.
export default function BillingGateModal({ gate, onClose, onRetry }) {
  if (!gate) return null
  const { reason, data } = gate

  if (reason === 'insufficient_coins' || reason === 'coins_expired') {
    return <InsufficientCoinsModal open onClose={onClose} reason={reason} data={data} />
  }
  if (reason === 'error') {
    return <BillingErrorModal open onClose={onClose} onRetry={onRetry} data={data} />
  }
  if (reason === 'activation_required') {
    return (
      <AccessUnauthorizedModal
        open
        onClose={onClose}
        message={`${data?.featureTitle ?? 'Listing exports'} aren't activated for your account yet. Contact your admin to enable this feature.`}
      />
    )
  }
  return (
    <AccessUnauthorizedModal
      open
      onClose={onClose}
      message={reason === 'feature_unavailable' ? 'Coin billing for exports isn’t available right now — your file still downloaded.' : undefined}
    />
  )
}
