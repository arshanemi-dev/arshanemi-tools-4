'use client'
import { useState } from 'react'
import { Search, Settings } from 'lucide-react'

// A full copy of the single-template /new page's own New Design grid
// (NewTemplateDesign.jsx's SECTIONS/sectionKeyOf/onCardDrop/onSectionDrop —
// same colours, same drag-and-drop model, same section order: Product
// Details, Compulsory, Big, Brand Details, Images, Others), adapted to the
// bulk page's own data shape (mappedOnly's {ourHeaderId, group, position,
// uiBucket} instead of /new's `fields`). Like Images, "Big" is a uiBucket
// overlay — its real group stays design_system, same as /new's own Big
// section. "Others" IS the staging section (real group null), same job
// /new's own "Other" tab does — drag a card there to unplace it, drag it
// back into a real section to place it.
const SECTIONS = [
  { id: 'design_system', title: 'Product Details', color: '#e02424', group: 'design_system', bucket: null },
  { id: 'compulsory', title: 'Compulsory', color: '#16a34a', group: 'compulsory', bucket: null },
  { id: 'big', title: 'Big', color: '#4B0082', group: 'design_system', bucket: 'big' },
  { id: 'prefill', title: 'Brand Details', color: '#2563eb', group: 'prefill', bucket: null },
  { id: 'image_link', title: 'Images', color: '#a16207', group: 'design_system', bucket: 'image_link' },
  { id: 'unassigned', title: 'Others', color: '#9aa2ad', group: null, bucket: null },
]
const sectionKeyOf = (h) => h.uiBucket || h.group || 'unassigned'

// Pure version of a drop — moves `ourHeaderId` into the target section
// (group + uiBucket), inserted before/after `beforeOurHeaderId` (or appended
// when null), and re-numbers that section's positions 0..n-1. Shared by the
// live placement (BulkTemplateDesign's handleMoveHeader) and the Place Rule
// editor (RulePreviewPanel), so both behave identically.
export function moveHeaderInList(list, ourHeaderId, group, uiBucket, beforeOurHeaderId, after) {
  const targetSectionId = uiBucket || group || 'unassigned'
  const moved = list.find((m) => m.ourHeaderId === ourHeaderId)
  if (!moved) return list
  const targetCards = list
    .filter((m) => m.ourHeaderId !== ourHeaderId && sectionKeyOf(m) === targetSectionId)
    .sort((a, b) => a.position - b.position)
  let insertAt = targetCards.length
  if (beforeOurHeaderId) {
    const idx = targetCards.findIndex((m) => m.ourHeaderId === beforeOurHeaderId)
    if (idx !== -1) insertAt = after ? idx + 1 : idx
  }
  targetCards.splice(insertAt, 0, { ...moved, group, uiBucket })
  const posById = new Map(targetCards.map((m, idx) => [m.ourHeaderId, idx]))
  return list.map((m) => {
    if (m.ourHeaderId === ourHeaderId) return { ...m, group, uiBucket, position: posById.get(ourHeaderId) }
    return posById.has(m.ourHeaderId) ? { ...m, position: posById.get(m.ourHeaderId) } : m
  })
}

// `headers` = [{ourHeaderId, ourHeaderLabel, group, position, uiBucket}].
// `onMove(ourHeaderId, group, uiBucket, beforeOurHeaderId, after)` — called
// on every drop, whether it lands on a section (beforeOurHeaderId null,
// appends at the end) or on another card (inserts before/after it, per
// `after` — same left-half/right-half convention as /new's own onCardDrop).
// `readOnly` = same look, no dragging (a saved Place Rule's preview).
export default function BulkPlaceGrid({ headers, onMove, onOpenSettings, readOnly = false }) {
  const [search, setSearch] = useState('')
  const [dragId, setDragId] = useState(null)
  const [dragOverSec, setDragOverSec] = useState(null)

  const filtered = headers.filter((h) => h.ourHeaderLabel.toLowerCase().includes(search.toLowerCase()))

  function onCardDrop(e, target) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverSec(null)
    const dragged = dragId
    setDragId(null)
    if (!dragged || dragged === target.ourHeaderId) return
    const targetSec = SECTIONS.find((s) => s.id === sectionKeyOf(target))
    if (!targetSec) return
    // Drop on the target card's right half → land AFTER it; left half →
    // BEFORE it (same convention as /new's own onCardDrop).
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientX > rect.left + rect.width / 2
    onMove(dragged, targetSec.group, targetSec.bucket, target.ourHeaderId, after)
  }
  function onSectionDrop(e, sec) {
    e.preventDefault()
    setDragOverSec(null)
    const dragged = dragId
    setDragId(null)
    if (!dragged) return
    onMove(dragged, sec.group, sec.bucket, null, false)
  }

  return (
    <div>
      <div className="relative mb-3 max-w-xs hidden">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-subtle" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-md border border-divider bg-background pl-6 pr-2 py-1 text-[12px] outline-none focus:border-accent-light"
        />
      </div>

      {SECTIONS.map((sec) => {
        const cards = filtered.filter((h) => sectionKeyOf(h) === sec.id).slice().sort((a, b) => a.position - b.position)
        return (
          <div
            key={sec.id}
            onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); if (dragOverSec !== sec.id) setDragOverSec(sec.id) }}
            onDragLeave={readOnly ? undefined : () => setDragOverSec((c) => (c === sec.id ? null : c))}
            onDrop={readOnly ? undefined : (e) => onSectionDrop(e, sec)}
            className="mb-3"
          >
            <div className="mb-1.5 flex items-center gap-2 text-[14px] font-bold" style={{ color: sec.color }}>
              <span className="h-3.5 w-1.5 flex-shrink-0 rounded-full border" style={{ borderColor: sec.color, backgroundColor: `${sec.color}1a` }} aria-hidden />
              {sec.title} <span className="text-[12px] font-normal text-subtle">({cards.length})</span>
            </div>
            <div className={`-mx-1 flex flex-wrap rounded-md py-0.5 ${dragOverSec === sec.id ? 'bg-card-hover' : ''}`}>
              {cards.length === 0 ? (
                <p className="px-1 py-1 text-[12.5px] italic text-subtle">{readOnly ? 'Nothing placed.' : 'Drop headers here.'}</p>
              ) : (
                cards.map((h) => (
                  <div
                    key={h.ourHeaderId}
                    draggable={!readOnly}
                    onDragStart={readOnly ? undefined : (e) => { setDragId(h.ourHeaderId); e.dataTransfer.setData('text/plain', h.ourHeaderId); e.dataTransfer.effectAllowed = 'move' }}
                    onDragOver={readOnly ? undefined : (e) => e.preventDefault()}
                    onDrop={readOnly ? undefined : (e) => onCardDrop(e, h)}
                    onDragEnd={readOnly ? undefined : () => { setDragId(null); setDragOverSec(null) }}
                    className={`mb-1 shrink-0 grow-0 basis-full px-1 sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5 ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
                  >
                    <div className="flex items-center gap-1 rounded-md border bg-background px-2 py-1" style={{ borderColor: sec.color }}>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-foreground" title={h.ourHeaderLabel}>{h.ourHeaderLabel}</span>
                      {onOpenSettings && (
                        <button
                          type="button"
                          onClick={() => onOpenSettings(h.ourHeaderId)}
                          title="Header settings — type, dropdown values, formula, unique key…"
                          className="flex h-4 w-4 flex-shrink-0 items-center justify-center opacity-80 hover:opacity-100"
                          style={{ color: sec.color }}
                        >
                          <Settings className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
