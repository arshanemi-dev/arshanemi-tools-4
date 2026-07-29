import Link from 'next/link'
import { Plus, ChevronLeft } from 'lucide-react'

export function PageHeader({ title, description, newHref, backHref }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-start gap-3">
        {backHref && (
          <Link href={backHref}
            className="mt-0.5 p-2 rounded-lg border border-divider text-subtle hover:bg-surface transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
        )}
        <div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {description && <p className="text-sm text-subtle mt-0.5">{description}</p>}
        </div>
      </div>
      {newHref && (
        <Link
          href={newHref}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New
        </Link>
      )}
    </div>
  )
}

export function SaveBar({ onSave, loading, onPreview, previewHref }) {
  return (
    <div className="fixed bottom-0 left-60 right-0 bg-card border-t border-divider px-8 py-4 flex items-center justify-end gap-3 z-10 shadow-sm">
      {(onPreview || previewHref) && (
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl border border-divider-light text-sm font-medium text-muted hover:bg-surface transition-colors"
        >
          Preview ↗
        </a>
      )}
      <button
        type="submit"
        disabled={loading}
        onClick={onSave}
        className="px-6 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
      >
        {loading ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}
