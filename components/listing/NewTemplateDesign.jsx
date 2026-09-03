'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { UploadCloud, Save, Bookmark, Plus, Trash2, Check, Loader2, ArrowLeft, X, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/components/admin/Toast'
import { UNMAPPED_TAB_ID } from './GroupTabsStep'
import NewDesignColumnModal from './NewDesignColumnModal'

// New Design — a 1:1 port of source/arshanemi-tools-4.html, driven entirely
// by the shared `api` bag assembled in TemplateSettingsWizard.jsx. Nothing
// here has its own persistence: upload / parse / group / preset / save all
// go through the exact same handlers Old Design uses, so a template built in
// either tab comes out identical.
//
// Mapping decisions (confirmed with the user):
//  - the HTML's section headings are placeholders → real group buckets, each
//    with its own colour. Group order + colours: Product Details = blue,
//    Compulsory = green, Brand Details = amber (highlighted), Other = plain
//    gray (the muted, de-emphasised "unassigned" staging bucket).
//  - the "Other" bucket is UNMAPPED_TAB_ID — staging only, never persisted
//    (same as Old Design).
//  - headers lifted off an uploaded sheet are auto-separated by the sheet's
//    own group-label row (TemplateSettingsWizard's buildFields); any header
//    whose group can't be recognised lands in Other / Unselected.
//  - the red "Fix" flag is now a DEFAULT-HEADER-ONLY marker: a built-in
//    default header shows just that flag (forced on, locked) and its whole
//    card is locked (no drag / group change / rename). A header from the
//    sheet or added by hand shows only the four group flags — no red flag
//    (its `disabled` is still editable in the settings modal). Default
//    connector headers in Compulsory / Brand Details are hidden from the
//    grid entirely (still saved).
//  - "Save" (the blue button) = save preset; the Template No field is always
//    read-only and is filled in automatically once the template is saved
const SECTIONS = [
  { id: 'design_system', title: 'Product Details', flag: 'blue' },
  { id: 'compulsory', title: 'Compulsory', flag: 'green' },
  { id: 'prefill', title: 'Brand Details', flag: 'amber' }, // highlighted
  { id: UNMAPPED_TAB_ID, title: 'Other', flag: 'gray' }, // muted / de-emphasised staging bucket
]
// Every flag box ALWAYS shows its own colour border. Only the tick (and a
// faint tint) appears when it's the active choice. Written as full literal
// class strings so Tailwind's scanner keeps them. Brand Details = amber
// (highlighted); Other = plain gray (the low-emphasis "unassigned" bucket).
const FLAG_BORDER = {
  blue: 'border-[#2563eb]',
  green: 'border-[#16a34a]',
  amber: 'border-[#d97706]',
  gray: 'border-[#9aa2ad]',
  red: 'border-[#e02424]',
}
const FLAG_TICK = {
  blue: 'text-[#2563eb]',
  green: 'text-[#16a34a]',
  amber: 'text-[#b45309]',
  gray: 'text-[#6b7280]',
  red: 'text-[#e02424]',
}
const FLAG_TINT = {
  blue: 'bg-[#2563eb]/10',
  green: 'bg-[#16a34a]/10',
  amber: 'bg-[#f59e0b]/15',
  gray: 'bg-[#9aa2ad]/12',
  red: 'bg-[#e02424]/10',
}
// Per-group heading colour. "Other" stays muted (text-subtle) so it reads as
// the low-emphasis staging bucket.
const SECTION_TITLE = {
  blue: 'text-[#2563eb]',
  green: 'text-[#16a34a]',
  amber: 'text-[#b45309]',
  gray: 'text-subtle',
}
// Card flag order follows the group order above: Product Details, Compulsory,
// Brand Details, Other.
const GROUP_FLAGS = ['blue', 'green', 'amber', 'gray']
const FLAG_TO_GROUP = { blue: 'design_system', green: 'compulsory', amber: 'prefill', gray: UNMAPPED_TAB_ID }
const GROUP_TO_FLAG = { design_system: 'blue', compulsory: 'green', prefill: 'amber', [UNMAPPED_TAB_ID]: 'gray' }

const inputCls =
  'w-full h-[38px] rounded-md border border-[#d7dce2] bg-background px-2.5 text-[14px] text-foreground outline-none focus:border-[#9dbfe8] placeholder:text-subtle'

