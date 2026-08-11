'use client'

// A fixed-height <textarea> for grid cells — every row, in every sheet
// group, on every Listing Tools page, stays the same 140px height
// regardless of how much text a cell holds (a long AI-generated description
// used to auto-grow this box, and the whole table row, to match — one long
// cell made every column in that row balloon). Text still wraps normally
// inside the box; only content taller than the fixed height scrolls, via a
// plain native scrollbar within the cell. 140px is also what SheetGrid.jsx
// sets on every <td> itself, so non-text cell types (dropdown, image, ...)
// come out the same row height too — the two must stay in sync.
export default function AutoGrowTextarea({ value, onChange, className = '', ...props }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      className={`h-[140px] resize-none overflow-y-auto whitespace-pre-wrap break-words ${className}`}
      {...props}
    />
  )
}
