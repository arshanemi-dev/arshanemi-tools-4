'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Download, UploadCloud, PlusCircle, Save, Sparkles } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import SheetTabs from '@/components/listing/SheetTabs'
import SheetGrid from '@/components/listing/SheetGrid'
import useTemplateExport from '@/components/listing/useTemplateExport'
import useAiFill from '@/components/listing/useAiFill'
import useAiAutofillBulk from '@/components/listing/useAiAutofillBulk'
import AiFillUpModal from '@/components/listing/AiFillUpModal'
import BillingGateModal from '@/components/billing/BillingGateModal'
import AssignedTemplatePicker from '@/components/listing/AssignedTemplatePicker'
import { importIntoBestMatchingGroup } from '@/components/listing/parseUploadedSheet'
import { resolveLinkedFill, buildPickerOptions, propagateFromGroup } from '@/components/listing/linkedHeaders'
import { findGroupKeyMatch, backfillEmptyFields } from '@/components/listing/historyFill'
import { recomputeFormulas } from '@/components/listing/formula'
import { computeVisionTargets } from '@/lib/aiFillPrompt'
import { useToast } from '@/components/admin/Toast'

// Landing state is a picker over the user's assigned templates — same list
// as the Auto Listing sidebar dropdown (ListingToolsSidebar.jsx, whose
// "Auto Listing" section already links here via ?template=) — nothing loads
// until one is clicked.
export default function AutoDetailsPage() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')

  if (!templateId) return <AssignedTemplatePicker basePath="/listing-tools/auto-details" />
  return <ScopedAutoDetails key={templateId} templateId={templateId} />
}

// The Auto Listing fill/export workspace — every sheet (Product Details
// included) visible and editable on one screen at once, each block with its
// own independent group tab-strip. This page is a *fresh* entry form every
// visit — it never displays rows already saved from a previous session
// (that's what Product Details/Prefill Details are for). `content` is still
// fetched in full and kept around, but only as: (a) the lookup source for
// the connected-headers picks below (Product Details' own unique-key header
// doubles as a picker of already-saved products — picking one, or picking
// one via any other group's header linked to it, auto-fills the rest of
// that row, see components/listing/linkedHeaders.js), and (b) something to
// merge new rows into on save/export, so a save from this blank screen can
// never wipe out data that was already on the server.
const ALL_GROUPS = ['design_system', 'compulsory', 'prefill', 'optional']
// "Upload Old Sheet" only ever matches into these three — Product Details'
// own data comes from Template Settings' Product Data Sheet at creation
// time and from the Rule A/B pickers here, not from a bulk re-upload.
const UPLOAD_MATCH_GROUPS = ['compulsory', 'prefill', 'optional']

// `aiFilled` (plan §14) is a bookkeeping key, not a header id — excluded here
// for the same reason as SheetGrid.jsx's own copy of this check.
function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || v === undefined || v === null || String(v).trim() === '')
}
function blankRow(headers) {
  return Object.fromEntries(headers.map((h) => [h.id, '']))
}
function blankSessionFor(sheets) {
  return Object.fromEntries((sheets || []).map((s) => [s.group, [blankRow(s.headers)]]))
}

