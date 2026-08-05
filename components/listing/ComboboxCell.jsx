'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

// Dropdown grid cell — click opens an option list below the cell, typing
// filters by substring. Reads `options` straight off the header prop the
// caller passes in (header.dropdownSource.values), so it always reflects
// the currently-open template's own saved dropdown source by construction —
// no separate global option store to keep in sync.
//
// The option panel is portaled to document.body and positioned with
// `fixed` coordinates from the trigger's own bounding rect — every grid
// card that uses this cell wraps it in `overflow-hidden`/`overflow-auto`
// (for the rounded-corner + scroll behavior), which clips any child
// regardless of z-index, so a normal in-place absolutely-positioned panel
// gets cut off near a card's bottom/right edge. Escaping via a portal
// sidesteps that entirely instead of fighting it with a higher z-index.
export default function ComboboxCell({ value, options = [], onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const [rect, setRect] = useState(null)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (buttonRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      setOpen(false)
      setQuery(value || '')
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [value])

  // Closing on scroll/resize (rather than re-tracking position live) keeps
  // this simple — reopening recomputes the rect fresh, and the alternative
  // (a scroll/resize listener that repositions every frame) isn't worth it
  // for a grid cell dropdown.
  useEffect(() => {
    if (!open) return
    function close() { setOpen(false) }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function toggleOpen() {
    if (disabled) return
    if (!open) {
      const r = buttonRef.current?.getBoundingClientRect()
      if (r) setRect(r)
      setQuery(value || '')
    }
    setOpen((o) => !o)
  }

  const filtered = options.filter((o) => String(o).toLowerCase().includes(query.toLowerCase()))

  function select(option) {
    onChange(option)
    setQuery(option)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className="w-full min-w-[110px] flex items-center justify-between gap-1 px-3 py-2 text-left text-[13px] text-gray-800 hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-transparent focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500"
      >
        <span className="truncate">{value || ''}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </button>

      {open && !disabled && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 160) }}
          className="z-[999] bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to filter…"
            className="w-full px-2.5 py-1.5 text-[12.5px] border-b border-gray-100 focus:outline-none"
          />
          {filtered.length === 0 && (
            <p className="px-2.5 py-2 text-[12px] text-gray-400">No matches</p>
          )}
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => select(option)}
              className={`w-full text-left px-2.5 py-1.5 text-[12.5px] hover:bg-indigo-50 ${
                option === value ? 'text-indigo-600 font-medium bg-indigo-50/60' : 'text-gray-700'
              }`}
            >
              {option}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
