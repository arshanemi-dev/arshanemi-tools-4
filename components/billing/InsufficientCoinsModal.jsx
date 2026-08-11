'use client'

import { Coins } from 'lucide-react'
import Modal from '@/components/admin/Modal'

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || ''

// Handles both `insufficient_coins` and `coins_expired` — same shell, same
// copy, deliberately no coin numbers (this project hasn't finalized per-
// feature coin costs, so "you need X, you have Y" would just be showing an
// undecided number). Both reasons collapse to the same simple "add more
// coins" message. CTA opens the admin panel's public /plan page (not
// /settings/plan — this app only holds a Bearer token, not an
// admin-panel-origin cookie session).
export default function InsufficientCoinsModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Coins Expired" maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="w-12 h-12 rounded-full bg-surface border border-divider flex items-center justify-center">
          <Coins size={20} className="text-subtle" />
        </div>
        <p className="text-sm text-muted">Your coins have expired. Add more coins to continue.</p>
        <a
          href={`${ADMIN_URL}/plan`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 px-5 h-9 flex items-center justify-center rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          Add Now
        </a>
      </div>
    </Modal>
  )
}