function ScopedAutoDetails({ templateId }) {
  const { addToast } = useToast()
  const [template, setTemplate] = useState(null)
  const [search, setSearch] = useState('')
  const [content, setContent] = useState(null)
  const [sessionRows, setSessionRows] = useState({})
  const [activeGroup, setActiveGroup] = useState(ALL_GROUPS[0])
  const [uploading, setUploading] = useState(false)
  const [persisting, setPersisting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fillingUpAll, setFillingUpAll] = useState(false)
  const [showAiFillUpModal, setShowAiFillUpModal] = useState(false)
  const uploadInputRef = useRef(null)
  const { exporting, gate, closeGate, runExport } = useTemplateExport(templateId)
  const { gate: aiGate, closeGate: closeAiGate, fillRowFromImage } = useAiFill(templateId)
  const { gate: bulkGate, closeGate: closeBulkGate, runBulk } = useAiAutofillBulk(templateId)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setTemplate(d.template)
        setContent(d.content)
        setSessionRows(blankSessionFor(d.content.sheets))
      })
    return () => { cancelled = true }
  }, [templateId])

  const sheetsByGroup = useMemo(
    () => Object.fromEntries((content?.sheets || []).map((s) => [s.group, s])),
    [content]
  )

  const sheet = sheetsByGroup[activeGroup]
  const activeSessionRows = useMemo(
    () => sessionRows[activeGroup] || (sheet ? [blankRow(sheet.headers)] : []),
    [sessionRows, activeGroup, sheet]
  )
  const filteredRows = useMemo(() => {
    if (!search.trim()) return activeSessionRows
    const q = search.toLowerCase()
    return activeSessionRows.filter((r, i) => i === activeSessionRows.length - 1 || Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').toLowerCase().includes(q)))
  }, [activeSessionRows, search])

  function onChangeGroup(g) {
    setActiveGroup(g)
    setSearch('')
  }

  // Existing (already-saved, fetched once) rows for a group, blanks
  // dropped, plus whatever's currently in this session, also blanks
  // dropped — the set actually sent to the server / included in an export.
  function mergedRowsFor(group, sessionRowsForGroup) {
    const existing = (sheetsByGroup[group]?.rows || []).filter((r) => !isRowEmpty(r))
    const session = (sessionRowsForGroup || []).filter((r) => !isRowEmpty(r))
    return [...existing, ...session]
  }

  // "AI Fill Up" is a bulk action — with only a single real product row
  // (already-saved OR currently being typed in this session) across every
  // group, there's nothing to "bulk" that the per-row "Fill by AI" button
  // doesn't already cover, so it stays disabled until there are 2+.
  const totalFilledRowCount = ALL_GROUPS.reduce((sum, g) => sum + mergedRowsFor(g, sessionRows[g]).length, 0)
  const hasAnyFilledRow = totalFilledRowCount > 1

  // Auto Listing is frontend-only until Download: typing here never hits the backend — every
  // group's rows live purely in `sessionRows` state, so a refresh (or clicking Create New)
  // always starts fresh, matching this page's own "fresh entry form every visit" contract.
  // Persistence happens once, right before a download is generated (see persistAllGroups below).
  async function persistGroup(group, headers, rows) {
    const res = await fetch(`/api/listing-tools/${templateId}/sheets/${group}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, rows }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      addToast(data.message || `Could not save ${group.replace('_', ' ')} data`, 'error')
    }
  }

  // Best-effort, like the billing gate itself — a save hiccup still lets the file (built from
  // local session state, not a server round trip) generate and download.
  async function persistAllGroups() {
    await Promise.all(ALL_GROUPS.map((group) => persistGroup(group, sheetsByGroup[group]?.headers || [], mergedRowsFor(group, sessionRows[group]))))
  }

  // Pads `rows` with blank rows up to `length`, using `group`'s own headers
  // for the blanks — used both to keep every group row-count-synced with
  // Product Details (handleRowsChange below) and to make sure a
  // cross-group update always has somewhere to land (handleCellReconciliation).
  function extendRows(group, rows, length) {
    if (rows.length >= length) return rows
    const groupHeaders = sheetsByGroup[group]?.headers || []
    return [...rows, ...Array.from({ length: length - rows.length }, () => blankRow(groupHeaders))]
  }

  // Every group is one logical sheet of the same set of products — row i in
  // Product Details, Compulsory, Prefill and Optional is all one product,
  // no matter which of them you're actually typing in ("every group is
  // based on one sheet[s]"). So the moment *any* group grows a new row
  // (SheetGrid's own always-one-trailing-blank-row behavior, once its
  // current last row stops being empty), every other group grows to match
  // too, blank rows ready to receive whatever propagates into them next —
  // not just whichever tab you happen to be on staying ahead while the
  // others lag behind at fewer rows.
  // Functional update — composes correctly with handleCellReconciliation below, which (now that
  // there's no debounce separating them into different ticks) always runs first, synchronously,
  // inside the very same cell edit. Building `nextAll` off `prev` instead of the outer
  // `sessionRows` closure is what makes that composition safe rather than one silently
  // discarding the other's work.
  function handleRowsChange(group, nextSessionRows) {
    setSessionRows((prev) => {
      const nextAll = { ...prev, [group]: nextSessionRows }
      const targetLength = nextSessionRows.length
      for (const g of ALL_GROUPS) {
        if (g === group) continue
        const rows = nextAll[g] || []
        if (rows.length < targetLength) {
          nextAll[g] = extendRows(g, rows, targetLength)
        }
      }
      return nextAll
    })
  }

  // Runs synchronously on every cell edit — no debounce. One functional setSessionRows commit
  // per edit, so it composes correctly with handleRowsChange's own update right after it (see
  // that function's comment) instead of either one silently clobbering the other.
  //
  // `crossGroupUpdates` is whatever propagateFromGroup(activeGroup, ...) found for the header
  // just edited (fanning the *active* group's row out to every other group, same as before).
  // Then, always, regardless of which group is active: Product Details first, then Prefill —
  // for each, a same-group "history" match (that group's own already-saved rows in this
  // template, keyed by whichever header(s) are isUniqueKeyPart) backfills only its still-blank
  // fields, formulas recompute (last, so they see whatever backfill/cascade just landed —
  // unconditionally, every time, per formula.js's recomputeFormulas — not just once while
  // blank), then a cross-group cascade fans the now-resolved row out to every *other* group.
  // When a history match was found, that cascade runs a second time fed the full matched record
  // instead of the live row, so Compulsory/Optional get compulsorily filled in full — while
  // Product Details'/Prefill's own row only ever gets its blank fields filled, never
  // overwritten (Rule 1).
  function handleCellReconciliation(rowIndex, changedHeaderId, sourceGroup, sourceRow, crossGroupUpdates) {
    setSessionRows((prevSessionRows) => {
      const working = { ...prevSessionRows }

      function getRow(group, idx) {
        const rows = extendRows(group, working[group] || prevSessionRows[group] || [], idx + 1)
        working[group] = rows
        return rows[idx]
      }
      function setRow(group, idx, nextRow) {
        const rows = [...(working[group] || [])]
        rows[idx] = nextRow
        working[group] = rows
      }
      function applyUpdates(updates, idx) {
        if (!updates) return
        for (const [group, fields] of Object.entries(updates)) {
          setRow(group, idx, { ...getRow(group, idx), ...fields })
        }
      }

      // Seed the edited group's own row with this keystroke's already-resolved value before
      // anything below reads it. `prevSessionRows` is one keystroke behind — the value typed
      // just now is still only sitting in `sourceRow`, not yet committed to sessionRows (that
      // commit is a separate setSessionRows call from handleRowsChange, same tick, but not yet
      // run). Without this, resolveGroup('design_system')/('prefill') below — which run
      // unconditionally, even when one of them *is* the group being typed into — would read the
      // stale one-character-behind row and re-propagate that instead, clobbering the correct
      // fresh value crossGroupUpdates just applied (e.g. typing "1003-red" would fan out
      // "1003-re" to linked fields).
      setRow(sourceGroup, rowIndex, { ...getRow(sourceGroup, rowIndex), ...sourceRow })

      applyUpdates(crossGroupUpdates, rowIndex)

      function resolveGroup(group) {
        const headers = sheetsByGroup[group]?.headers || []
        let row = getRow(group, rowIndex)

        // Always looked up, not just when this group's own row still has a blank field — Rule
        // 1's cross-group cascade below needs `match` even when Product Details'/Prefill's own
        // row is already fully typed, so a Product Number/Brand match still compulsorily fills
        // Compulsory/Optional every time, not just the first time this row had gaps.
        // backfillEmptyFields still only ever touches this group's own still-blank cells.
        const match = findGroupKeyMatch(group, row, sheetsByGroup)
        if (match) {
          const backfill = backfillEmptyFields(headers, row, match)
          if (backfill) { row = { ...row, ...backfill }; setRow(group, rowIndex, row) }
        }

        const formulaExtra = recomputeFormulas(headers, row, changedHeaderId)
        if (formulaExtra) { row = { ...row, ...formulaExtra }; setRow(group, rowIndex, row) }

        applyUpdates(propagateFromGroup(group, row, sheetsByGroup), rowIndex)
        if (match) applyUpdates(propagateFromGroup(group, match, sheetsByGroup), rowIndex)
      }

      resolveGroup('design_system')
      resolveGroup('prefill')
      return working
    })
  }

  // Clears every block back to a single blank row — a manual "start over"
  // for the next listing, independent of SheetGrid's own automatic
  // one-trailing-blank-row behavior. Since this session never autosaves
  // (see persistAllGroups above), this discards whatever wasn't downloaded
  // yet — same as a refresh — never anything that was already downloaded.
  function handleCreateNew() {
    setSessionRows(blankSessionFor(content?.sheets))
  }

  // Merges AI-generated fields into the active group's current session row
  // and marks them `aiFilled` (plan §14) — goes through the same
  // handleRowsChange every manual edit in this group uses, so it stays
  // subject to the always-one-trailing-blank-row/row-count-sync behavior.
  // Defense in depth: see product-details/page.js's own copy of this
  // comment — a field that already has a value is never overwritten here,
  // no matter what the response contained.
  function handleAiFillRow(rowIndex, fields) {
    const nextRows = activeSessionRows.map((r, i) => {
      if (i !== rowIndex) return r
      const toApply = Object.fromEntries(Object.entries(fields).filter(([k]) => !String(r[k] ?? '').trim()))
      if (Object.keys(toApply).length === 0) return r
      const nextAiFilled = Array.from(new Set([...(r.aiFilled || []), ...Object.keys(toApply)]))
      return { ...r, ...toApply, aiFilled: nextAiFilled }
    })
    handleRowsChange(activeGroup, nextRows)
  }

  // Auto-triggered the moment an image cell gets a usable value (plan §6) —
  // only actually calls the AI route when the row has an empty
  // Brand/Highlights header to fill, so it's never a wasted coin.
  function handleImageUploaded(rowIndex, headerId, url) {
    const row = activeSessionRows[rowIndex]
    if (!row || !sheet) return
    const targets = computeVisionTargets({ headers: sheet.headers, row: { ...row, [headerId]: url } })
    if (targets.length === 0) return
    fillRowFromImage(activeGroup, rowIndex, headerId, handleAiFillRow)
  }

  // "AI Fill Up" — runs whatever scope the AiFillUpModal picker confirmed
  // (`selections` = [{group, headerIds}]). The bulk route only ever acts on
  // already-persisted Blob content (it has no notion of this page's
  // client-only session state), so this first persists the current session
  // exactly like Save/Download already do, runs the fill against what just
  // landed on the server, then reloads and re-slices each group's saved
  // rows back into `sessionRows` — the grid here only ever renders session
  // state, so without this step the fill would succeed on the server but
  // never appear on screen.
  async function handleAiFillUp(selections) {
    if (!content || fillingUpAll || !selections?.length) return
    setFillingUpAll(true)
    try {
      await persistAllGroups()
      await runBulk(selections, {
        onDone: async () => {
          const res = await fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
          const d = await res.json()
          setContent(d.content)
          const nextSessionRows = {}
          for (const group of ALL_GROUPS) {
            const savedRows = d.content.sheets.find((s) => s.group === group)?.rows || []
            // The tail of the freshly saved sheet is exactly what this
            // session just contributed (persistAllGroups appends session
            // rows after whatever already existed) — same length as this
            // session's own non-blank rows, plus the one trailing blank
            // every sheet always carries.
            const sessionLen = (sessionRows[group] || []).filter((r) => !isRowEmpty(r)).length
            const tailLen = sessionLen + 1
            nextSessionRows[group] = savedRows.slice(Math.max(0, savedRows.length - tailLen))
          }
          setSessionRows(nextSessionRows)
        },
      })
    } finally {
      setFillingUpAll(false)
    }
  }

  // Formula headers are editable right from the grid (see SheetGrid.jsx's
  // header-row formula box) — persists via the same sheet PATCH route,
  // sending the merged (existing + this session's) rows alongside the
  // updated headers so an in-progress session's rows aren't dropped.
  function handleHeaderChange(headerId, patch) {
    if (!sheet) return
    const nextHeaders = sheet.headers.map((h) => (h.id === headerId ? { ...h, ...patch } : h))
    setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === activeGroup ? { ...s, headers: nextHeaders } : s)) }))
    fetch(`/api/listing-tools/${templateId}/sheets/${activeGroup}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers: nextHeaders, rows: mergedRowsFor(activeGroup, sessionRows[activeGroup]) }),
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        addToast(data.message || 'Could not save formula', 'error')
      }
    })
  }

  async function handleUploadOldSheet(file) {
    if (!file || !content) return
    setUploading(true)
    try {
      const result = await importIntoBestMatchingGroup(file, content.sheets.filter((s) => UPLOAD_MATCH_GROUPS.includes(s.group)))
      if (!result) {
        addToast("Couldn't match that file's columns to any sheet in this template.", 'error')
        return
      }
      handleRowsChange(result.group, result.rows)
      addToast(`Updated the ${result.group.replace('_', ' ')} sheet from that file.`, 'success')
    } catch {
      addToast('Could not read that file — is it a valid .xlsx?', 'error')
    } finally {
      setUploading(false)
    }
  }

  // Full export = everything ever saved, not just this session's new rows.
  function buildExportTemplate() {
    return {
      ...content,
      sheets: content.sheets.map((s) => ({ ...s, rows: mergedRowsFor(s.group, sessionRows[s.group]) })),
    }
  }

  // Explicit "Save" — persists this session's typing to the backend right now, without
  // exporting a file. Same persistAllGroups() the Download button already runs first; this just
  // exposes that step on its own, for saving progress on a long batch without generating a
  // download every time.
  async function handleSave() {
    setSaving(true)
    try {
      await persistAllGroups()
      addToast('Saved', 'success')
    } finally {
      setSaving(false)
    }
  }

  // The one moment this session's typing actually reaches the backend — persist every group
  // first (SKU assignment inside runExport reads the *server's* copy, so this has to land before
  // it runs), then export. Same best-effort spirit as the billing gate: a save hiccup is toasted
  // but never blocks the file from generating.
  async function handleDownload() {
    setPersisting(true)
    try {
      await persistAllGroups()
    } finally {
      setPersisting(false)
    }
    runExport({ template: buildExportTemplate(), groups: ALL_GROUPS, format: 'excel', meta: template })
  }

  return (
    <div className="min-h-[70vh] bg-gray-50 px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <PillButton
            variant="ai"
            icon={Sparkles}
            loading={fillingUpAll}
            disabled={!content || !hasAnyFilledRow}
            title={!content || hasAnyFilledRow ? undefined : 'Add at least 2 product rows before running AI Fill Up'}
            onClick={() => setShowAiFillUpModal(true)}
          >
            AI Fill Up
          </PillButton>
          <PillButton variant="ghost" icon={PlusCircle} onClick={handleCreateNew} disabled={!content}>
            Create New
          </PillButton>
          <PillButton variant="upload" icon={UploadCloud} loading={uploading} onClick={() => uploadInputRef.current?.click()}>
            Upload Old Sheet
          </PillButton>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { handleUploadOldSheet(e.target.files?.[0]); e.target.value = '' }}
          />
          <PillButton variant="edit" icon={Save} loading={saving} disabled={!content} onClick={handleSave}>
            Save
          </PillButton>
          <PillButton
            variant="download"
            icon={Download}
            loading={persisting || exporting}
            disabled={!content}
            onClick={handleDownload}
          >
            Download Final Sheet
          </PillButton>
        </div>
      </div>

      {!content && <p className="px-4 py-8 text-center text-[13px] text-gray-400">Loading…</p>}

      {sheet && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <SheetTabs variant="dark" active={activeGroup} onChange={onChangeGroup} />
          <SheetGrid
            headers={sheet.headers}
            rows={filteredRows}
            onRowsChange={(nextRows) => handleRowsChange(activeGroup, nextRows)}
            uploadUrl={`/api/listing-tools/${templateId}/images`}
            pickerOptions={buildPickerOptions(sheet.headers, sheetsByGroup)}
            onCellChange={(headerId, value, rowIndex, row) => {
              const sameGroupExtra = resolveLinkedFill(sheet.headers, headerId, value, -1, sheetsByGroup)
              // `row` already has this edit applied (see SheetGrid.jsx's
              // resolveRow); merge in whatever Rule A just resolved too, so
              // picking an *existing* record propagates its full row, not
              // just the one field that was clicked. Always attempted, for
              // whichever group is currently active — connected headers
              // work the same regardless of which group is the source; a
              // group with nothing linked back to it is just a no-op here.
              const fullRow = { ...row, ...(sameGroupExtra || {}) }
              const crossGroupUpdates = propagateFromGroup(activeGroup, fullRow, sheetsByGroup)
              handleCellReconciliation(rowIndex, headerId, activeGroup, fullRow, crossGroupUpdates)
              return sameGroupExtra
            }}
            onHeaderChange={handleHeaderChange}
            onImageUploaded={handleImageUploaded}
          />
        </div>
      )}

      <BillingGateModal gate={gate} onClose={closeGate} onRetry={handleDownload} />
      <BillingGateModal gate={aiGate} onClose={closeAiGate} />
      <BillingGateModal gate={bulkGate} onClose={closeBulkGate} />
      {showAiFillUpModal && (
        <AiFillUpModal
          onClose={() => setShowAiFillUpModal(false)}
          // Merged (existing + session) rows so the preview reflects what
          // will actually be processed — handleAiFillUp persists this same
          // session before running the fill, so a row you're mid-typing
          // right now still counts toward the scope shown here.
          sheets={ALL_GROUPS.map((group) => ({
            group,
            sheetName: sheetsByGroup[group]?.sheetName,
            headers: sheetsByGroup[group]?.headers || [],
            rows: mergedRowsFor(group, sessionRows[group]),
          }))}
          defaultGroup={activeGroup}
          onRun={(selections) => { setShowAiFillUpModal(false); handleAiFillUp(selections) }}
        />
      )}
    </div>
  )
}
