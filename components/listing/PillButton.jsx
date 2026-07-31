'use client'
import { Loader2 } from 'lucide-react'

// Shared rounded-pill action button — Upload (teal), Download (indigo),
// Delete (red), Edit (amber), View Details (teal) — the four button colors
// that recur across every Listing Tools toolbar in the source screenshots.
const VARIANTS = {
  upload: 'bg-teal-500 hover:bg-teal-600 text-white',
  download: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  delete: 'bg-red-500 hover:bg-red-600 text-white',
  edit: 'bg-amber-500 hover:bg-amber-600 text-white',
  view: 'bg-teal-500 hover:bg-teal-600 text-white',
  ghost: 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
}

export default function PillButton({ icon: Icon, children, variant = 'download', loading, className = '', ...props }) {
  return (
    <button
      type="button"
      disabled={loading || props.disabled}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${VARIANTS[variant] || VARIANTS.download} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  )
}
