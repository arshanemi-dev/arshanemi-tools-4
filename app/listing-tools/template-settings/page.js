'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Plus,
  Download,
  Upload,
  Loader2,
  Eye,
  Pencil,
  Copy,
  Check,
  X,
  Trash2,
  ClipboardPaste,
  CopyCheck,
} from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import TemplateBadge from '@/components/listing/TemplateBadge'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import Modal from '@/components/admin/Modal'
import { useToast } from '@/components/admin/Toast'

const BULK_COLUMNS = ['Template Name', 'Template Description', 'Title', 'Description', 'Keywords', 'Rules', 'Rule-1', 'Rule-2']

const EDIT_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'keyword', label: 'Keywords' },
  { key: 'otherRules', label: 'Rules' },
  { key: 'rule1', label: 'Rule-1' },
  { key: 'rule2', label: 'Rule-2' },
]

function rulesOf(template) {
  return {
    title: template.aiRules?.title || '',
    description: template.aiRules?.description || '',
    keyword: template.aiRules?.keyword || '',
    otherRules: template.aiRules?.otherRules || '',
    rule1: template.aiRules?.rule1 || '',
    rule2: template.aiRules?.rule2 || '',
  }
}

// Preset inputs shown in the "Edit Template" dialog — same set the New
// Design's top form uses at create time.
function presetOf(template) {
  return {
    marketplaceName: template.marketplaceName || '',
    category1: template.category1 || '',
    category2: template.category2 || '',
    category3: template.category3 || '',
    category4: template.category4 || '',
    category5: template.category5 || '',
    category6: template.category6 || '',
    exportVersion: template.exportVersion || '',
  }
}
// Same composition rules as NewTemplateDesign.jsx: Template Name =
// Marketplace + Category 6; Final Name = Marketplace + Category 1…6 + Version.
function composeTemplateName(p) {
  return [p.marketplaceName, p.category6].map((s) => (s || '').trim()).filter(Boolean).join('_')
}
function composeFinalName(p) {
  return [p.marketplaceName, p.category1, p.category2, p.category3, p.category4, p.category5, p.category6, p.exportVersion]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join('_')
}