function FlagBox({ kind, on, onClick, locked, title }) {
  const interactive = !!onClick && !locked
  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      title={title}
      tabIndex={interactive ? 0 : -1}
      aria-pressed={!!on}
      disabled={!interactive}
      className={`inline-flex h-5 w-[27px] flex-shrink-0 items-center justify-center rounded border-2 bg-background ${FLAG_BORDER[kind]} ${
        on ? `${FLAG_TICK[kind]} ${FLAG_TINT[kind]}` : 'text-transparent'
      } ${interactive ? 'cursor-pointer' : 'cursor-default'} ${locked ? 'opacity-90' : ''}`}
    >
      <Check className="h-3 w-3" strokeWidth={3.4} />
    </button>
  )
}

function Field({ label, className = '', children }) {
  return (
    <div className={`min-w-0 px-1.5 ${className}`}>
      <label className="my-1.5 block truncate text-[14.5px] text-muted">{label}</label>
      {children}
    </div>
  )
}

function MiniInput({ label, value, onChange, defaultValue, readOnly }) {
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

export default function NewTemplateDesign({ api }) {
  const { addToast } = useToast()
  const fileRef = useRef(null)
  const [collapsed, setCollapsed] = useState(false)
  const [modalId, setModalId] = useState(null)
  const [sortMode, setSortMode] = useState(null) // last-applied per-group sort: null | 'label' | 'original'
  const [dragOverSec, setDragOverSec] = useState(null)

  const {
    isEditMode, fields, parsing, sheetMeta, uploadingSource,
    dataSheetName, dropdownSheetName, selectDataSheet, selectDropdownSheet,
    dataGroupRow, setDataGroupRow, dataHeaderRow, setDataHeaderRow,
    dropdownHeaderRow, setDropdownHeaderRow, dropdownValuesRow, setDropdownValuesRow,
    updateField, deleteHeader, addHeaderToGroup, moveFieldBefore, sortFieldsWithinGroups, handleFile,
    fileName, resetWizard,
    templateNameInput, setTemplateNameInput, templateNumber,
    categoriesData, setCategoriesData, presetData, setPresetData, savePreset, currentPreset,
    handleSave, saving, savedTemplate,
  } = api

  const isLocked = (f) => f?.source === 'default'
  // The default headers withDefaultHeaders() drops into Compulsory and Brand
  // Details are fixed connector-mirrors of Product Details columns — they're
  // still saved (the connected-headers / auto-fill feature needs them), but
  // per the user's request they're hidden from the New Design grid. Product
  // Details keeps its own default headers visible.
  const isHiddenDefault = (f) => f?.source === 'default' && (f.groupId === 'compulsory' || f.groupId === 'prefill')
  function applySort(mode) {
    sortFieldsWithinGroups(mode)
    setSortMode(mode)
  }
  // The × on the uploaded-file chip: drop the sheet AND wipe every form below
  // it (top form, sheet selectors, the whole header grid, preset). Confirmed
  // first — it clears everything the user has typed since the upload.
  function handleClearUpload() {
    if (!window.confirm('Remove the uploaded sheet and clear the whole form below?')) return
    resetWizard() // clears categoriesData (incl. category 5 & 6) via DEFAULT_CATEGORIES
    setCollapsed(false)
    setSortMode(null)
    setModalId(null)
  }

  const cat = (n) => categoriesData[`category${n}`] || ''
  const setCat = (n, v) => setCategoriesData({ ...categoriesData, [`category${n}`]: v })
  const setPreset = (k, v) => setPresetData({ ...presetData, [k]: v })

  // Both composed names join with "_". Save Final Name also appends the
  // Version at the very end (marketplace_cat1…cat6_version).
  const finalName = [presetData.marketplaceName, cat(1), cat(2), cat(3), cat(4), cat(5), cat(6), presetData.exportVersion]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join('_')

  // Create mode: Template Name is composed automatically from Marketplace +
  // Category 6 ("Meesho_Blouses") and is read-only. It isn't stored in the
  // wizard's `templateNameInput` state — it's passed straight to handleSave()
  // below. Edit mode keeps the saved name editable (Category 6 isn't
  // persisted, so it can't be recomposed).
  const autoTemplateName = [presetData.marketplaceName, cat(6)]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join('_')
  const saveTemplate = () =>
    handleSave({ ...(isEditMode ? {} : { templateName: autoTemplateName }), finalName })

  const modalField = modalId ? fields.find((f) => f.id === modalId) : null

  function onCardDrop(e, target) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverSec(null)
    const dragId = e.dataTransfer.getData('text/plain')
    if (!dragId || dragId === target.id) return
    const drag = fields.find((f) => f.id === dragId)
    if (isLocked(drag)) return // default headers never move
    // Drop on the target card's right half → land AFTER it; left half → BEFORE
    // it. Without this the card always inserts before the target, so it ends
    // up one slot earlier than where it was dropped.
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientX > rect.left + rect.width / 2
    if (drag && drag.groupId !== target.groupId) updateField(dragId, { groupId: target.groupId })
    moveFieldBefore(dragId, target.id, after)
    setSortMode(null)
  }
  function onSectionDrop(e, groupId) {
    e.preventDefault()
    setDragOverSec(null)
    const dragId = e.dataTransfer.getData('text/plain')
    if (!dragId) return
    if (isLocked(fields.find((f) => f.id === dragId))) return
    updateField(dragId, { groupId })
    setSortMode(null)
  }

  function handleSavePreset() {
    savePreset({
      marketplaceName: presetData.marketplaceName,
      category1: cat(1),
      exportVersion: presetData.exportVersion,
    })
    addToast('Preset saved — the template number is filled in automatically on save.', 'success')
    setCollapsed(true)
  }

  const btnBase =
    'flex w-full items-center justify-center gap-2 rounded-full h-10 mb-3 text-[15px] font-semibold text-white disabled:opacity-60'

  return (
    <div className="text-[14px]">
      {savedTemplate && isEditMode && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-700">
          <span>&ldquo;{savedTemplate.templateName}&rdquo; updated.</span>
          <Link
            href="/listing-tools/template-settings"
            className="inline-flex items-center gap-1 font-semibold hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Templates
          </Link>
        </div>
      )}

      {/* collapsed template bar (after Save preset) */}
      {collapsed && (
        <div className="mb-1 flex flex-wrap items-center gap-y-2 rounded-[7px] border border-divider px-3 py-2.5">
          <div className="min-w-0 flex-1 truncate pr-3.5 text-[17px] font-semibold text-foreground">
            {finalName || autoTemplateName || templateNameInput || 'Untitled template'}
            <span className="ml-2.5 text-[13.5px] font-normal text-subtle">
              {templateNumber ? `Template ${templateNumber}` : 'Number assigned on save'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="mr-3.5 px-1.5 py-2 text-[15px] font-semibold text-[#2f6fd0]"
          >
            Edit template
          </button>
          <button
            type="button"
            onClick={saveTemplate}
            disabled={saving}
            className="flex h-10 items-center gap-2 rounded-full bg-[#ec1e63] px-5 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />} Save to template
          </button>
        </div>
      )}

      {/* top form */}
      {!collapsed && (
        <div className="flex flex-wrap items-stretch">
          <div className="min-w-0 flex-[1_1_520px] rounded-[7px] border border-divider p-3">
            <div className="flex flex-wrap">
              <Field label="Marketplace Name" className="flex-[1_1_170px]">
                <input
                  className={inputCls}
                  placeholder="Meesho"
                  value={presetData.marketplaceName || ''}
                  onChange={(e) => setPreset('marketplaceName', e.target.value)}
                />
              </Field>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Field key={n} label={`Category ${n}`} className="flex-[1_1_170px]">
                  <input className={inputCls} value={cat(n)} onChange={(e) => setCat(n, e.target.value)} />
                </Field>
              ))}
              <Field label="Version" className="flex-[0_1_105px]">
                <input
                  className={inputCls}
                  placeholder="v1.0"
                  value={presetData.exportVersion || ''}
                  onChange={(e) => setPreset('exportVersion', e.target.value)}
                />
              </Field>
            </div>

            <div className="flex flex-wrap">
              <Field label="Save Final Name" className="flex-[5_1_260px]">
                <input
                  readOnly
                  className={`${inputCls} bg-surface font-semibold text-muted`}
                  value={finalName}
                  placeholder="marketplace_category_version"
                />
              </Field>
              <Field label="Template Name" className="flex-[2.4_1_170px]">
                {isEditMode ? (
                  <input
                    className={inputCls}
                    placeholder="Meesho_Blouses"
                    value={templateNameInput}
                    onChange={(e) => setTemplateNameInput(e.target.value)}
                  />
                ) : (
                  <input
                    readOnly
                    title="Auto — Marketplace + Category 6"
                    className={`${inputCls} bg-surface font-semibold text-muted`}
                    placeholder="Marketplace_Category 6"
                    value={autoTemplateName}
                  />
                )}
              </Field>
              <Field label="Template No" className="flex-[0.95_1_110px]">
                <input
                  readOnly
                  disabled
                  title="Assigned automatically on save — not editable"
                  className={`${inputCls} bg-surface font-semibold text-muted`}
                  value={templateNumber || 'On save'}
                />
              </Field>
              <Field label="Description" className="flex-[6_1_200px]">
                <input
                  className={inputCls}
                  placeholder="Other"
                  value={presetData.description || ''}
                  onChange={(e) => setPreset('description', e.target.value)}
                />
              </Field>
            </div>

            {currentPreset && (
              <p className="mt-1.5 px-1.5 text-[12px] text-emerald-600">
                Preset saved: {currentPreset.marketplaceName || 'marketplace'} /{' '}
                {currentPreset.category1 || 'category'} / {currentPreset.exportVersion || 'v1.0'}
              </p>
            )}
          </div>

          <div className="mt-3 flex w-full flex-shrink-0 flex-col sm:ml-3.5 sm:mt-0 sm:w-[200px]">
            {!isEditMode && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    handleFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                {fileName ? (
                  /* Upload done → show the file name + a × that resets everything below */
                  <div className="mb-3 flex h-10 items-center gap-2 rounded-lg border border-divider bg-surface px-2.5">
                    {parsing ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#16a34a]" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#16a34a]" />
                    )}
                    <span
                      className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground"
                      title={fileName}
                    >
                      {fileName}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearUpload}
                      title="Remove sheet & reset the form below"
                      className="shrink-0 rounded-full p-1 text-subtle hover:bg-[#fdeeee] hover:text-[#e02424]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={parsing}
                    className={`${btnBase} bg-[#101828]`}
                  >
                    {parsing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4 text-emerald-400" />
                    )}
                    Upload Sheet
                  </button>
                )}
              </>
            )}
            <button type="button" onClick={handleSavePreset} className={`${btnBase} bg-[#2f6fd0]`}>
              <Save className="h-4 w-4" /> Save
            </button>
            <button type="button" onClick={saveTemplate} disabled={saving} className={`${btnBase} bg-[#ec1e63]`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />} Save to template
            </button>
            {uploadingSource && <p className="text-[11px] text-subtle">Saving original file…</p>}
          </div>
        </div>
      )}

      {/* sheet selectors (create mode only, like Old Design) */}
      {!collapsed && !isEditMode && (
        <div className="mt-2.5 rounded-[7px] border border-divider p-3">
          <div className="flex flex-wrap gap-y-3.5">
            <div className="min-w-0 flex-[1_1_330px] sm:pr-5">
              <div className="mb-2 text-[14.5px] text-muted">Product fill sheet</div>
              <select value={dataSheetName} onChange={(e) => selectDataSheet(e.target.value)} className={inputCls}>
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
                <MiniInput label="I section" defaultValue="2" readOnly />
              </div>
            </div>
            <div className="min-w-0 flex-[1_1_330px] sm:pl-5">
              <div className="mb-2 text-[14.5px] text-muted">Dropdowns Reference Sheet</div>
              <select
                value={dropdownSheetName}
                onChange={(e) => selectDropdownSheet(e.target.value)}
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
      )}

      {/* product details bar */}
      <div className="mt-4 flex flex-wrap items-center gap-y-2">
        <div className="flex-[1_1_200px] text-[19px] font-semibold text-foreground">Headers Details</div>
        <div className="flex flex-wrap items-center gap-y-2">
          <button
            type="button"
            onClick={() => applySort('label')}
            title="Sort headers A→Z inside each group (groups are not mixed)"
            className={`ml-2.5 rounded-full px-4 py-2 text-[14px] font-medium text-white ${
              sortMode === 'label' ? 'bg-[#2b7ecb]' : 'bg-[#6ba3dd]'
            }`}
          >
            Sort Group
          </button>
          <button
            type="button"
            onClick={() => applySort('original')}
            title="Restore each group's headers to their original sheet-column order"
            className={`ml-2.5 rounded-full px-4 py-2 text-[14px] font-medium text-white ${
              sortMode === 'original' ? 'bg-[#1f5fa8]' : 'bg-[#2b7ecb]'
            }`}
          >
            Sort Original
          </button>
          <button
            type="button"
            /* New header ("Header 1", "Header 2", …) is appended to the end of
               the Product Details group. */
            onClick={() => addHeaderToGroup('design_system')}
            className="ml-2.5 rounded-full bg-[#4a92db] px-4 py-2 text-[14px] font-medium text-white"
          >
            Add Header
          </button>
          {[
            ['blue', 'Product details'],
            ['green', 'Cumpulsery'],
            ['amber', 'Brand Details'],
            ['gray', 'Other'],
            ['red', 'Fix'],
          ].map(([k, label]) => (
            <span key={k} className="ml-4 flex items-center whitespace-nowrap text-[14.5px] text-muted">
              <span className="mr-2">
                <FlagBox kind={k} on />
              </span>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* grid — one section per group (Product Details → Compulsory → Brand
          Details → Other). Drag a card to reorder it inside its group or drop
          it on another group. Built-in default headers are locked. */}
      <div className="mt-2">
        {SECTIONS.map((sec) => {
          const cards = fields.filter((f) => f.groupId === sec.id && !isHiddenDefault(f))
          return (
            <div
              key={sec.id}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragOverSec !== sec.id) setDragOverSec(sec.id)
              }}
              onDragLeave={() => setDragOverSec((c) => (c === sec.id ? null : c))}
              onDrop={(e) => onSectionDrop(e, sec.id)}
            >
              <div className={`mb-1 mt-1 flex items-center gap-2 text-[18px] font-bold ${SECTION_TITLE[sec.flag]}`}>
                <span className={`h-4 w-1.5 rounded-full ${FLAG_TINT[sec.flag]} ${FLAG_BORDER[sec.flag]} border`} aria-hidden />
                {sec.title} <span className="text-[13px] font-normal text-subtle">({cards.length})</span>
              </div>
              <div
                className={`-mx-[7px] flex flex-wrap rounded-md ${
                  dragOverSec === sec.id ? FLAG_TINT[sec.flag] : ''
                }`}
              >
                {cards.length === 0 ? (
                  <p className="px-[7px] py-1 text-[13px] italic text-subtle">
                    Drop headers here, or click a flag on a card to move it in.
                  </p>
                ) : (
                  cards.map((field) => {
                    const locked = isLocked(field)
                    return (
                      <div
                        key={field.id}
                        draggable={!locked}
                        onDragStart={
                          locked
                            ? undefined
                            : (e) => {
                                e.dataTransfer.setData('text/plain', field.id)
                                e.dataTransfer.effectAllowed = 'move'
                              }
                        }
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onCardDrop(e, field)}
                        className="mb-1 shrink-0 grow-0 basis-full px-[7px] sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5 2xl:basis-[12.5%]"
                      >
                        <div className="mb-1 flex gap-2 pl-1">
                          {/* Default header: ONLY the red (locked, checked)
                              flag shows. A header from the sheet or added by
                              hand shows the four group flags and NO red flag —
                              "Fix" is a default-header-only marker now. */}
                          {locked ? (
                            <FlagBox kind="red" on locked title="Default header — locked" />
                          ) : (
                            GROUP_FLAGS.map((fl) => (
                              <FlagBox
                                key={fl}
                                kind={fl}
                                on={GROUP_TO_FLAG[field.groupId] === fl}
                                onClick={() => updateField(field.id, { groupId: FLAG_TO_GROUP[fl] })}
                                title={SECTIONS.find((s) => s.id === FLAG_TO_GROUP[fl])?.title}
                              />
                            ))
                          )}
                        </div>
                        <div
                          className={`group relative flex h-[46px] items-center rounded-[7px] border px-2.5 ${
                            locked ? 'border-[#e59a9a] bg-[#e02424]/[0.04]' : 'border-divider bg-background'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setModalId(field.id)}
                            title="Column settings"
                            className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded border-[1.5px] border-[#8a929c] hover:bg-card"
                          >
                            <Plus className="h-3 w-3 text-muted" strokeWidth={3} />
                          </button>
                          {!locked && (
                            <button
                              type="button"
                              onClick={() => deleteHeader(field.id)}
                              title="Delete column"
                              className="ml-1.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded border-[1.5px] border-[#e59a9a] hover:bg-[#fdeeee]"
                            >
                              <Trash2 className="h-3 w-3 text-[#d14343]" />
                            </button>
                          )}
                          <input
                            value={field.label}
                            readOnly={locked}
                            onChange={locked ? undefined : (e) => updateField(field.id, { label: e.target.value })}
                            onMouseDown={(e) => e.stopPropagation()}
                            placeholder="Column name"
                            title={locked ? 'Default header name can’t be changed' : undefined}
                            className={`ml-2 w-full min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1.5 py-1 text-[14.5px] outline-none ${
                              locked
                                ? 'cursor-default text-muted'
                                : 'text-foreground hover:bg-card focus:border-[#9dbfe8] focus:bg-background'
                            }`}
                          />
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -top-9 left-0 z-40 hidden max-w-[340px] truncate rounded-md bg-[#1f2937] px-2.5 py-1.5 text-[12px] text-white shadow-lg group-focus-within:block"
                          >
                            {field.label || 'Column name'}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {modalField && (
        <NewDesignColumnModal
          field={modalField}
          sections={SECTIONS}
          allFields={fields}
          onUpdateField={updateField}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  )
}
