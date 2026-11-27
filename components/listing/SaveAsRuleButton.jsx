'use client'
import { useState } from 'react'
import { Check, CopyPlus, Loader2, X } from 'lucide-react'

// "Save As Rule" — saves what's on screen now (the Header Mapping section's
// mapped headers, or Header Place's placement) as a NEW rule, without going
// through the sidebar. Click → a name box, already starting with the
// marketplace prefix ("Amazon_" — every rule name carries it, same as the
// sidebar's + row), then Create (or Enter); × / Esc cancels.
// `onSave(name)` → true when it saved (the box closes), false to keep it
// open. `disabled` + `disabledTitle` — nothing to save yet. `small` — the
// 12px pill of Header Place's row (next to Auto-place) instead of the Header
// Mapping toolbar's 13px one.
export default function SaveAsRuleButton({ prefix = '', onSave, disabled = false, disabledTitle = '', title = 'Save what is on screen now as a new rule', small = false }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const rest = (name.toLowerCase().startsWith(prefix.toLowerCase()) ? name.slice(prefix.length) : name).trim()
  const finalName = `${prefix}${rest}`

  function close() {
    setOpen(false)
    setName('')
  }
  async function commit() {
    if (!rest || busy) return
    setBusy(true)
    const ok = await onSave(finalName)
    setBusy(false)
    if (ok !== false) close()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setName(prefix); setOpen(true) }}
        disabled={disabled}
        title={disabled ? disabledTitle : title}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 font-medium text-foreground hover:bg-card-hover disabled:opacity-40 ${
          small ? 'border-divider bg-card py-1 text-[12px]' : 'border-divider-light py-1.5 text-[13px]'
        }`}
      >
        <CopyPlus size={small ? 12 : 13} /> Save As Rule
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') close() }}
        autoFocus
        placeholder={`${prefix}Rule name`}
        aria-label="New rule name"
        className="w-52 min-w-0 rounded-full border border-accent bg-background px-3 py-1.5 text-[12.5px] text-foreground outline-none"
      />
      <button
        type="button"
        onClick={commit}
        disabled={!rest || busy}
        title={rest ? `Create "${finalName}"` : `Type a name after "${prefix}"`}
        className="inline-flex items-center gap-1 rounded-full bg-action px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-action-hover disabled:opacity-40"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Create
      </button>
      <button type="button" onClick={close} disabled={busy} aria-label="Cancel" className="rounded-full p-1.5 text-subtle hover:bg-card-hover hover:text-foreground">
        <X size={13} />
      </button>
    </span>
  )
}
