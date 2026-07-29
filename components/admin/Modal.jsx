'use client'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, footer, maxWidth = 'max-w-md' }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`bg-card rounded-2xl w-full ${maxWidth} shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider flex-shrink-0">
          <h2 className="font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-subtle hover:text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">{children}</div>

        {footer && <div className="flex gap-3 px-6 pb-6 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  )
}
