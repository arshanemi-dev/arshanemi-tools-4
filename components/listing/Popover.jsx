'use client'

import { useEffect, useRef, useState } from 'react'

// Minimal click-to-open popover — a trigger + an absolutely-positioned panel
// that closes on outside-click / Escape. Same component as tools-5's
// components/dashboard/Popover.jsx (Header Mapping column filters).
export default function Popover({ trigger, children, align = 'left', panelClass = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

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
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger(open)}</div>
      {open && (
        <div
          className={`absolute z-40 mt-2 min-w-[12rem] rounded-xl border border-divider-light bg-background p-1 shadow-lg shadow-black/5 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${panelClass}`}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}
