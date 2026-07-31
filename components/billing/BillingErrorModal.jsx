'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import Modal from '@/components/admin/Modal'

// A genuine failure while checking billing (network error, unexpected
// server response, etc.) — kept visually and textually distinct from
// AccessUnauthorizedModal so a broken check never reads as "you're not
// allowed to do this." The export itself already went through by the time
// this can show (billing here never blocks the download) — this is purely
// informational, so it never needs to be shown as a blocking gate.
export default function BillingErrorModal({ open, onClose, onRetry, data }) {
  return (
    <Modal open={open} onClose={onClose} title="Coins Couldn't Be Charged" maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
          <AlertTriangle size={20} className="text-red-500" />
        </div>
        <p className="text-sm text-muted">
          Your file downloaded, but we couldn&apos;t record the coin charge{data?.message ? ` — ${data.message}` : ''}. This isn&apos;t a permissions problem.
        </p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-lg text-xs font-semibold border border-divider text-muted hover:bg-card-hover transition-colors"
          >
            Close
          </button>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              <RefreshCw size={13} /> Try Again
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
