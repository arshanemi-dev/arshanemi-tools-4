'use client'
import { useState, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

// confirmText (optional) — if provided, user must type it exactly before Delete is enabled
export default function ConfirmDialog({
  open, title, description,
  onConfirm, onCancel, loading,
  confirmText,
  confirmLabel = 'Delete',
}) {
  const [typed, setTyped] = useState('')

  // clear input each time the dialog opens
  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  if (!open) return null

  const canConfirm = confirmText ? typed === confirmText : true

  function handleKeyDown(e) {
    if (e.key === 'Enter' && canConfirm && !loading) onConfirm()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">{title || 'Are you sure?'}</h3>
            <p className="mt-1 text-sm text-subtle">
              {description || 'This action cannot be undone.'}
            </p>
          </div>
          <button onClick={onCancel} className="text-subtle hover:text-muted flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type-to-confirm input */}
        {confirmText && (
          <div className="mt-5">
            <p className="text-sm text-muted mb-2">
              Type <span className="font-semibold text-foreground bg-surface px-1.5 py-0.5 rounded font-mono text-[13px]">{confirmText}</span> to confirm:
            </p>
            <input
              autoFocus
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={confirmText}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
                typed && typed !== confirmText
                  ? 'border-red-300 focus:ring-red-300'
                  : typed === confirmText
                  ? 'border-green-400 focus:ring-green-300'
                  : 'border-divider-light focus:ring-red-400'
              }`}
            />
            {typed && typed !== confirmText && (
              <p className="text-xs text-red-500 mt-1">Name doesn't match</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-card border border-divider-light text-muted hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !canConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
