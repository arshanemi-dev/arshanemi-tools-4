'use client'
import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { VISION_TARGET_LABELS } from '@/lib/aiFillPrompt'

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === ''
}
// `aiFilled` (plan §14) is a bookkeeping key, not a header id.
function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || isBlank(v))
}

// Column-level mirror of lib/aiFillPrompt.js's per-row computeFillTargets/
// computeVisionTargets eligibility rules — UI-level only, a convenience so
// the checklist reflects reality at a glance. The bulk route recomputes
// eligibility per row, server-side, from the live headers/row regardless of
// what this modal submits (Decision #11) — a stale or hand-crafted request
// can never sneak an ineligible header through as an actual target.
function columnMetaFor(sheet) {
  const hasImageHeader = sheet.headers.some((h) => h.dataType === 'image')
  return sheet.headers.map((header) => {
    if (header.dataType === 'image') {
      return { header, enabled: false, reason: 'Image column — read as input, never an AI-fill target' }
    }
    if (header.dataType === 'formula') {
      return { header, enabled: false, reason: 'Computed automatically — not an AI-fill target' }
    }
    const isVisionField = hasImageHeader && VISION_TARGET_LABELS.includes((header.label || '').trim().toLowerCase())
    const isDropdownLike = header.dataType === 'dropdown' || header.dataType === 'multiselect'
    const typeEligible = header.dataType === 'text' || (isDropdownLike && header.dropdownSource?.values?.length > 0)
    if (!typeEligible && !isVisionField) {
      return { header, enabled: false, reason: isDropdownLike ? 'No dropdown values configured' : 'Not an AI-fillable field' }
    }
    const hasBlankRow = sheet.rows.some((r) => !isRowEmpty(r) && isBlank(r[header.id]))
    if (!hasBlankRow) {
      return { header, enabled: false, reason: 'Already filled in every row' }
    }
    return { header, enabled: true, reason: null }
  })
}

function defaultCheckedIds(sheet) {
  return new Set(columnMetaFor(sheet).filter((m) => m.enabled).map((m) => m.header.id))
}

// Live estimate only, constrained to the checked columns — the real per-row
// target computation (including general-vs-vision dedup) happens
// server-side via lib/aiFillPrompt.js's computeRowFillTargets.
function countsForSelection(sheet, checkedIds) {
  let rows = 0
  let fields = 0
  for (const row of sheet.rows || []) {
    if (isRowEmpty(row)) continue
    let rowFields = 0
    for (const h of sheet.headers) {
      if (!checkedIds.has(h.id) || !isBlank(row[h.id])) continue
      rowFields++
    }
    if (rowFields > 0) { rows++; fields += rowFields }
  }
  return { rows, fields }
}

