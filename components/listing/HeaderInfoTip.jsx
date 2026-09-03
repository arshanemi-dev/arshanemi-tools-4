'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

// Small "ⓘ" button that sits on the right of every column header in the
// Auto Details / Product Details stacked layout — click toggles a short
// popover showing that header's own instructional note (`description`, the
// text split off the raw header label at Template Settings time, see
// splitHeaderCell in TemplateSettingsWizard.jsx). Purely presentational:
// it reads props, shows text, and never touches row/template state.
//
// The panel is portaled to <body> with `fixed` coords off the icon's own
// bounding rect — the exact same escape hatch ComboboxCell.jsx uses, since
// every grid/flex block wraps its content in `overflow-hidden`/`overflow-auto`
// and would otherwise clip an in-place popover near an edge.
export default function HeaderInfoTip({ label, description, className = '' }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onDocDown(e) {
      if (btnRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      close()
    }
    function onKey(e) { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  function toggle(e) {
    // Header cells double as sort/filter triggers elsewhere in the grid —
    // keep this click from bubbling into any of that.
    e.stopPropagation()
    e.preventDefault()
    if (open) { close(); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setRect(r)
    setOpen(true)
  }

  const hasNote = Boolean(String(description || '').trim())
  // Clamp the 260px panel into the viewport so an edge header's popover
  // stays fully visible.
  const left = rect ? Math.min(Math.max(8, rect.left - 8), (typeof window !== 'undefined' ? window.innerWidth : 9999) - 268) : 0

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-label={`About "${label}"`}
        title="Field info"
        onClick={toggle}
        onMouseDown={(e) => e.stopPropagation()}
        className={`inline-flex items-center justify-center rounded p-0.5 transition-colors ${
          open ? 'text-accent' : 'text-subtle hover:text-accent'
        }`}
      >
        <Info className="h-3 w-3" />
      </button>

      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 6, left, width: 260 }}
          className="dropdown-panel-in z-[999] origin-top rounded-lg border border-divider bg-card p-3 text-left shadow-lg ring-1 ring-foreground/5"
        >
          <p className="mb-1 text-[12px] font-semibold text-foreground">{label || 'Field'}</p>
          {hasNote ? (
            <p className="whitespace-pre-wrap text-[11.5px] leading-snug text-muted">{description}</p>
          ) : (
            <p className="text-[11.5px] italic leading-snug text-subtle">No extra details for this field.</p>
          )}
        </div>,
        document.body
      )}
    </span>
  )
}
