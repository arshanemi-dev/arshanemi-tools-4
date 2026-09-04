'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search,Download, UploadCloud, ArrowLeft, Plus } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import SheetGrid from '@/components/listing/SheetGrid'
import MergedRowFields from '@/components/listing/MergedRowFields'
import useTemplateExport from '@/components/listing/useTemplateExport'
import useAiFill from '@/components/listing/useAiFill'
import BillingGateModal from '@/components/billing/BillingGateModal'
import AssignedTemplatePicker from '@/components/listing/AssignedTemplatePicker'
import TemplateHistoryPanel from '@/components/listing/TemplateHistoryPanel'
import { resolveLinkedFill, buildPickerOptions, linkedIdentityGroups, keyValueOf } from '@/components/listing/linkedHeaders'
import { computeVisionTargets } from '@/lib/aiFillPrompt'
import { useToast } from '@/components/admin/Toast'
import useDebouncedCallback from '@/hooks/useDebouncedCallback'

// `aiFilled` (plan §14) is a bookkeeping key, not a header id.
function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || v === undefined || v === null || String(v).trim() === '')
}
function blankRow(headers) {
  return Object.fromEntries((headers || []).map((h) => [h.id, '']))
}
// Rows are added by the "Add Product" button now, not automatically — so drop
// the server's trailing empty row(s) on load (keeping at least one row to type
// into if the whole sheet is empty).
function stripTrailingEmpty(rows = []) {
  let end = rows.length
  while (end > 0 && isRowEmpty(rows[end - 1])) end--
  return rows.slice(0, Math.max(1, end))
}

// Product Details renders as its own scrolling table; every other group
// (Compulsory + Brand Details) is shown per-row, injected directly under each
// Product Details row as a sub-row (SheetGrid renderRowSubRow → MergedRowFields).
const MERGE_GROUPS = ['compulsory', 'prefill']

// Landing state is a picker over the user's assigned templates — same list
// as the Auto Listing sidebar dropdown — nothing loads until one is
// clicked. Clicking sets ?template= (same destination the sidebar's
// per-template links already use) and switches into that template's own
// scoped workspace — every group visible at once (no tab strip), headers/rows
// belonging only to that template.
export default function ProductDetailsPage() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')

  if (!templateId) return <AssignedTemplatePicker basePath="/listing-tools/product-details" />
  return <ScopedProductDetails key={templateId} templateId={templateId} />
}

