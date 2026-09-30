'use client'
import { Columns3, Rows3 } from 'lucide-react'
import { inputCls } from './TemplateNamingFields'
import { columnLetter } from '@/lib/dropdownExtraction'

export function MiniInput({ label, value, onChange, defaultValue, readOnly }) {
  const cls =
    'h-[34px] w-full min-w-[56px] rounded-md border border-[#d7dce2] bg-background px-2.5 text-[14px] text-foreground outline-none focus:border-[#9dbfe8]'
  return (
    <label className="flex min-w-0 flex-[1_1_150px] items-center gap-2 text-[14.5px] text-muted">
      <span className="whitespace-nowrap">{label}</span>
      {onChange ? (
        <input type="number" min={1} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <input defaultValue={defaultValue} readOnly={readOnly} className={cls} />
      )}
    </label>
  )
}

const ORIENTATIONS = [
  { id: 'vertical', label: 'Vertical', Icon: Columns3, hint: 'Headers across one row, each header’s values listed down its column' },
  { id: 'horizontal', label: 'Horizontal', Icon: Rows3, hint: 'Headers down one column, each header’s values listed across its row' },
]

function OrientationToggle({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Validations sheet layout" className="inline-flex h-[34px] flex-shrink-0 rounded-md border border-[#d7dce2] bg-background p-0.5">
      {ORIENTATIONS.map(({ id, label, Icon, hint }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            title={hint}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 rounded px-2.5 text-[13px] font-medium ${active ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// A 1-based column number with its letter — "Header Column (A)".
function withColumnLetter(label, value) {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? `${label} (${columnLetter(n - 1)})` : label
}

// Product fill sheet / Dropdowns Reference Sheet pickers + their row-index
// inputs (Group Row/Header Row/"I section" for the data sheet, Header
// Row/Dropdown Values Row for the reference sheet) — the real thing from
// NewTemplateDesign.jsx (single-template Create/Edit Template), shared here
// so the bulk mapping page uses the identical component instead of a
// re-styled, simplified copy. `hideDropdownReference` hides the whole
// right-hand column. Passing `setDropdownDataStartRow` adds the editable
// "Dropdown Data Row" input (where the fill sheet's own input rows start)
// next to Group/Header/I section. Passing `setDropdownOrientation` adds the
// Vertical/Horizontal layout toggle to the reference sheet — in Horizontal
// the two inputs become columns (headers down one column, values across
// each row) and are labeled that way; `dropdownLayoutNote` (a status line)
// and `onRedetectDropdown` (a "Re-detect" link) sit under it. The bulk
// mapping page uses all of these; /new uses none, so it keeps its
// original behavior.
export default function SheetSelectorFields({
  sheetMeta,
  dataSheetName, onSelectDataSheet,
  dataGroupRow, setDataGroupRow, dataHeaderRow, setDataHeaderRow, dataIsectionRow, setDataIsectionRow,
  dropdownSheetName, onSelectDropdownSheet,
  dropdownHeaderRow, setDropdownHeaderRow, dropdownValuesRow, setDropdownValuesRow,
  hideDropdownReference = false,
  dropdownDataStartRow, setDropdownDataStartRow,
  dropdownSheetTitle = 'Dropdowns Reference Sheet',
  dropdownOrientation = 'vertical', setDropdownOrientation,
  dropdownLayoutNote = '', onRedetectDropdown,
}) {
  const horizontal = !!setDropdownOrientation && dropdownOrientation === 'horizontal'
  return (
    <div className="rounded-[7px] border border-divider p-3">
      <div className="flex flex-wrap gap-y-3.5">
        <div className={`min-w-0 flex-[1_1_330px] ${hideDropdownReference ? '' : 'sm:pr-5'}`}>
          <div className="mb-2 text-[14.5px] text-muted">Product fill sheet</div>
          <select value={dataSheetName} onChange={(e) => onSelectDataSheet(e.target.value)} className={inputCls}>
            <option value="">-- Select sheet --</option>
            {sheetMeta.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.colCount} columns - {s.rowCount} rows)
              </option>
            ))}
          </select>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            <MiniInput label="Group Row" value={dataGroupRow} onChange={setDataGroupRow} />
            <MiniInput label="Header Row" value={dataHeaderRow} onChange={setDataHeaderRow} />
            <MiniInput label="I section" value={dataIsectionRow ?? '2'} onChange={setDataIsectionRow} />
            {setDropdownDataStartRow && (
              <MiniInput label="Dropdown Data Row" value={dropdownDataStartRow ?? '5'} onChange={setDropdownDataStartRow} />
            )}
          </div>
        </div>
        {!hideDropdownReference && (
          <div className="min-w-0 flex-[1_1_330px] sm:pl-5">
            <div className="mb-2 text-[14.5px] text-muted">{dropdownSheetTitle}</div>
            <select
              value={dropdownSheetName}
              onChange={(e) => onSelectDropdownSheet(e.target.value)}
              className={inputCls}
            >
              <option value="">-- None --</option>
              {sheetMeta.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.colCount} columns - {s.rowCount} rows)
                </option>
              ))}
            </select>
            {setDropdownOrientation && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <OrientationToggle value={dropdownOrientation} onChange={setDropdownOrientation} />
                {dropdownSheetName && (
                  <span className="min-w-0 text-[12px] text-subtle">{ORIENTATIONS.find((o) => o.id === dropdownOrientation)?.hint}</span>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
              <MiniInput
                label={horizontal ? withColumnLetter('Header Column', dropdownHeaderRow) : 'Header Row'}
                value={dropdownHeaderRow}
                onChange={setDropdownHeaderRow}
              />
              <MiniInput
                label={horizontal ? withColumnLetter('Values From Column', dropdownValuesRow) : 'Dropdown Values Row'}
                value={dropdownValuesRow}
                onChange={setDropdownValuesRow}
              />
            </div>
            {setDropdownOrientation && (dropdownLayoutNote || onRedetectDropdown) && (
              <p className="mt-1.5 text-[12px] text-subtle">
                {dropdownLayoutNote}
                {onRedetectDropdown && (
                  <button type="button" onClick={onRedetectDropdown} title="Go back to picking the sheet and its layout automatically" className="ml-1.5 font-medium text-accent hover:underline">
                    Re-detect
                  </button>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
