'use client'
import { useState } from 'react'
import { ChevronRight, ChevronDown, FileSpreadsheet, Layers, Store } from 'lucide-react'

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

function HeaderChips({ labels, emptyText }) {
  if (labels.length === 0) return <p className="text-[11.5px] italic text-subtle">{emptyText}</p>
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((h) => (
        <span key={h} className="rounded-full border border-divider bg-background px-2 py-0.5 text-[11px] text-foreground">
          {h}
        </span>
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
export default function SheetHeaderTree({ marketplaceGroups }) {
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
              <HeaderChips labels={[...mp.labels].sort((a, b) => a.localeCompare(b))} emptyText="Nothing common across every sheet yet." />
            </TreeBranch>
            {mp.sheets.map((sheet) => {
              const unique = sheet.headers.filter((h) => !mp.keys.has(h.trim().toLowerCase()))
              return (
                <TreeBranch key={sheet.id} label={sheet.categoryName} count={unique.length} icon={FileSpreadsheet}>
                  <HeaderChips labels={unique} emptyText="Nothing unique to this category — every header here is already in Common." />
                </TreeBranch>
              )
            })}
          </div>
        </TreeBranch>
      ))}
    </div>
  )
}
