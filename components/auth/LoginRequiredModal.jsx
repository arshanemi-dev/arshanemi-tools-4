'use client'
import { LogIn } from 'lucide-react'
import Modal from '@/components/admin/Modal'
import { redirectToLogin } from '@/lib/authGate'

// Reactive counterpart to the old hard server-side redirect this app used to
// do on every gated route: instead of bouncing a visitor away from the page
// before it ever renders, the page renders normally and this shows up only
// once something they actually did needed a real session (any 401 from the
// backend — see lib/authGate.js's requireLogin(), wired from
// SessionManager.jsx and lib/tokenStore.js's authFetch). Named/worded to
// match the equivalent modal already shipped in tools/arshanemi-tools-2.
export default function LoginRequiredModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Login Required" maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
          <LogIn size={20} className="text-accent" />
        </div>
        <p className="text-sm text-muted">
          To use this feature, please <span className="font-semibold text-foreground">log in</span> to your account.
        </p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={onClose}
            className="px-5 h-9 rounded-lg text-xs font-semibold border border-divider-light text-muted hover:bg-card-hover transition-colors"
          >
            Not now
          </button>
          <button
            onClick={redirectToLogin}
            className="px-5 h-9 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    </Modal>
  )
}
