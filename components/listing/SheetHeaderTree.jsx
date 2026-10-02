'use client'
import { useState } from 'react'
import { ChevronRight, ChevronDown, FileSpreadsheet, Layers, Store, List } from 'lucide-react'

function TreeBranch({ label, count, icon: Icon, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="border-b border-divider/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left hover:bg-card-hover"
      >
        {open ? <ChevronDown className="h-3 w-3 flex-shrink-0 text-subtle" /> : <ChevronRight className="h-3 w-3 flex-shrink-0 text-subtle" />}
        {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0 text-subtle" />}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">{label}</span>
        <span className="flex-shrink-0 rounded-full bg-card-hover px-1.5 py-0.5 text-[10px] font-semibold text-subtle">{count}</span>
      </button>
      {open && <div className="px-2.5 pb-2.5 pl-8">{children}</div>}
    </div>
  )
}

// A header with no detected dropdown values is still just a plain chip. One
// that has any (dropdownColumns, same auto-detection the Header Mapping/
// handleMap already read off the sheet's own data) becomes its own small
// card instead — the header name as a title, each of its own values as a
// smaller chip underneath — so a dropdown-type header visibly carries its
// options right here instead of looking identical to a plain text one.
function HeaderChip({ label, values }) {
  if (!values || values.length === 0) {
    return (
      <span className="rounded-full border border-divider bg-background px-2 py-0.5 text-[11px] text-foreground">
        {label}
      </span>
    )
  }
  return (
    <div className="rounded-md border border-accent/30 bg-accent/5 px-2 py-1.5">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-foreground" title={label}>
        <List className="h-3 w-3 flex-shrink-0 text-accent" />
        <span className="truncate">{label}</span>
        <span className="flex-shrink-0 rounded-full bg-card-hover px-1.5 py-0.5 text-[9.5px] font-semibold text-subtle">{values.length}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <span key={v} className="rounded-full border border-divider bg-background px-1.5 py-0.5 text-[10.5px] text-muted">
            {v}
          </span>
        ))}
      </div>
    </div>
  )
}

function HeaderChips({ labels, emptyText, dropdownColumns }) {
  if (labels.length === 0) return <p className="text-[11.5px] italic text-subtle">{emptyText}</p>
  return (
    <div className="flex flex-wrap items-start gap-1">
      {labels.map((h) => (
        <HeaderChip key={h} label={h} values={dropdownColumns?.[h]?.values} />
      ))}
    </div>
  )
}

// Read-only view of the current batch's own structure, Marketplace →
// Category → Fields — Marketplace first (in practice almost always exactly
// one, since a batch with mismatched marketplaces is rejected at upload),
// then a "Common" branch pulled out for whatever's in every sheet under
// that marketplace (GST/Brand Name/Manufacturer Details-type fields), then
// each sheet as its own branch labeled by its CATEGORY name (not the raw
// filename — "Blouse" from "Meesho_Blouse.xlsx", not the file itself),
// listing only what's unique to that category (so nothing's repeated
// between Common and a category branch). Purely informational — doesn't
// drive mapping/placement. Only renders once there's more than one sheet
// to actually compare (see BulkTemplateDesign.jsx's own sheetsIndex gate).
// `dropdownColumns` — pooled across every uploaded file (allDropdownColumns
// in BulkTemplateDesign.jsx, same lookup handleMap uses), keyed by raw
// header label — feeds each HeaderChip its own detected values, if any.
export default function SheetHeaderTree({ marketplaceGroups, dropdownColumns }) {
  if (!marketplaceGroups || marketplaceGroups.length === 0) return null
  return (
    <div className="rounded-[7px] border border-divider bg-card">
      {marketplaceGroups.map((mp) => (
        <TreeBranch
          key={mp.marketplaceName}
          label={mp.marketplaceName}
          count={mp.sheets.length}
          icon={Store}
          defaultOpen={marketplaceGroups.length === 1}
        >
          <div className="rounded-[7px] border border-divider/60">
            <TreeBranch label="Common" count={mp.labels.length} icon={Layers} defaultOpen>
              <HeaderChips
                labels={[...mp.labels].sort((a, b) => a.localeCompare(b))}
                emptyText="Nothing common across every sheet yet."
                dropdownColumns={dropdownColumns}
              />
            </TreeBranch>
            {mp.sheets.map((sheet) => {
              const unique = sheet.headers.filter((h) => !mp.keys.has(h.trim().toLowerCase()))
              return (
                <TreeBranch key={sheet.id} label={sheet.categoryName} count={unique.length} icon={FileSpreadsheet}>
                  <HeaderChips
                    labels={unique}
                    emptyText="Nothing unique to this category — every header here is already in Common."
                    dropdownColumns={dropdownColumns}
                  />
                </TreeBranch>
              )
            })}
          </div>
        </TreeBranch>
      ))}
    </div>
  )
}
