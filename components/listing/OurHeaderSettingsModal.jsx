'use client'
import { X, Save, Check } from 'lucide-react'

// Reduced version of NewDesignColumnModal for a header BEFORE it has any
// per-mapping context — the global "Our Header" dictionary entry itself
// (sidebar's Our Headers list, or the Header Mapping grid's Our Header /
// Unmap Header columns), where there's no group/formula/linked-headers yet
// (those only make sense once a header is actually placed in a specific
// template). Same visual language, just Type + Dropdown/Multi Select
// default values + Unique Key Part.
const TABS = [
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Image' },
  { id: 'multiselect', label: 'Multi Select' },
  { id: 'dropdown', label: 'Dropdown' },
]
const MODES = {
  text: { values: false },
  image: { values: false },
  multiselect: { values: true },
  dropdown: { values: true },
}

export default function OurHeaderSettingsModal({ header, dropdownValues, onUpdate, onClose }) {
  const type = header.dataType || 'text'
  const mode = MODES[type] || MODES.text
  const values = dropdownValues || []

  function addValue(raw) {
    const v = raw.trim()
    if (!v || values.includes(v)) return
    onUpdate({ dropdownValues: [...values, v] })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-auto bg-[rgba(17,24,39,0.42)] p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="my-auto flex max-h-[85vh] w-[520px] max-w-full flex-col rounded-2xl border border-divider bg-background p-5 shadow-2xl sm:p-6">
        <div className="mb-3.5 flex flex-shrink-0 items-center justify-between gap-3 border-b border-divider pb-3">
          <b className="min-w-0 flex-1 truncate text-left text-[18px] font-semibold text-foreground">
            {header.label || 'Untitled header'}
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

        <div className="mb-4 flex flex-shrink-0 flex-wrap items-center gap-y-1.5">
          <div className="flex flex-1 flex-wrap gap-2.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onUpdate({ dataType: t.id })}
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

        <div className="-mr-1 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1 pb-1">
          {mode.values && (
            <div className="mb-5">
              <span className="mb-3 block text-[16.5px] text-muted">
                {type === 'multiselect' ? 'Multi Select' : 'Dropdown'} default values
              </span>
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
                      onClick={() => onUpdate({ dropdownValues: values.filter((_, idx) => idx !== i) })}
                      className="ml-2 text-subtle hover:text-[#e02424]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {values.length === 0 && <span className="text-[13px] italic text-subtle">No values yet.</span>}
              </div>
              <p className="mt-2.5 text-[12px] text-subtle">
                Applied as this header&apos;s starting values the next time it&apos;s mapped in this session — not saved to the dictionary itself.
              </p>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3.5 select-none">
            <span
              className={`flex h-[25px] w-[25px] flex-shrink-0 items-center justify-center rounded-md border-2 ${
                header.isUniqueKeyPart ? 'border-[#4356d6]' : 'border-subtle'
              }`}
            >
              {header.isUniqueKeyPart && <Check className="h-3.5 w-3.5 text-[#4356d6]" strokeWidth={3.2} />}
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={!!header.isUniqueKeyPart}
              onChange={(e) => onUpdate({ isUniqueKeyPart: e.target.checked })}
            />
            <span className="text-[16px] text-muted">Unique key Part</span>
          </label>
        </div>
      </div>
    </div>
  )
}
