'use client'

import { Coins } from 'lucide-react'
import Modal from '@/components/admin/Modal'

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || ''

// Handles both `insufficient_coins` and `coins_expired` — same shell,
// different copy. CTA opens the admin panel's public /plan page (not
// /settings/plan — this app only holds a Bearer token, not an
// admin-panel-origin cookie session).
export default function InsufficientCoinsModal({ open, onClose, reason, data }) {
  const expired = reason === 'coins_expired'
  return (
    <Modal open={open} onClose={onClose} title={expired ? 'Coins Expired' : 'Insufficient Coins'} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="w-12 h-12 rounded-full bg-surface border border-divider flex items-center justify-center">
          <Coins size={20} className="text-subtle" />
        </div>
        <p className="text-sm text-muted">
          {expired
            ? 'Your coin balance has expired. Top up to keep exporting listings.'
            : `You need ${data?.requiredCoins ?? ''} coins for this export — you have ${data?.remainingCoins ?? 0}.`}
        </p>
        <a
          href={`${ADMIN_URL}/plan`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 px-5 h-9 flex items-center justify-center rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          Buy Coins
        </a>
      </div>
    </Modal>
  )
}
