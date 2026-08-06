'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'

// Multi Select grid cell (Task: dropdown headers can be Single or Multi
// Selection — this is the Multi Selection render) — same portal-positioned
// panel pattern as ComboboxCell, but checkbox-driven so several options can
// be picked at once. Rows stay a plain {[headerId]: string} — selected
// values are stored as one comma-separated string in the cell, same as
// every other text-backed cell in this app, rather than changing the row
// schema to hold arrays.
export default function MultiSelectCell({ value, options = [], onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)

  const selected = String(value || '').split(',').map((v) => v.trim()).filter(Boolean)

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
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </button>

      {open && !disabled && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 170) }}
          className="z-[999] bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {options.length === 0 && <p className="px-2.5 py-2 text-[12px] text-gray-400">No options yet</p>}
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-gray-700 hover:bg-indigo-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggleValue(option)}
                className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600"
              />
              {option}
            </label>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
