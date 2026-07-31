'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

// Dropdown grid cell — click opens an option list below the cell, typing
// filters by substring. Reads `options` straight off the header prop the
// caller passes in (header.dropdownSource.values), so it always reflects
// the currently-open template's own saved dropdown source by construction —
// no separate global option store to keep in sync.
export default function ComboboxCell({ value, options = [], onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const wrapRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setQuery(value || '')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [value])

  const filtered = options.filter((o) => String(o).toLowerCase().includes(query.toLowerCase()))

  function select(option) {
    onChange(option)
    setQuery(option)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setQuery(value || ''); setOpen((o) => !o) }}
        className="w-full min-w-[110px] flex items-center justify-between gap-1 px-3 py-2 text-left text-[13px] text-gray-800 hover:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-transparent focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500"
      >
        <span className="truncate">{value || ''}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </button>

      {open && !disabled && (
        <div className="absolute z-20 top-full left-0 mt-0.5 w-full min-w-[160px] bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
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
        </div>
      )}
    </div>
  )
}
