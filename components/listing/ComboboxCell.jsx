'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X, Search, Check } from 'lucide-react'

// Dropdown grid cell — click opens a searchable option list below the cell.
// Reads `options` straight off the header prop the caller passes in
// (header.dropdownSource.values), so it always reflects the currently-open
// template's own saved dropdown source by construction — no separate global
// option store to keep in sync.
//
// Search box filters as you type; Up/Down moves the highlighted option;
// Enter commits the highlighted option, or — if nothing in the list matches
// — commits whatever was typed directly as the cell's value (so this stays
// a true combobox: pick from the list, or type your own and press Enter).
// The trigger itself carries a small clear ("x") button once a value is set,
// so emptying a cell never requires opening the panel first.
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
  const [highlighted, setHighlighted] = useState(0)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)

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
      setHighlighted(0)
    }
    setOpen((o) => !o)
  }

  const filtered = options.filter((o) => String(o).toLowerCase().includes(query.toLowerCase()))

  function select(option) {
    onChange(option)
    setQuery(option)
    setOpen(false)
  }

  // Commits whatever's currently typed as a brand-new value, even though it
  // isn't one of `options` — the "type your own" half of this combobox.
  function commitTyped() {
    const trimmed = query.trim()
    if (!trimmed) { onChange(''); setQuery(''); setOpen(false); return }
    select(trimmed)
  }

  function clearValue(e) {
    e.stopPropagation()
    onChange('')
    setQuery('')
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length && highlighted >= 0 && highlighted < filtered.length) select(filtered[highlighted])
      else commitTyped()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery(value || '')
    }
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
        <span className={`truncate ${value ? '' : 'text-gray-400'}`}>{value || 'Select…'}</span>
        <span className="flex items-center gap-0.5 flex-shrink-0">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              title="Clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearValue}
              className="p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && !disabled && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 200) }}
          className="z-[999] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
        >
          <div className="relative border-b border-gray-100">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlighted(0) }}
              onKeyDown={handleKeyDown}
              placeholder="Search or type a new value…"
              className="w-full pl-8 pr-7 py-2 text-[12.5px] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                title="Clear search"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setQuery(''); setHighlighted(0); inputRef.current?.focus() }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 && !query.trim() && (
              <p className="px-3 py-2.5 text-[12px] text-gray-400">No options yet</p>
            )}
            {filtered.length === 0 && query.trim() && (
              <button
                type="button"
                onClick={commitTyped}
                className="w-full flex items-center gap-1.5 text-left px-3 py-2 text-[12.5px] text-indigo-600 hover:bg-indigo-50"
              >
                Use &quot;{query.trim()}&quot; <span className="text-gray-400 font-normal">— press Enter</span>
              </button>
            )}
            {filtered.map((option, i) => (
              <button
                key={option}
                type="button"
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => select(option)}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-[12.5px] ${
                  i === highlighted ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{option}</span>
                {option === value && <Check className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