// Single Row Component with Checkbox and Inline Table Editing
function TemplateSettingsRow({ template, isSelected, onToggleSelect, onUpdated, onDeleted }) {
  const { addToast } = useToast()
  const [editingRules, setEditingRules] = useState(false)
  const [draft, setDraft] = useState(() => rulesOf(template))
  const [descDraft, setDescDraft] = useState(() => template.description || '')
  const [savingRules, setSavingRules] = useState(false)
  const [togglingVisibility, setTogglingVisibility] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // "Edit Template" mini-dialog — same preset inputs as template-create time.
  // Template Name and Template Final Name are composed read-only from these,
  // exactly like the New Design's top form.
  const [editNamesOpen, setEditNamesOpen] = useState(false)
  const [savingNames, setSavingNames] = useState(false)
  const [presetDraft, setPresetDraft] = useState(() => presetOf(template))

  const totalRows = Object.values(template.rowCounts || {}).reduce((sum, n) => sum + (n || 0), 0)
  const isUsed = totalRows > 0

  async function patchTemplate(body) {
    const res = await fetch(`/api/listing-tools/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || 'Request failed')
    return data.template
  }

  function startEditRules() {
    setDraft(rulesOf(template))
    setDescDraft(template.description || '')
    setEditingRules(true)
  }

  function cancelEditRules() {
    setDraft(rulesOf(template))
    setDescDraft(template.description || '')
    setEditingRules(false)
  }

  function openEditNames() {
    setPresetDraft(presetOf(template))
    setEditNamesOpen(true)
  }
  function setPreset(key, value) {
    setPresetDraft((p) => ({ ...p, [key]: value }))
  }
  const composedName = composeTemplateName(presetDraft)
  const composedFinal = composeFinalName(presetDraft)

  async function handleSaveNames() {
    if (!composedName) {
      addToast('Enter a Marketplace Name and Category 6 — the Template Name is built from them.', 'error')
      return
    }
    setSavingNames(true)
    try {
      const updated = await patchTemplate({
        templateName: composedName,
        finalName: composedFinal,
        marketplaceName: presetDraft.marketplaceName.trim(),
        category1: presetDraft.category1.trim(),
        category2: presetDraft.category2.trim(),
        category3: presetDraft.category3.trim(),
        category4: presetDraft.category4.trim(),
        category5: presetDraft.category5.trim(),
        category6: presetDraft.category6.trim(),
        exportVersion: presetDraft.exportVersion.trim(),
      })
      addToast('Template updated.', 'success')
      setEditNamesOpen(false)
      onUpdated(updated)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSavingNames(false)
    }
  }

  function handleCopyRules() {
    navigator.clipboard.writeText(JSON.stringify(rulesOf(template), null, 2))
    addToast('AI rules copied to clipboard.', 'success')
  }

  async function handlePasteRules() {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text)
      setDraft((prev) => ({
        title: parsed.title ?? prev.title,
        description: parsed.description ?? prev.description,
        keyword: parsed.keyword ?? prev.keyword,
        otherRules: parsed.otherRules ?? prev.otherRules,
        rule1: parsed.rule1 ?? prev.rule1,
        rule2: parsed.rule2 ?? prev.rule2,
      }))
      addToast('Pasted from clipboard.', 'success')
    } catch {
      addToast('Clipboard doesn’t have copied rules to paste.', 'error')
    }
  }

  async function handleSaveRules() {
    setSavingRules(true)
    try {
      const updated = await patchTemplate({ aiRules: draft, description: descDraft })
      addToast('AI rules saved.', 'success')
      setEditingRules(false)
      onUpdated(updated)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSavingRules(false)
    }
  }

  async function toggleVisibility() {
    setTogglingVisibility(true)
    const next = !template.isAllowedToShow
    try {
      const updated = await patchTemplate({ isAllowedToShow: next })
      onUpdated(updated)
      addToast(
        next
          ? `"${template.templateName}" activated — now visible in Auto Listing / Choose Your Template.`
          : `"${template.templateName}" deactivated — hidden from Auto Listing / Choose Your Template.`,
        'success',
      )
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setTogglingVisibility(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/listing-tools/${template.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not delete template')
      addToast('Template deleted', 'success')
      onDeleted(template.id)
    } catch (err) {
      addToast(err.message, 'error')
      setDeleting(false)
    }
  }

  return (
    <>
      <tr className={`border-b border-divider last:border-b-0 hover:bg-surface/60 ${isSelected ? 'bg-accent/6' : ''}`}>
        {/* Row Checkbox */}
        <td className="px-3 py-3 text-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onToggleSelect(template.id, e.target.checked)}
            className="w-4 h-4 text-accent rounded border-divider-light focus:ring-accent cursor-pointer"
          />
        </td>
          <td className="px-3 py-3">
          <button
            type="button"
            role="switch"
            aria-checked={!!template.isAllowedToShow}
            onClick={toggleVisibility}
            disabled={togglingVisibility}
            title={
              template.isAllowedToShow
                ? 'Visible in Auto Listing / Choose Your Template'
                : 'Hidden from Auto Listing / Choose Your Template'
            }
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-80 ${
              template.isAllowedToShow ? 'bg-emerald-500' : 'bg-divider-light'
            }`}
          >
            {togglingVisibility ? (
              <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-foreground" />
            ) : (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full bg-card shadow-sm transition-transform"
                style={{ transform: template.isAllowedToShow ? 'translateX(18px)' : 'translateX(4px)' }}
              />
            )}
          </button>
        </td>

        <td className="px-3 py-3 text-subtle font-mono whitespace-nowrap">{template.templateNumber || '—'}</td>
        <td className="px-3 py-3 text-foreground font-medium whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            {template.templateName}
            <TemplateBadge badge={template.viewerBadge} />
          </span>
        </td>
        <td className="px-3 py-3 text-subtle font-mono text-[12.5px] max-w-[220px]">
          <span className="block truncate" title={template.finalName || '—'}>{template.finalName || '—'}</span>
        </td>
        <td className="px-3 py-3 text-subtle max-w-[180px]">
          {editingRules ? (
            <input
              type="text"
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              placeholder="Template description"
              className="w-full px-2 py-1 text-[12.5px] border border-divider rounded focus:outline-none focus:ring-1 focus:ring-accent-light bg-card"
            />
          ) : (
            <span className="block truncate" title={template.description}>{template.description || '—'}</span>
          )}
        </td>

        {/* Dynamic AI Rules Inline Edit Cells */}
        {EDIT_FIELDS.map((field) => {
          const value = editingRules ? draft[field.key] : template.aiRules?.[field.key]
          return (
            <td key={field.key} className="px-2 py-3">
              {editingRules ? (
                <input
                  type="text"
                  value={value || ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full px-2 py-1 text-[12.5px] border border-divider rounded focus:outline-none focus:ring-1 focus:ring-accent-light bg-card"
                />
              ) : (
                <span
                  className="block max-w-[140px] truncate text-muted text-[12.5px]"
                  title={value || '—'}
                >
                  {value || '—'}
                </span>
              )}
            </td>
          )
        })}

        {/* Actions */}
        <td className="px-3 py-3">
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            {editingRules ? (
              <>
                <PillButton variant="upload" icon={Check} loading={savingRules} onClick={handleSaveRules}>
                  Save
                </PillButton>
                <PillButton variant="ghost" icon={ClipboardPaste} onClick={handlePasteRules}>
                  Paste
                </PillButton>
                <PillButton variant="ghost" icon={X} onClick={cancelEditRules}>
                  Cancel
                </PillButton>
              </>
            ) : (
              <>
                <Link href={`/listing-tools/template-settings/${template.id}/details`}>
                  <PillButton variant="view" icon={Eye}>View</PillButton>
                </Link>
                <PillButton
                  variant="ghost"
                  icon={Pencil}
                  onClick={openEditNames}
                  title="Edit the Template Name and Template Final Name"
                >
                  Edit Name
                </PillButton>
                <PillButton variant="ghost" icon={Pencil} onClick={startEditRules}>
                  Edit Rules
                </PillButton>
                <PillButton variant="ghost" icon={Copy} onClick={handleCopyRules}>
                  Copy Rules
                </PillButton>
                <PillButton variant="delete" icon={Trash2} onClick={() => setConfirmOpen(true)}>
                  Delete
                </PillButton>
              </>
            )}
          </div>
        </td>
      </tr>

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete "${template.templateName}"?`}
        description={
          isUsed
            ? `This template has been used — ${totalRows} row${
                totalRows === 1 ? '' : 's'
              } of real product data exist across its sheets. Deleting it permanently deletes that data too. This can't be undone.`
            : "This template hasn't been used yet (no product rows filled in). This can't be undone."
        }
        confirmText={isUsed ? template.templateName : undefined}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      <Modal
        open={editNamesOpen}
        onClose={() => setEditNamesOpen(false)}
        title="Edit Template"
        maxWidth="max-w-xl"
        footer={
          <>
            <PillButton variant="upload" icon={Check} loading={savingNames} onClick={handleSaveNames}>
              Save
            </PillButton>
            <PillButton variant="ghost" icon={X} onClick={() => setEditNamesOpen(false)}>
              Cancel
            </PillButton>
          </>
        }
      >
        {(() => {
          const labelCls = 'text-[11.5px] font-semibold text-muted'
          const fieldCls =
            'w-full px-3 py-2 text-[13px] border border-divider rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-accent-light'
          const roCls = `${fieldCls} bg-surface font-mono font-semibold text-muted`
          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 col-span-2 sm:col-span-3">
                  <span className={labelCls}>Marketplace Name</span>
                  <input
                    type="text"
                    value={presetDraft.marketplaceName}
                    onChange={(e) => setPreset('marketplaceName', e.target.value)}
                    placeholder="Meesho"
                    className={fieldCls}
                  />
                </label>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <label key={n} className="flex flex-col gap-1">
                    <span className={labelCls}>Category {n}</span>
                    <input
                      type="text"
                      value={presetDraft[`category${n}`]}
                      onChange={(e) => setPreset(`category${n}`, e.target.value)}
                      className={fieldCls}
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>Version</span>
                  <input
                    type="text"
                    value={presetDraft.exportVersion}
                    onChange={(e) => setPreset('exportVersion', e.target.value)}
                    placeholder="v1.0"
                    className={fieldCls}
                  />
                </label>
              </div>

              <div className="mt-1 border-t border-divider pt-4 grid gap-3">
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>Template Name — auto (Marketplace + Category 6)</span>
                  <input readOnly value={composedName} placeholder="Meesho_Blouses" className={roCls} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={labelCls}>Template Final Name — auto (Marketplace + Category 1–6 + Version)</span>
                  <input
                    readOnly
                    value={composedFinal}
                    placeholder="Meesho_Women Fashion_..._v1.0"
                    className={roCls}
                  />
                </label>
              </div>
            </>
          )
        })()}
      </Modal>
    </>
  )
}

