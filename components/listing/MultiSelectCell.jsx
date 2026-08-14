'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X, Search } from 'lucide-react'

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
        className="w-full min-w-[130px] flex items-center justify-between gap-1 px-2 py-1.5 text-left focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 disabled:opacity-60"
      >
        <span className="flex flex-wrap gap-1 min-h-[20px]">
          {selected.length === 0 && <span className="text-[13px] text-gray-400">&mdash;</span>}
          {selected.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11.5px] text-indigo-700">
              {v}
              {!disabled && (
                <span
                  role="button"
                  tabIndex={-1}
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); removeValue(v) }}
                  className="hover:text-indigo-900"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-0.5 flex-shrink-0">
          {selected.length > 0 && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              title="Clear all"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearAll}
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
              placeholder="Search or type to add…"
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
            {options.length === 0 && !query.trim() && <p className="px-3 py-2.5 text-[12px] text-gray-400">No options yet</p>}
            {filtered.length === 0 && query.trim() && (
              <button
                type="button"
                onClick={addTyped}
                className="w-full text-left px-3 py-2 text-[12.5px] text-indigo-600 hover:bg-indigo-50"
              >
                Add &quot;{query.trim()}&quot; <span className="text-gray-400 font-normal">— press Enter</span>
              </button>
            )}
            {filtered.map((option, i) => (
              <label
                key={option}
                onMouseEnter={() => setHighlighted(i)}
                className={`flex items-center gap-2 px-3 py-1.5 text-[12.5px] cursor-pointer ${i === highlighted ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleValue(option)}
                  className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600"
                />
                <span className={`truncate ${i === highlighted ? 'text-indigo-700' : 'text-gray-700'}`}>{option}</span>
              </label>
            ))}
          </div>

          {selected.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-1.5">
              <span className="text-[11px] text-gray-400">{selected.length} selected</span>
              <button type="button" onClick={clearAll} className="text-[11px] font-medium text-gray-500 hover:text-red-500">
                Clear all
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
