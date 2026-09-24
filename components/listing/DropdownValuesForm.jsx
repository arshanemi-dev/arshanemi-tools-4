'use client'
import { useState } from 'react'

// Renders one native <select> per key in `fields` ({ [headerLabel]:
// string[] }) — a quick spot-check form for whatever dropdown values got
// auto-detected off the uploaded sheet's own data for each header
// (BulkTemplateDesign.jsx's dropdownColumns, via detectColumnDropdownValues
// — that header's dataType becomes 'dropdown' and these values are what get
// saved under it, template-wise, on Save). Picking a value here is just a
// preview/confirmation that the right options were captured; it doesn't
// change anything on the header itself unless a caller hooks in via
// `onChange`, which fires with the full { [headerLabel]: pickedValue } map
// on every selection.
export default function DropdownValuesForm({ fields, onChange }) {
  const [selected, setSelected] = useState({})

  const entries = Object.entries(fields || {})
  if (entries.length === 0) return null

  function handleSelect(label, value) {
    setSelected((prev) => {
      const next = { ...prev, [label]: value }
      onChange?.(next)
      return next
    })
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([label, options]) => (
        <div key={label} className="min-w-0">
          <label htmlFor={`dropdown-preview-${label}`} className="mb-1 block truncate text-[12.5px] font-medium text-muted" title={label}>
            {label}
          </label>
          <select
            id={`dropdown-preview-${label}`}
            value={selected[label] ?? ''}
            onChange={(e) => handleSelect(label, e.target.value)}
            className="w-full rounded-md border border-divider bg-background px-2.5 py-2 text-[13.5px] text-foreground outline-none focus:border-accent-light"
          >
            <option value="" disabled>
              Select {label}…
            </option>
            {(options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}