// Main List Page
export default function TemplateSettingsListPage() {
  const { addToast } = useToast()
  const [templates, setTemplates] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const uploadInputRef = useRef(null)

  useEffect(() => {
    fetch('/api/listing-tools', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => setTemplates(data.templates || []))
      .catch(() => setTemplates([]))
  }, [])

  function handleUpdated(updated) {
    setTemplates((prev) => (prev || []).map((t) => (t.id === updated.id ? updated : t)))
  }

  function handleDeleted(id) {
    setTemplates((prev) => (prev || []).filter((t) => t.id !== id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const filtered = (templates || []).filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return t.templateName.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
  })

  // Selection Logic
  const allFilteredSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id))
  const someFilteredSelected = filtered.some((t) => selectedIds.has(t.id)) && !allFilteredSelected

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)))
    }
  }

  function toggleSelectOne(id, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // Copy Template Rules in Excel TSV Format
  async function handleAiCopyTemplates() {
    const targets = (templates || []).filter((t) => selectedIds.has(t.id))
    if (targets.length === 0) {
      addToast('Select at least one template to copy.', 'error')
      return
    }

    const headers = ['Template Name', 'Title', 'Description', 'Keywords', 'Rules', 'Rule-1', 'Rule-2'].join('\t')
    const rows = targets.map((t) => [
      t.templateName || '',
      t.aiRules?.title || '',
      t.aiRules?.description || '',
      t.aiRules?.keyword || '',
      t.aiRules?.otherRules || '',
      t.aiRules?.rule1 || '',
      t.aiRules?.rule2 || '',
    ].join('\t'))

    const excelClipText = [headers, ...rows].join('\n')

    try {
      await navigator.clipboard.writeText(excelClipText)
      addToast(`Copied ${targets.length} template(s) in Excel format!`, 'success')
    } catch {
      addToast('Failed to copy to clipboard.', 'error')
    }
  }

  // Download Rules for Selected or All Templates
  async function handleDownloadBulk(onlySelected = false) {
    let targets = templates || []
    if (onlySelected) {
      targets = targets.filter((t) => selectedIds.has(t.id))
      if (targets.length === 0) {
        addToast('No templates selected to download.', 'error')
        return
      }
    }

    if (targets.length === 0) {
      addToast('No templates to export.', 'error')
      return
    }

    const XLSX = await import('xlsx')
    const rows = targets.map((t) => ({
      'Template Name': t.templateName,
      'Template Description': t.description || '',
      Title: t.aiRules?.title || '',
      Description: t.aiRules?.description || '',
      Keywords: t.aiRules?.keyword || '',
      Rules: t.aiRules?.otherRules || '',
      'Rule-1': t.aiRules?.rule1 || '',
      'Rule-2': t.aiRules?.rule2 || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows, { header: BULK_COLUMNS })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'AI Rules')
    XLSX.writeFile(wb, onlySelected ? 'selected-ai-rules.xlsx' : 'listing-tools-ai-rules.xlsx')
  }

  async function handleUploadBulk(file) {
    if (!file) return
    setBulkBusy(true)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws)

      const byName = new Map((templates || []).map((t) => [t.templateName.trim().toLowerCase(), t]))
      let updated = 0
      const unmatchedRows = []

      for (const row of rows) {
        const name = String(row['Template Name'] ?? '').trim()
        const match = name ? byName.get(name.toLowerCase()) : null
        if (!match) {
          if (name) unmatchedRows.push(name)
          continue
        }
        const aiRules = {
          title: String(row['Title'] ?? ''),
          description: String(row['Description'] ?? ''),
          keyword: String(row['Keywords'] ?? ''),
          otherRules: String(row['Rules'] ?? ''),
          rule1: String(row['Rule-1'] ?? ''),
          rule2: String(row['Rule-2'] ?? ''),
        }
        const body = { aiRules }
        // Older downloaded sheets won't have this column — only touch the
        // template's own description when the uploaded sheet actually has
        // it, rather than blanking every row out on re-upload.
        if ('Template Description' in row) body.description = String(row['Template Description'] ?? '')
        const res = await fetch(`/api/listing-tools/${match.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          const data = await res.json().catch(() => null)
          if (data?.template) handleUpdated(data.template)
          updated += 1
        }
      }

      if (updated === 0 && unmatchedRows.length === 0) {
        addToast('That sheet had no rows to apply.', 'error')
      } else {
        addToast(
          `Updated AI rules for ${updated} template${updated === 1 ? '' : 's'}` +
            (unmatchedRows.length ? ` — ${unmatchedRows.length} row(s) didn't match any Template Name.` : '.'),
          unmatchedRows.length && updated === 0 ? 'error' : 'success',
        )
      }
    } catch (err) {
      addToast('Could not read that file — is it a valid .xlsx?', 'error')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-surface px-6 py-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-lg font-bold text-foreground">Template Settings</h1>
      </div>
      <p className="text-[13px] text-subtle mb-5">
        Create, edit, and delete your Listing Tools template definitions — groups, headers, dropdown sources, export preset, and AI rules.
      </p>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-card-hover rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-light"
          />
        </div>

        {selectedIds.size > 0 ? (
          <PillButton variant="ghost" icon={Download} onClick={() => handleDownloadBulk(true)}>
            Download Selected Rules ({selectedIds.size})
          </PillButton>
        ) : (
          <PillButton variant="ghost" icon={Download} onClick={() => handleDownloadBulk(false)}>
            Download AI Rules Sheet
          </PillButton>
        )}

        <PillButton
          variant="ghost"
          icon={bulkBusy ? Loader2 : Upload}
          disabled={bulkBusy}
          onClick={() => uploadInputRef.current?.click()}
        >
          {bulkBusy ? 'Applying…' : 'Upload AI Rules Sheet'}
        </PillButton>

        <input
          ref={uploadInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            handleUploadBulk(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        {selectedIds.size > 0 && (
          <PillButton variant="upload" icon={CopyCheck} onClick={handleAiCopyTemplates}>
            AI Copy Template ({selectedIds.size})
          </PillButton>
        )}
        <Link href="/listing-tools/template-settings/new">
          <PillButton variant="upload" icon={Plus}>
            Create Template
          </PillButton>
        </Link>
      </div>

      {/* Table Component */}
      <div className="border border-divider rounded-lg overflow-x-auto bg-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-card border-b border-divider">
              <th className="px-3 py-2.5 text-center w-10">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someFilteredSelected
                  }}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-accent rounded border-divider-light focus:ring-accent cursor-pointer"
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground">Visible</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground">Template #</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground">Template Name</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground">Template Final Name</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground">Description</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground">Rule Title</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground">Rule Description</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground">Keywords</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground">Rules</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground">Rule-1</th>
              <th className="px-3 py-2.5 text-left font-semibold text-foreground">Rule-2</th>
              <th className="px-3 py-2.5 text-right font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates === null && (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-subtle">
                  Loading…
                </td>
              </tr>
            )}
            {templates !== null && filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-subtle">
                  No templates yet — create one to get started.
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <TemplateSettingsRow
                key={t.id}
                template={t}
                isSelected={selectedIds.has(t.id)}
                onToggleSelect={toggleSelectOne}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}