// "AI Fill Up" scope picker (plan §10) — group checklist expands into a
// per-group column checklist; ineligible columns (image/formula/already-full/
// not AI-fillable) are left out of that checklist entirely rather than shown
// disabled. `defaultGroup` (the group the modal was launched from) is
// pre-checked with every empty AI-eligible header in it also pre-checked.
// The caller conditionally mounts this (`{show && <AiFillUpModal .../>}`)
// rather than passing an `open` boolean — a fresh mount is what gives fresh
// defaults every time the modal opens, no reset-on-prop-change effect
// needed (an earlier version tried that and hit React's
// set-state-in-effect warning; letting mount/unmount do the reset is the
// idiomatic fix). Confirming calls `onRun([{group, headerIds}, ...])` for
// every group left checked; this modal never itself decides billing or
// fires Gemini — that's entirely useAiAutofillBulk.js + the bulk route.
export default function AiFillUpModal({ onClose, sheets, defaultGroup, onRun }) {
  const [groupChecked, setGroupChecked] = useState(() => new Set(defaultGroup ? [defaultGroup] : []))
  const [headerChecked, setHeaderChecked] = useState(() => {
    const sheet = (sheets || []).find((s) => s.group === defaultGroup)
    return sheet ? { [defaultGroup]: defaultCheckedIds(sheet) } : {}
  })

  const sheetsByGroup = Object.fromEntries((sheets || []).map((s) => [s.group, s]))

  function toggleGroup(group) {
    setGroupChecked((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
    setHeaderChecked((prev) => {
      if (prev[group]) return prev
      const sheet = sheetsByGroup[group]
      return sheet ? { ...prev, [group]: defaultCheckedIds(sheet) } : prev
    })
  }

  function toggleHeader(group, headerId) {
    setHeaderChecked((prev) => {
      const set = new Set(prev[group] || [])
      if (set.has(headerId)) set.delete(headerId)
      else set.add(headerId)
      return { ...prev, [group]: set }
    })
  }

  let totalRows = 0
  let totalFields = 0
  const countsByGroup = {}
  for (const group of groupChecked) {
    const sheet = sheetsByGroup[group]
    const checkedIds = headerChecked[group]
    if (!sheet || !checkedIds?.size) continue
    const counts = countsForSelection(sheet, checkedIds)
    countsByGroup[group] = counts
    totalRows += counts.rows
    totalFields += counts.fields
  }

  function handleConfirm() {
    const selections = [...groupChecked]
      .map((group) => ({ group, headerIds: [...(headerChecked[group] || [])] }))
      .filter((s) => s.headerIds.length > 0)
    if (selections.length === 0) return
    onRun(selections)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 flex-shrink-0">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-gray-800">
            <Sparkles className="w-4 h-4 text-indigo-600" /> AI Fill Up
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          <p className="text-[12px] text-gray-500">
            Fills every empty, AI-eligible field in the rows/columns you leave checked below —
            grounded in your own past listings — billed per row. Fields that already have a value
            are never touched.
          </p>

          {(sheets || []).map((sheet) => {
            const checked = groupChecked.has(sheet.group)
            // Image and formula columns are never AI-fill targets, and a
            // column already filled in every row has nothing left to do —
            // none of those belong in this picker, so only the still-empty,
            // AI-fillable headers (columnMetaFor's `enabled` set) are shown.
            const fillableMeta = columnMetaFor(sheet).filter((m) => m.enabled)
            const checkedIds = headerChecked[sheet.group] || new Set()
            const counts = countsByGroup[sheet.group]
            return (
              <div key={sheet.group} className="rounded-lg border border-gray-200 overflow-hidden">
                <label className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleGroup(sheet.group)}
                    className="w-3.5 h-3.5 rounded border-gray-300 accent-indigo-600"
                  />
                  <span className="text-[12.5px] font-semibold text-gray-800">{sheet.sheetName || sheet.group}</span>
                  <span className="text-[11px] text-gray-400">
                    {sheet.rows.filter((r) => !isRowEmpty(r)).length} row(s)
                  </span>
                  {checked && counts && counts.fields > 0 && (
                    <span className="ml-auto text-[11px] font-medium text-indigo-600">
                      {counts.rows} row{counts.rows === 1 ? '' : 's'} · {counts.fields} field{counts.fields === 1 ? '' : 's'}
                    </span>
                  )}
                </label>

                {checked && (
                  <div className="p-2.5 flex flex-wrap gap-1.5">
                    {fillableMeta.map(({ header }) => (
                      <label
                        key={header.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-[11.5px] text-gray-700 cursor-pointer hover:border-indigo-300 select-none"
                      >
                        <input
                          type="checkbox"
                          checked={checkedIds.has(header.id)}
                          onChange={() => toggleHeader(sheet.group, header.id)}
                          className="w-3 h-3 rounded border-gray-300 accent-indigo-600"
                        />
                        {header.label}
                      </label>
                    ))}
                    {fillableMeta.length === 0 && (
                      <p className="text-[11.5px] text-gray-400 italic">No empty AI-fillable fields in this group.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-200 flex-shrink-0">
          <span className="text-[12px] text-gray-500">
            <strong className="text-gray-800">{totalRows}</strong> row{totalRows === 1 ? '' : 's'} ·{' '}
            <strong className="text-gray-800">{totalFields}</strong> field{totalFields === 1 ? '' : 's'} will be filled
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3.5 py-2 text-[12.5px] font-medium text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="button"
              disabled={totalFields === 0}
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> Run AI Fill
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
