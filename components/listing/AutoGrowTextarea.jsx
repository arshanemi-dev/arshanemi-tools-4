'use client'
import { useEffect, useRef } from 'react'

// A <textarea> that grows to fit its own content instead of scrolling or truncating a single
// line — used anywhere a grid cell's plain text needs to wrap and show in full, with the table
// row growing to match (the normal way a table row already grows for any taller cell). Starts at
// `rows={1}` and resizes to its own `scrollHeight` on every value change.
export default function AutoGrowTextarea({ value, onChange, className = '', ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      className={`resize-none overflow-hidden whitespace-pre-wrap break-words ${className}`}
      {...props}
    />
  )
}
