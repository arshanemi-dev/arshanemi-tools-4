'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X, Search, Plus, ListX } from 'lucide-react'

// Multi Select grid cell (Task: dropdown headers can be Single or Multi
// Selection — this is the Multi Selection render) — same portal-positioned,
// searchable panel pattern as ComboboxCell, but checkbox-driven so several
// options can be picked at once. Rows stay a plain {[headerId]: string} —
// selected values are stored as one comma-separated string in the cell,
// same as every other text-backed cell in this app, rather than changing
// the row schema to hold arrays.
//
// Search box filters the checkbox list as you type; Up/Down moves the
// highlighted option; Enter toggles the highlighted option, or — if nothing
// matches — adds whatever was typed as a brand-new chip. Backspace with an
// empty search box pops the last-added chip (same "tag input" convention as
// an email "To" field). The trigger carries a "clear all" button once
// anything is selected, alongside each chip's own inline remove.
export default function MultiSelectCell({ value, options = [], onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [rect, setRect] = useState(null)
  const [highlighted, setHighlighted] = useState(0)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)

  const selected = useMemo(() => String(value || '').split(',').map((v) => v.trim()).filter(Boolean), [value])

  useEffect(() => {
    function onDocClick(e) {
      if (buttonRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

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
      setQuery('')
      setHighlighted(0)
    }
    setOpen((o) => !o)
  }

  function toggleValue(option) {
    const next = selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option]
    onChange(next.join(', '))
  }
  function removeValue(option) {
    onChange(selected.filter((v) => v !== option).join(', '))
  }
  function clearAll(e) {
    e.stopPropagation()
    onChange('')
  }

  const filtered = options.filter((o) => String(o).toLowerCase().includes(query.toLowerCase()))

  // Adds whatever's typed as a brand-new chip, even though it isn't one of
  // `options` — the "type your own" half of this combobox.
  function addTyped() {
    const trimmed = query.trim()
    if (!trimmed || selected.includes(trimmed)) return
    onChange([...selected, trimmed].join(', '))
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
      if (filtered.length && highlighted >= 0 && highlighted < filtered.length) toggleValue(filtered[highlighted])
      else addTyped()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'Backspace' && !query && selected.length) {
      removeValue(selected[selected.length - 1])
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={`m-1 flex w-[calc(100%-8px)] items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 ${
          open
            ? 'border-accent-light bg-accent/10 ring-2 ring-accent/20'
            : 'border-transparent hover:border-divider hover:bg-surface'
        }`}
      >
        <span className="flex min-h-[20px] flex-wrap gap-1">
          {selected.length === 0 && <span className="text-[13px] italic text-subtle">&mdash;</span>}
          {selected.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11.5px] font-medium text-accent-hover">
              {v}
              {!disabled && (
                <span
                  role="button"
                  tabIndex={-1}
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); removeValue(v) }}
                  className="rounded-full hover:bg-accent/15 hover:text-accent-hover"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </span>
          ))}
        </span>
        <span className="flex flex-shrink-0 items-center gap-0.5">
          {selected.length > 0 && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              title="Clear all"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearAll}
              className="rounded p-0.5 text-subtle hover:bg-red-50 hover:text-red-500"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-subtle transition-transform duration-150 ${open ? 'rotate-180 text-accent' : ''}`} />
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
              placeholder="Search or type to add…"
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
            {options.length === 0 && !query.trim() && (
              <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
                <ListX className="w-4 h-4 text-subtle" />
                <p className="text-[12px] text-subtle">No options yet — type to add one</p>
              </div>
            )}
            {filtered.length === 0 && query.trim() && (
              <button
                type="button"
                onClick={addTyped}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-accent/30 bg-accent/10 px-2.5 py-2 text-left text-[12.5px] text-accent-hover hover:bg-accent/10"
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  Add &quot;{query.trim()}&quot; <span className="font-normal text-accent-light">— press Enter</span>
                </span>
              </button>
            )}
            {filtered.map((option, i) => (
              <label
                key={option}
                onMouseEnter={() => setHighlighted(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${
                  selected.includes(option) ? 'bg-accent/12' : i === highlighted ? 'bg-card-hover' : 'hover:bg-surface'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleValue(option)}
                  className="w-3.5 h-3.5 rounded border-divider-light accent-accent"
                />
                <span className={`truncate ${selected.includes(option) ? 'font-medium text-accent-hover' : i === highlighted ? 'text-foreground' : 'text-muted'}`}>
                  {option}
                </span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-divider px-3 py-1.5">
            <span className="text-[10.5px] text-subtle">
              {selected.length > 0 ? `${selected.length} selected` : options.length > 0 ? `${options.length} option${options.length === 1 ? '' : 's'}` : ''}
            </span>
            {selected.length > 0 && (
              <button type="button" onClick={clearAll} className="text-[11px] font-medium text-subtle hover:text-red-500">
                Clear all
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
