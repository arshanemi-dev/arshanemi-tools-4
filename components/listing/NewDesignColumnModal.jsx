'use client'
import { useEffect, useRef, useState } from 'react'
import { X, Save, Check, ChevronDown, Search } from 'lucide-react'

// Column-settings modal for the New Design — a 1:1 port of the `.overlay` /
// `.modal` block in source/arshanemi-tools-4.html, wired to the same field
// model every other Listing Tools screen uses (dataType / dropdownValues /
// formula / linkedGroup / linkedHeaderId / isUniqueKeyPart / disabled). It
// opens from the small "+" button on each header card (per the user's spec:
// "for headers settings i have used Models in plus click"). Every change is
// applied live through onUpdateField, so the green Save button just closes.
const TABS = [
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Image' },
  { id: 'multiselect', label: 'Multi Select' },
  { id: 'formula', label: 'Formula' },
  { id: 'dropdown', label: 'Dropdown' },
]

// Which panes each column type shows — mirrors the HTML's MODES map.
const MODES = {
  text: { values: false, formula: false },
  image: { values: false, formula: false },
  multiselect: { values: true, formula: false },
  dropdown: { values: true, formula: false },
  formula: { values: false, formula: true },
}

// Cross-field option-list copy/paste. Module-scoped (not React state) so it
// survives the modal closing on one column and reopening on another — same
// purpose as GroupTabsStep's in-component `copiedValues`, kept here so the
// New Design modal is self-contained.
let COPIED = null

