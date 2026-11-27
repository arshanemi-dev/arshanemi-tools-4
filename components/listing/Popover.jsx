'use client'

import { useEffect, useRef, useState } from 'react'

// Minimal click-to-open popover — a trigger + an absolutely-positioned panel
// that closes on outside-click / Escape. Same component as tools-5's
// components/dashboard/Popover.jsx (every table's column filter menu).
// `className` goes on the wrapper (it is the positioning box, so e.g.
// "min-w-0 flex-1" lets a trigger fill a row).
export default function Popover({ trigger, children, align = 'left', panelClass = '', className = '', open: controlledOpen, onOpenChange }) {
  const [uncontrolled, setUncontrolled] = useState(false)
  const open = controlledOpen ?? uncontrolled
  const setOpen = (v) => {
    if (onOpenChange) onOpenChange(v)
    if (controlledOpen === undefined) setUncontrolled(v)
  }
  const ref = useRef(null)
  const panelRef = useRef(null)

  // A panel that opens near the bottom of a scrolling area (a long settings
  // column, a short table) would be half out of sight — bring it into view.
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger(open)}</div>
      {open && (
        <div
          ref={panelRef}
          className={`dropdown-panel-in absolute z-40 mt-2 min-w-[12rem] rounded-xl border border-divider-light bg-background p-1 text-foreground shadow-lg shadow-black/5 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${panelClass}`}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}
