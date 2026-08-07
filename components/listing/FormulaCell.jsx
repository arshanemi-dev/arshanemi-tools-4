'use client'
import { useState } from 'react'
import { evaluateFormula } from './formula'
import AutoGrowTextarea from './AutoGrowTextarea'

function splitParts(value) {
  return String(value ?? '').split(',').map((v) => v.trim()).filter(Boolean)
}

// Formula-type grid cell — two shapes depending on the current value:
//  - Single value (0-1 comma parts, the common case): one auto-growing, wrapping editable box —
//    same "recomputes unless you're the one typing into it" rule as every other formula cell
//    (see formula.js's recomputeFormulas), computed suggestion shown as a placeholder while
//    genuinely blank.
//  - Multi-valued (>1 comma parts — this formula fanned out across a Multi Select reference, see
//    formula.js's findMultiValueRef): shown as read-only badges by default, matching
//    MultiSelectCell's own picked-option badges. Clicking opens one small input per segment,
//    each independently editable, so overriding one variant's computed value (e.g. one SKU out
//    of three) doesn't touch the others.
//
// While editing, the segments come from local `draftParts`, not a fresh split of `value` — a
// fresh split would collapse/reorder boxes the moment one segment goes blank mid-edit (a filter
// on the live value), which would yank focus out from under whichever box the user is still
// typing in. `draftParts` only resets when editing starts or stops, so box count stays stable
// for the whole edit session. Every keystroke still commits upward immediately (same live-update
// convention as every other cell in this grid) by rejoining the *committed* segments (blanks
// dropped) with ", " — the header itself counts as "currently being edited" throughout, so
// formula.js's recomputeFormulas skips it rather than fighting whichever box has focus.
export default function FormulaCell({ value, formula, headers, row, disabled, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draftParts, setDraftParts] = useState(null)

  const parts = splitParts(value)
  const isMulti = parts.length > 1

  if (!isMulti) {
    return (
      <AutoGrowTextarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={String(evaluateFormula(formula, row, headers) ?? '') || undefined}
        disabled={disabled}
        title={formula || undefined}
        className="w-full min-w-[110px] px-3 py-2 bg-transparent text-gray-800 italic focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-400 disabled:text-gray-400 placeholder:not-italic placeholder:text-gray-400"
      />
    )
  }

  if (!editing) {
    return (
      <div
        onClick={() => { if (!disabled) { setDraftParts(parts); setEditing(true) } }}
        title={formula || undefined}
        className={`w-full min-w-[110px] px-3 py-2 flex flex-wrap gap-1 ${disabled ? '' : 'cursor-text'}`}
      >
        {parts.map((v, i) => (
          <span key={i} className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11.5px] text-indigo-700 italic">
            {v}
          </span>
        ))}
      </div>
    )
  }

  function updatePart(i, nextVal) {
    const next = [...draftParts]
    next[i] = nextVal
    setDraftParts(next)
    onChange(next.map((v) => v.trim()).filter(Boolean).join(', '))
  }

  return (
    <div
      className="w-full min-w-[110px] px-2 py-1.5 flex flex-wrap gap-1"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { setEditing(false); setDraftParts(null) } }}
    >
      {draftParts.map((v, i) => (
        <input
          key={i}
          type="text"
          autoFocus={i === 0}
          value={v}
          onChange={(e) => updatePart(i, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="w-16 min-w-0 px-1.5 py-0.5 text-[11.5px] italic text-indigo-700 bg-indigo-50 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      ))}
    </div>
  )
}