// "Auto-Fill From" — ONE searchable dropdown of every other header (label +
// its group). Picking one sets both linkedHeaderId and linkedGroup, so the
// group no longer needs a separate select. The header being edited is never
// in the list.
function HeaderLinkCombobox({ options, value, onSelect, onClear }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef(null)
  const selected = options.find((o) => o.id === value) || null

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => `${o.label} ${o.groupTitle}`.toLowerCase().includes(q)) : options

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setQuery('')
          setOpen((v) => !v)
        }}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-lg border border-divider bg-card px-3.5 text-left text-[15px] text-foreground outline-none focus:border-[#a9bce9]"
      >
        <span className={`min-w-0 truncate ${selected ? 'text-foreground' : 'italic text-subtle'}`}>
          {selected ? `${selected.label} · ${selected.groupTitle}` : 'Not connected'}
        </span>
        <span className="flex flex-shrink-0 items-center gap-1">
          {selected && (
            <span
              role="button"
              tabIndex={-1}
              title="Clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation()
                onClear()
                setOpen(false)
              }}
              className="rounded p-0.5 text-subtle hover:bg-red-50 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-divider bg-card shadow-lg">
          <div className="relative border-b border-divider bg-surface/70">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search headers…"
              className="w-full bg-transparent py-2.5 pl-9 pr-3 text-[13px] text-foreground placeholder:text-subtle focus:outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12.5px] text-subtle">No matching header.</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onSelect(o)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                    o.id === value ? 'bg-[#4356d6]/10 font-medium text-foreground' : 'text-muted hover:bg-surface'
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {o.label} <span className="text-subtle">· {o.groupTitle}</span>
                  </span>
                  {o.id === value && <Check className="h-3.5 w-3.5 flex-shrink-0 text-[#4356d6]" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NewDesignColumnModal({ field, sections, allFields, onUpdateField, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const type = field.dataType || 'text'
  const mode = MODES[type] || MODES.text
  const values = field.dropdownValues || []

  // Every other real header, tagged with its group's title. Excludes the
  // header being edited, its own group, the Unselected bucket, and the
  // hidden default connectors in Compulsory / Brand Details.
  const groupTitleById = Object.fromEntries(sections.map((s) => [s.id, s.title]))
  const linkOptions = allFields
    .filter(
      (f) =>
        f.id !== field.id &&
        f.groupId !== field.groupId &&
        f.groupId !== 'unmapped' &&
        !(f.source === 'default' && (f.groupId === 'compulsory' || f.groupId === 'prefill')),
    )
    .map((f) => ({
      id: f.id,
      label: f.label || '(unnamed)',
      groupId: f.groupId,
      groupTitle: groupTitleById[f.groupId] || f.groupId,
    }))

  function setType(id) {
    onUpdateField(field.id, {
      dataType: id,
      ...(id === 'dropdown' || id === 'multiselect' ? {} : { dropdownColumn: '' }),
      ...(id === 'formula' ? {} : { formula: '' }),
    })
  }
  function addValue(raw) {
    const v = raw.trim()
    if (!v || values.includes(v)) return
    onUpdateField(field.id, { dropdownValues: [...values, v] })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-auto bg-[rgba(17,24,39,0.42)] p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="my-auto w-[777px] max-w-full rounded-2xl border border-divider bg-background p-5 shadow-2xl sm:p-6">
        {/* name row — title at the start, close at the end */}
        <div className="mb-3.5 flex items-center justify-between gap-3 border-b border-divider pb-3">
          <b className="min-w-0 flex-1 truncate text-left text-[18px] font-semibold text-foreground">
            {field.label || 'Untitled column'}
          </b>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-4 flex flex-shrink-0 items-center p-1.5 text-muted hover:text-foreground"
          >
            <X className="h-6 w-6" strokeWidth={2.4} />
          </button>
        </div>

        {/* type tabs + save */}
        <div className="mb-5 flex flex-wrap items-center gap-y-1.5">
          <div className="flex flex-1 flex-wrap gap-2.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`rounded-full border px-4 py-2 text-[15px] transition-colors ${
                  type === t.id
                    ? 'border-[#4356d6] bg-[#4356d6] font-semibold text-white'
                    : 'border-divider bg-background text-muted hover:bg-card'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-full bg-[#12a150] px-5 py-2.5 text-[16px] font-semibold text-white"
          >
            <Save className="h-4 w-4" /> Save
          </button>
        </div>

        {/* body */}
        <div className="flex flex-wrap items-start gap-y-5">
          {(mode.values || mode.formula) && (
            <div className="min-w-0 flex-1 basis-[340px] sm:pr-5">
              {mode.values && (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="flex-1 text-[16.5px] text-muted">
                      {type === 'multiselect' ? 'Multi Select' : 'Dropdown'} values
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        COPIED = [...values]
                      }}
                      className="rounded-2xl border border-divider bg-card px-4 py-1.5 text-[14px] text-muted hover:bg-card-hover"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => COPIED && onUpdateField(field.id, { dropdownValues: [...COPIED] })}
                      className="rounded-2xl border border-divider bg-card px-4 py-1.5 text-[14px] text-muted hover:bg-card-hover"
                    >
                      Paste
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Type one and press Enter…"
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      addValue(e.target.value)
                      e.target.value = ''
                    }}
                    className="h-[46px] w-full rounded-lg border border-divider bg-card px-3 text-[15px] text-foreground outline-none focus:border-[#a9bce9]"
                  />
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {values.map((v, i) => (
                      <span
                        key={`${v}-${i}`}
                        className="inline-flex items-center rounded-full border border-divider bg-background px-3 py-1.5 text-[14.5px] text-muted"
                      >
                        {v}
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateField(field.id, { dropdownValues: values.filter((_, idx) => idx !== i) })
                          }
                          className="ml-2 text-subtle hover:text-[#e02424]"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {values.length === 0 && <span className="text-[13px] italic text-subtle">No values yet.</span>}
                  </div>
                </>
              )}

              {mode.formula && (
                <>
                  <span className="mb-2.5 block text-[16.5px] text-muted">Formula</span>
                  <input
                    type="text"
                    value={field.formula || ''}
                    onChange={(e) => onUpdateField(field.id, { formula: e.target.value })}
                    placeholder="[Cost] * 1.5"
                    className="h-11 w-full rounded-lg border border-divider bg-card px-3 text-[15px] text-foreground outline-none focus:border-[#a9bce9]"
                  />
                  <p className="mt-2.5 max-w-[380px] text-[13.5px] leading-relaxed text-subtle">
                    Reference other columns by name in brackets. Supports +, -, *, /, ^ (or the word
                    &ldquo;power&rdquo;), and parentheses.
                  </p>
                </>
              )}
            </div>
          )}

          <div className={`min-w-0 flex-1 basis-[280px] ${mode.values || mode.formula ? 'sm:pl-5' : ''}`}>
            <span className="mb-2.5 block text-[16.5px] text-muted">Auto-Fill From</span>
            <HeaderLinkCombobox
              options={linkOptions}
              value={field.linkedHeaderId || null}
              onSelect={(o) => onUpdateField(field.id, { linkedHeaderId: o.id, linkedGroup: o.groupId })}
              onClear={() => onUpdateField(field.id, { linkedHeaderId: null, linkedGroup: null })}
            />
            <p className="mt-2 text-[12.5px] text-subtle">
              Pick any header — its group is linked automatically.
            </p>

            <label className="mt-5 flex cursor-pointer items-center gap-3.5 select-none">
              <span
                className={`flex h-[25px] w-[25px] flex-shrink-0 items-center justify-center rounded-md border-2 ${
                  field.isUniqueKeyPart ? 'border-[#4356d6]' : 'border-subtle'
                }`}
              >
                {field.isUniqueKeyPart && <Check className="h-3.5 w-3.5 text-[#4356d6]" strokeWidth={3.2} />}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={!!field.isUniqueKeyPart}
                onChange={(e) => onUpdateField(field.id, { isUniqueKeyPart: e.target.checked })}
              />
              <span className="text-[16px] text-muted">Unique key Part</span>
            </label>

            <label className="mt-5 flex cursor-pointer items-center gap-3.5 select-none">
              <span
                className={`flex h-[25px] w-[25px] flex-shrink-0 items-center justify-center rounded-md border-2 ${
                  field.disabled ? 'border-[#4356d6]' : 'border-subtle'
                }`}
              >
                {field.disabled && <Check className="h-3.5 w-3.5 text-[#4356d6]" strokeWidth={3.2} />}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={!!field.disabled}
                onChange={(e) => onUpdateField(field.id, { disabled: e.target.checked })}
              />
              <span className="text-[16px] text-muted">Disable (read only at fill time)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
