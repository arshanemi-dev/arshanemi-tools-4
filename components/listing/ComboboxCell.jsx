'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X, Search, Check, Loader2, Plus, ListX } from 'lucide-react'

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
//
// `loading` (optional, externally controlled) covers a caller's own real
// async work that a commit here kicked off — Product Group's cross-template
// lookup+backfill (see auto-details/page.js's `loadingCells`) is the one
// case in this app slow enough to need it; the trigger disables and shows a
// spinner for as long as the caller keeps it true. Every commit — including
// ones with no such async follow-up, like a plain Product Number pick —
// still gets its own brief local spinner flash regardless (`justSelected`,
// ~300ms), so every dropdown pick in the grid gives the same "yes, that
// registered" feedback rather than only the slow ones visibly reacting.
export default function ComboboxCell({ value, options = [], onChange, disabled, loading = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const [rect, setRect] = useState(null)
  const [highlighted, setHighlighted] = useState(0)
  const [justSelected, setJustSelected] = useState(false)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)
  const flashTimeoutRef = useRef(null)

  const flashSelected = useCallback(() => {
    setJustSelected(true)
    clearTimeout(flashTimeoutRef.current)
    flashTimeoutRef.current = setTimeout(() => setJustSelected(false), 300)
  }, [])

  useEffect(() => () => clearTimeout(flashTimeoutRef.current), [])

  const showLoader = loading || justSelected

  // Closing commits whatever's typed (same as Enter) rather than silently
  // discarding it — this cell now also backs plain free-typed fields like
  // Product Number (see SheetGrid.jsx's `pickerOptions` branch), so losing a
  // half-typed value just for clicking the next cell would be a real
  // data-loss trap, not just an inconvenience. Escape (see handleKeyDown
  // below) is the one deliberate "never mind, cancel" gesture that still
  // reverts to the prior value instead of committing. Shared by both close
  // paths — clicking elsewhere (below) and re-clicking the trigger itself
  // (toggleOpen) — so neither one is the "safe" path and the other isn't.
  const commitOnClose = useCallback(() => {
    const trimmed = query.trim()
    if (trimmed && trimmed !== (value || '')) {
      onChange(trimmed)
      flashSelected()
    }
  }, [query, value, onChange, flashSelected])

  useEffect(() => {
    function onDocClick(e) {
      if (buttonRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      commitOnClose()
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [commitOnClose])

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
    if (disabled || loading) return
    if (open) {
      commitOnClose()
      setOpen(false)
      return
    }
    const r = buttonRef.current?.getBoundingClientRect()
    if (r) setRect(r)
    setQuery(value || '')
    setHighlighted(0)
    setOpen(true)
  }

  const filtered = options.filter((o) => String(o).toLowerCase().includes(query.toLowerCase()))

  function select(option) {
    onChange(option)
    flashSelected()
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
        disabled={disabled || loading}
        onClick={toggleOpen}
        className={`m-1 flex w-[calc(100%-8px)] items-center justify-between gap-1.5 rounded-md border px-2.5 py-1.5 text-left text-[13px] transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 ${
          open
            ? 'border-accent-light bg-accent/10 ring-2 ring-accent/20'
            : 'border-transparent hover:border-divider hover:bg-surface'
        }`}
      >
        <span className={`truncate ${value ? 'text-foreground' : 'italic text-subtle'}`}>{value || 'Select…'}</span>
        <span className="flex flex-shrink-0 items-center gap-0.5">
          {value && !disabled && !loading && (
            <span
              role="button"
              tabIndex={-1}
              title="Clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearValue}
              className="rounded p-0.5 text-subtle hover:bg-red-50 hover:text-red-500"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          {showLoader ? (
            <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin text-accent" />
          ) : (
            <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-subtle transition-transform duration-150 ${open ? 'rotate-180 text-accent' : ''}`} />
          )}
        </span>
      </button>

      {open && !disabled && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 220) }}
          className="dropdown-panel-in z-[999] origin-top overflow-hidden rounded-xl border border-divider bg-card shadow-lg ring-1 ring-foreground/5"
        >
          <div className="relative bg-surface/70">
            <Search className="pointer-events-none absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-subtle" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlighted(0) }}
              onKeyDown={handleKeyDown}
              placeholder="Search or type a new value…"
              className="w-full border-b border-divider bg-transparent py-2.5 pl-9 pr-8 text-[12.5px] text-foreground placeholder:text-subtle focus:outline-none"
            />
            {query && (
              <button
                type="button"
                title="Clear search"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setQuery(''); setHighlighted(0); inputRef.current?.focus() }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-subtle hover:bg-card-hover/70 hover:text-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto p-1.5">
            {filtered.length === 0 && !query.trim() && (
              <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
                <ListX className="w-4 h-4 text-subtle" />
                <p className="text-[12px] text-subtle">No options yet — type to add one</p>
              </div>
            )}
            {filtered.length === 0 && query.trim() && (
              <button
                type="button"
                onClick={commitTyped}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-accent/30 bg-accent/10 px-2.5 py-2 text-left text-[12.5px] text-accent-hover hover:bg-accent/10"
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  Use &quot;{query.trim()}&quot; <span className="font-normal text-accent-light">— press Enter</span>
                </span>
              </button>
            )}
            {filtered.map((option, i) => (
              <button
                key={option}
                type="button"
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => select(option)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                  option === value
                    ? 'bg-accent/10 font-medium text-accent-hover'
                    : i === highlighted
                    ? 'bg-card-hover text-foreground'
                    : 'text-muted hover:bg-surface'
                }`}
              >
                <span className="truncate">{option}</span>
                {option === value && <Check className="w-3.5 h-3.5 flex-shrink-0 text-accent" />}
              </button>
            ))}
          </div>

          {options.length > 0 && (
            <div className="border-t border-divider px-3 py-1.5 text-[10.5px] text-subtle">
              {filtered.length === options.length ? `${options.length} option${options.length === 1 ? '' : 's'}` : `${filtered.length} of ${options.length}`}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
