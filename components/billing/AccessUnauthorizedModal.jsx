'use client'

import Modal from '@/components/admin/Modal'
import { Lock } from 'lucide-react'

export default function AccessUnauthorizedModal({ open, onClose, toolTitle, message }) {
  return (
    <Modal open={open} onClose={onClose} title="Access Required" maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="w-12 h-12 rounded-full bg-surface border border-divider flex items-center justify-center">
          <Lock size={20} className="text-subtle" />
        </div>
        <p className="text-sm text-muted">
          {message ?? (
            <>You don&apos;t have access to {toolTitle ? <span className="font-semibold text-foreground">{toolTitle}</span> : 'this feature'}.</>
          )}
        </p>
        <button
          onClick={onClose}
          className="mt-2 px-5 h-9 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  )
}
