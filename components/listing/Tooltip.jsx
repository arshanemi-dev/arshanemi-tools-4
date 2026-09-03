'use client'
import { useEffect, useRef, useState } from 'react'

// Reusable dark tooltip / popover.
//   trigger="hover" (default) — shows on hover or keyboard focus, CSS-only.
//   trigger="click"           — toggles on click, closes on outside-click / Esc.
// `content` is any node, so it also backs the small "N fields mapped" popover
// on the template grid, not just plain text hints.
export default function Tooltip({
  content,
  children,
  trigger = 'hover',
  placement = 'top', // 'top' | 'bottom'
  align = 'center', // 'center' | 'start' | 'end'
  className = '',
  panelClassName = '',
  childrenWrapperClassName = '',
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const isClick = trigger === 'click'

  useEffect(() => {
    if (!isClick || !open) return
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [isClick, open])

  const below = placement === 'bottom'
  const panelPos = below ? 'top-full mt-2' : 'bottom-full mb-2'
  const alignPos =
    align === 'start'
      ? 'left-0'
      : align === 'end'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2'
  const arrowAlign =
    align === 'start' ? 'left-3' : align === 'end' ? 'right-3' : 'left-1/2 -translate-x-1/2'
  const arrowPos = below
    ? `-top-1.5 ${arrowAlign} border-x-[6px] border-x-transparent border-b-[7px] border-b-[#1f2937]`
    : `-bottom-1.5 ${arrowAlign} border-x-[6px] border-x-transparent border-t-[7px] border-t-[#1f2937]`

  const vis = isClick
    ? open
      ? 'visible opacity-100 scale-100 pointer-events-auto'
      : 'invisible opacity-0 scale-95 pointer-events-none'
    : 'invisible opacity-0 scale-95 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:scale-100 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:scale-100'

  return (
    <span ref={wrapRef} className={`group relative inline-flex ${className}`}>
      <span
        className={`inline-flex min-w-0 ${childrenWrapperClassName}`}
        onClick={isClick ? () => setOpen((v) => !v) : undefined}
      >
        {children}
      </span>
      <span
        role="tooltip"
        onClick={(e) => e.stopPropagation()}
        className={`absolute z-[70] w-max max-w-[280px] origin-bottom rounded-lg bg-[#1f2937] px-2.5 py-2 text-left text-[12px] font-normal leading-snug text-white shadow-[0_10px_30px_rgba(16,24,40,0.28)] ring-1 ring-white/10 transition-all duration-150 ${panelPos} ${alignPos} ${vis} ${panelClassName}`}
      >
        {content}
        <span aria-hidden className={`absolute h-0 w-0 ${arrowPos}`} />
      </span>
    </span>
  )
}