function ScopedProductDetails({ templateId }) {
  const { addToast } = useToast()
  const router = useRouter()
  const [template, setTemplate] = useState(null)
  const [content, setContent] = useState(null)
  const [search, setSearch] = useState('')
  // Which block "Download Final Sheet" targets. It used to be the selected
  // tab; now it's whichever block you last interacted with (set on pointer
  // down, see the block wrapper below). Defaults to the Product Details
  // sheet, exactly as the first tab did.
  const [activeGroup, setActiveGroup] = useState('design_system')
  // Per-column filter, kept per group: { [group]: { key, value } }. Only a
  // sheet's unique-key column offers the filter toggle.
  const [filter, setFilter] = useState({})
  const uploadInputRef = useRef(null)
  const { exporting, gate, closeGate, runExport } = useTemplateExport(templateId)
  const { gate: aiGate, closeGate: closeAiGate, fillRowFromImage } = useAiFill(templateId)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setTemplate(d.template)
        setContent(d.content ? { ...d.content, sheets: d.content.sheets.map((s) => ({ ...s, rows: stripTrailingEmpty(s.rows) })) } : d.content)
      })
    return () => { cancelled = true }
  }, [templateId])

  const sheetsByGroup = useMemo(
    () => Object.fromEntries((content?.sheets || []).map((s) => [s.group, s])),
    [content]
  )

  // The Compulsory/Brand groups this template actually uses — same empty-group
  // filter SheetTabs applied before it was removed (a template with nothing
  // mapped into, say, Brand Details has a real `prefill` sheet object but
  // `headers: []`).
  const mergeGroups = useMemo(
    () => MERGE_GROUPS.filter((g) => (sheetsByGroup[g]?.headers?.length ?? 0) > 0),
    [sheetsByGroup]
  )

  const activeSheet = sheetsByGroup[activeGroup]

  // Download exports only the active block's own sheet — gate it on that
  // sheet having *more than one* real row (not the trailing empty row every
  // sheet always carries, and not just because headers exist).
  const filledRowCount = (activeSheet?.rows || []).filter((r) => Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim())).length
  const hasAnyFilledRow = filledRowCount > 1

  // Same filter + search pipeline as before, now resolved per group.
  function filteredRowsFor(group) {
    const gsheet = sheetsByGroup[group]
    if (!gsheet) return []
    let out = gsheet.rows
    const f = filter[group]
    if (f?.key && String(f.value).trim()) {
      const fq = String(f.value).toLowerCase()
      out = out.filter((r, i) => i === gsheet.rows.length - 1 || String(r[f.key] ?? '').toLowerCase().includes(fq))
    }
    if (search.trim()) {
      const sq = search.toLowerCase()
      out = out.filter((r, i) => i === out.length - 1 || Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').toLowerCase().includes(sq)))
    }
    return out
  }

  function onFilterChange(group, headerId, value) {
    if (value === undefined) {
      setFilter((prev) => ({ ...prev, [group]: prev[group]?.key === headerId ? { key: null, value: '' } : { key: headerId, value: '' } }))
    } else {
      setFilter((prev) => ({ ...prev, [group]: { key: prev[group]?.key ?? headerId, value } }))
    }
  }

  // Row edits persist on a short 50ms idle debounce (unlike header/formula edits below, which
  // still save immediately — those are template-structure changes, not per-listing row data).
  // `group`/`headers` are passed in at call time rather than read from component state when the
  // debounce fires, so a block switch inside that 50ms window can't send the save to the wrong
  // group's endpoint.
  const persistRows = useDebouncedCallback(async (group, headers, nextRows) => {
    const res = await fetch(`/api/listing-tools/${templateId}/sheets/${group}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, rows: nextRows }),
    })
    if (!res.ok && res.status !== 401) {
      const data = await res.json().catch(() => ({}))
      addToast(data.message || 'Could not save changes', 'error')
    }
  }, 50)

  function saveRows(group, nextRows) {
    setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === group ? { ...s, rows: nextRows } : s)) }))
    // Local grid state keeps the always-one-trailing-blank row (so there's
    // still somewhere to type the next entry); the server never needs it —
    // it re-derives its own single trailing blank via ensureTrailingEmptyRow
    // regardless of what's sent, so there's no reason to transmit a row we
    // already know is empty.
    persistRows(group, sheetsByGroup[group].headers, nextRows.filter((r) => !isRowEmpty(r)))
  }

  // Un-debounced persist for an arbitrary group — used by handleDeleteRow's cross-group cascade
  // below, which can touch several groups in one click. `persistRows` above is a single shared
  // debounced callback (one pending call at a time); firing it once per affected group would
  // just let the last call win and silently drop the others, so this bypasses it entirely rather
  // than fighting that debounce for a delete, which is already a discrete, deliberate action with
  // nothing to coalesce.
  async function persistGroupRows(group, headers, nextRows) {
    const res = await fetch(`/api/listing-tools/${templateId}/sheets/${group}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, rows: nextRows }),
    })
    if (!res.ok && res.status !== 401) {
      const data = await res.json().catch(() => ({}))
      addToast(data.message || 'Could not save changes', 'error')
    }
  }

  // Every row here is already a real saved row (this page has no "unsaved session" concept —
  // see this page's own top-of-file contrast with Auto Listing), so removing one has to reach
  // the backend, not just disappear until the next refresh brings it back — handled below via
  // persistGroupRows, which fully replaces a group's row set the same way every cell edit
  // already does.
  //
  // Unlike a cell edit, though, this group's sheet isn't the only place "this product" lives:
  // Compulsory/Optional each carry their own disabled "Product Number" column that always
  // mirrors design_system's (see defaultHeaders.json) — three *independently saved* sheets, no
  // shared row-index bookkeeping between them the way Auto Listing's session state has. Deleting
  // a row from just one of them left the same product's row sitting untouched on the other two
  // blocks. `linkedIdentityGroups`/`keyValueOf` (components/listing/linkedHeaders.js) resolve which
  // other groups share this exact identity and match by that value — Prefill is deliberately
  // excluded even when it's the active block, since a Brand row there can legitimately still be in
  // use by other products, so deleting it here never cascades anywhere.
  function handleDeleteRow(group, row) {
    const groupSheet = sheetsByGroup[group]
    if (!groupSheet) return
    const identityGroups = linkedIdentityGroups(group, sheetsByGroup)
    const value = identityGroups.length > 1 ? keyValueOf(group, row, sheetsByGroup) : ''

    if (!value) {
      saveRows(group, groupSheet.rows.filter((r) => r !== row))
      addToast('Row deleted', 'success')
      return
    }

    setContent((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) => (
        identityGroups.includes(s.group)
          ? { ...s, rows: s.rows.filter((r) => keyValueOf(s.group, r, sheetsByGroup) !== value) }
          : s
      )),
    }))
    for (const ig of identityGroups) {
      const igSheet = sheetsByGroup[ig]
      if (!igSheet) continue
      const nextRows = igSheet.rows.filter((r) => keyValueOf(ig, r, sheetsByGroup) !== value)
      if (nextRows.length === igSheet.rows.length) continue
      persistGroupRows(ig, igSheet.headers, nextRows)
    }
    addToast('Row deleted', 'success')
  }

  // Deleting a Product Details row now also has to clear that row's sub-row
  // fields (Compulsory + Brand). handleDeleteRow('design_system', row) already
  // cascades to Compulsory (same Product Number identity) and shows the toast;
  // Brand Details is an independent roster, so its aligned row is dropped by
  // index here.
  function handleDeleteProductRow(row, rowIndex) {
    handleDeleteRow('design_system', row)
    const prefSheet = sheetsByGroup.prefill
    if (prefSheet && rowIndex != null && rowIndex < prefSheet.rows.length) {
      const nextRows = prefSheet.rows.filter((_, i) => i !== rowIndex)
      setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === 'prefill' ? { ...s, rows: nextRows } : s)) }))
      persistGroupRows('prefill', prefSheet.headers, nextRows)
    }
  }

  // Explicit "Add Product" — the only way to grow the row count now that the
  // grid no longer auto-appends a blank when the last row fills. Adds one
  // blank row to Product Details and each merged group; no-op if a spare
  // empty row is already sitting at the bottom.
  function handleAddProduct() {
    const ds = sheetsByGroup.design_system
    if (!ds) return
    if (ds.rows.length && isRowEmpty(ds.rows[ds.rows.length - 1])) return
    for (const g of ['design_system', ...mergeGroups]) {
      const gs = sheetsByGroup[g]
      if (gs) saveRows(g, [...gs.rows, blankRow(gs.headers)])
    }
  }

  // Merges AI-generated fields into one row and marks them `aiFilled` (plan
  // §14) — reuses the same debounced sheet save every other row edit goes
  // through, so the result persists exactly like a manual cell edit would.
  // Defense in depth: the server never targets an already-filled header
  // (lib/aiFillPrompt.js's computeFillTargets/computeVisionTargets both
  // exclude non-blank cells), but this re-checks the row's *current* value
  // right before merging too — a field that already has a value is never
  // overwritten here, no matter what the response contained.
  function handleAiFillRow(group, rowIndex, fields) {
    const groupSheet = sheetsByGroup[group]
    if (!groupSheet) return
    const nextRows = groupSheet.rows.map((r, i) => {
      if (i !== rowIndex) return r
      const toApply = Object.fromEntries(Object.entries(fields).filter(([k]) => !String(r[k] ?? '').trim()))
      if (Object.keys(toApply).length === 0) return r
      const nextAiFilled = Array.from(new Set([...(r.aiFilled || []), ...Object.keys(toApply)]))
      return { ...r, ...toApply, aiFilled: nextAiFilled }
    })
    saveRows(group, nextRows)
  }

  // Auto-triggered the moment an image cell gets a usable value (plan §6) —
  // fires for both a single-cell upload (SheetGrid's updateCell) and a
  // multi-file bulk drop (useBulkImageUpload). Only actually calls the AI
  // route when the row has an empty Brand/Highlights header to fill, so
  // uploading into a template with neither header — or a row that already
  // has both — is a no-op, not a wasted coin.
  function handleImageUploaded(group, rowIndex, headerId, url) {
    const groupSheet = sheetsByGroup[group]
    const row = groupSheet?.rows[rowIndex]
    if (!row) return
    const targets = computeVisionTargets({ headers: groupSheet.headers, row: { ...row, [headerId]: url } })
    if (targets.length === 0) return
    fillRowFromImage(group, rowIndex, headerId, (ri, fields) => handleAiFillRow(group, ri, fields))
  }

  // Formula headers are editable right from the grid (see SheetGrid.jsx's
  // header-row formula box) — persists the same way a row edit does, via
  // the sheet's PATCH route, just with an updated `headers` array instead
  // of `rows`.
  function handleHeaderChange(group, headerId, patch) {
    const groupSheet = sheetsByGroup[group]
    if (!groupSheet) return
    const nextHeaders = groupSheet.headers.map((h) => (h.id === headerId ? { ...h, ...patch } : h))
    setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === group ? { ...s, headers: nextHeaders } : s)) }))
    fetch(`/api/listing-tools/${templateId}/sheets/${group}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers: nextHeaders, rows: groupSheet.rows }),
    }).then(async (res) => {
      if (!res.ok && res.status !== 401) {
        const data = await res.json().catch(() => ({}))
        addToast(data.message || 'Could not save formula', 'error')
      }
    })
  }

  async function handleUploadOldSheet(file) {
    if (!file || !content) return
    const { importIntoBestMatchingGroup } = await import('@/components/listing/parseUploadedSheet')
    try {
      const result = await importIntoBestMatchingGroup(file, content.sheets)
      if (!result) {
        addToast("Couldn't match that file's columns to any sheet in this template.", 'error')
        return
      }
      setActiveGroup(result.group)
      setFilter((prev) => ({ ...prev, [result.group]: { key: null, value: '' } }))
      setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === result.group ? { ...s, rows: result.rows } : s)) }))
      await fetch(`/api/listing-tools/${templateId}/sheets/${result.group}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers: content.sheets.find((s) => s.group === result.group).headers, rows: result.rows }),
      })
      addToast(`Updated the ${result.group.replace('_', ' ')} sheet from that file.`, 'success')
    } catch {
      addToast('Could not read that file — is it a valid .xlsx?', 'error')
    }
  }

  return (
    <div className="min-h-[70vh] bg-surface px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-card-hover rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-light"
          />
        </div>
        <div className="flex items-center gap-2">
          <PillButton variant="edit" icon={Plus} onClick={handleAddProduct} disabled={!content}>
            Add Product
          </PillButton>
          <TemplateHistoryPanel templateId={templateId} />
          <PillButton variant="upload" icon={UploadCloud} onClick={() => uploadInputRef.current?.click()}>
            Upload Old Sheet
          </PillButton>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { handleUploadOldSheet(e.target.files?.[0]); e.target.value = '' }}
          />
          <PillButton
            variant="download"
            icon={Download}
            loading={exporting}
            disabled={!content || !hasAnyFilledRow}
            title={!content || hasAnyFilledRow ? undefined : 'Add more than 1 product row before downloading'}
            onClick={() => runExport({ template: content, groups: [activeGroup], format: 'excel', meta: template })}
          >
            Download Final Sheet
          </PillButton>
        </div>
      </div>

      {!content && (
        <div className="border border-divider rounded-lg overflow-hidden bg-card">
          <p className="px-4 py-8 text-center text-[13px] text-subtle">Loading…</p>
        </div>
      )}

      {/* Product Details is the scrolling table; each of its rows is followed
          by that row's Compulsory + Brand fields as a sub-row (renderRowSubRow
          → MergedRowFields). */}
      {content && (sheetsByGroup.design_system?.headers?.length ?? 0) > 0 && (() => {
        const g = 'design_system'
        const gsheet = sheetsByGroup[g]
        const gKeyHeaderId = gsheet.headers.find((h) => h.isUniqueKeyPart)?.id
        // Product Details table = core columns only; "Big" / "Image Link"
        // (design_system headers tagged `uiBucket`) show in the sub-row as
        // their own groups instead.
        const coreHeaders = gsheet.headers.filter((h) => !h.uiBucket)
        const dsOnCellChange = (headerId, value, rowIndex) => resolveLinkedFill(gsheet.headers, headerId, value, rowIndex, sheetsByGroup)

        const groupSections = mergeGroups.map((mg) => {
          const ms = sheetsByGroup[mg]
          return {
            group: mg,
            label: ms.sheetName || (mg === 'compulsory' ? 'Compulsory' : 'Brand Details'),
            headers: ms.headers,
            rows: filteredRowsFor(mg),
            onRowsChange: (nextRows) => saveRows(mg, nextRows),
            onCellChange: (headerId, value, rowIndex) => resolveLinkedFill(ms.headers, headerId, value, rowIndex, sheetsByGroup),
            onHeaderChange: (headerId, patch) => handleHeaderChange(mg, headerId, patch),
            onImageUploaded: (rowIndex, headerId, url) => handleImageUploaded(mg, rowIndex, headerId, url),
            pickerOptions: buildPickerOptions(ms.headers, sheetsByGroup),
          }
        })

        const bucketSection = (bucket, label) => {
          const ids = new Set(gsheet.headers.filter((h) => h.uiBucket === bucket && !h.disabled).map((h) => h.id))
          if (!ids.size) return null
          return {
            group: g,
            label,
            bucket,
            headers: gsheet.headers,
            visibleHeaderIds: ids,
            rows: filteredRowsFor(g),
            onRowsChange: (nextRows) => saveRows(g, nextRows),
            onCellChange: dsOnCellChange,
            onHeaderChange: (headerId, patch) => handleHeaderChange(g, headerId, patch),
            onImageUploaded: (rowIndex, headerId, url) => handleImageUploaded(g, rowIndex, headerId, url),
            pickerOptions: buildPickerOptions(gsheet.headers, sheetsByGroup),
          }
        }
        // Order: Compulsory → Big → Brand Details → Image Link.
        const subSections = [
          groupSections.find((s) => s.group === 'compulsory'),
          bucketSection('big', 'Big'),
          groupSections.find((s) => s.group === 'prefill'),
          bucketSection('image_link', 'Image Link'),
        ].filter(Boolean)

        return (
          <SheetGrid
            headerInfo
            autoAppendRow={false}
            headers={coreHeaders}
            rows={filteredRowsFor(g)}
            onRowsChange={(nextRows) => saveRows(g, nextRows)}
            uploadUrl={`/api/listing-tools/${templateId}/images`}
            activeFilterHeaderId={filter[g]?.key || null}
            filterValue={filter[g]?.value || ''}
            onFilterChange={gKeyHeaderId ? ((headerId, value) => onFilterChange(g, headerId, value)) : undefined}
            pickerOptions={buildPickerOptions(gsheet.headers, sheetsByGroup)}
            onCellChange={dsOnCellChange}
            onHeaderChange={(headerId, patch) => handleHeaderChange(g, headerId, patch)}
            onImageUploaded={(rowIndex, headerId, url) => handleImageUploaded(g, rowIndex, headerId, url)}
            onDeleteRow={(row, rowIndex) => handleDeleteProductRow(row, rowIndex)}
            renderRowSubRow={subSections.length ? ((rowIndex) => (
              <MergedRowFields
                rowIndex={rowIndex}
                autoAppendRow={false}
                uploadUrl={`/api/listing-tools/${templateId}/images`}
                sections={subSections}
              />
            )) : undefined}
          />
        )
      })()}

      <BillingGateModal gate={gate} onClose={closeGate} onRetry={() => runExport({ template: content, groups: [activeGroup], format: 'excel', meta: template })} />
      <BillingGateModal gate={aiGate} onClose={closeAiGate} />
    </div>
  )
}
