'use client'
import { inputCls } from './TemplateNamingFields'

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

// Product fill sheet / Dropdowns Reference Sheet pickers + their row-index
// inputs (Group Row/Header Row/"I section" for the data sheet, Header
// Row/Dropdown Values Row for the reference sheet) — the real thing from
// NewTemplateDesign.jsx (single-template Create/Edit Template), shared here
// so the bulk mapping page uses the identical component instead of a
// re-styled, simplified copy.
export default function SheetSelectorFields({
  sheetMeta,
  dataSheetName, onSelectDataSheet,
  dataGroupRow, setDataGroupRow, dataHeaderRow, setDataHeaderRow, dataIsectionRow, setDataIsectionRow,
  dropdownSheetName, onSelectDropdownSheet,
  dropdownHeaderRow, setDropdownHeaderRow, dropdownValuesRow, setDropdownValuesRow,
}) {
  return (
    <div className="rounded-[7px] border border-divider p-3">
      <div className="flex flex-wrap gap-y-3.5">
        <div className="min-w-0 flex-[1_1_330px] sm:pr-5">
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
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_330px] sm:pl-5">
          <div className="mb-2 text-[14.5px] text-muted">Dropdowns Reference Sheet</div>
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
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            <MiniInput label="Header Row" value={dropdownHeaderRow} onChange={setDropdownHeaderRow} />
            <MiniInput
              label="Dropdown Values Row"
              value={dropdownValuesRow}
              onChange={setDropdownValuesRow}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
