'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus, Download, Upload, Loader2, CopyCheck, Layers } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import TemplateSettingsListRow from '@/components/listing/TemplateSettingsListRow'
import MarketplaceTabs from '@/components/listing/MarketplaceTabs'
import { useToast } from '@/components/admin/Toast'
import { versionLabelOf } from '@/lib/templateLogActions'
import { buildMarketplaceTabs, marketplaceKeyOf, resolveActiveTab } from '@/lib/marketplaceTabs'

const BULK_COLUMNS = ['Template Name', 'Template Description', 'Title', 'Description', 'Keywords', 'Rules', 'Rule-1', 'Rule-2']

const COLUMNS = [
  'Visible', 'Template #', 'Version', 'Template Name', 'Template Final Name', 'Created', 'Updated', 'Live Date',
  'Description', 'Rule Title', 'Rule Description', 'Keywords', 'Rules', 'Rule-1', 'Rule-2',
]
const COL_COUNT = COLUMNS.length + 2 // + checkbox + actions

const VIEW_MODES = [
  { id: 'all', label: 'All versions' },
  { id: 'latest', label: 'Latest only' },
]

// Main List Page — top-level marketplace tabs (first one selected by
// default; everything below is scoped to the selected marketplace), then
// one row per template VERSION (every version, not just the latest),
// grouped under its template newest-first; see TemplateSettingsListRow for
// which controls live on which row. Versions
// come from the hub in one light call (no header snapshots) alongside the
// templates themselves; if that call fails the page still works, just with
// one "No versions" row per template like before versioning existed.
export default function TemplateSettingsListPage() {
  const { addToast } = useToast()
  const router = useRouter()
  const [templates, setTemplates] = useState(null)
  const [versions, setVersions] = useState(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('all')
  const [marketplaceKey, setMarketplaceKey] = useState(null) // null = default to the first tab
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [liveBusyId, setLiveBusyId] = useState(null)
  const uploadInputRef = useRef(null)

  const loadVersions = useCallback(() => {
    return fetch('/api/listing-tools/versions', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { versions: [] }))
      .then((data) => setVersions(data.versions || []))
      .catch(() => setVersions([]))
  }, [])

  useEffect(() => {
    fetch('/api/listing-tools', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => setTemplates(data.templates || []))
      .catch(() => setTemplates([]))
    loadVersions()
  }, [loadVersions])

  const versionsByTemplate = useMemo(() => {
    const map = new Map()
    for (const v of versions || []) {
      if (!map.has(v.templateId)) map.set(v.templateId, [])
      map.get(v.templateId).push(v)
    }
    for (const list of map.values()) list.sort((a, b) => b.versionNumber - a.versionNumber)
    return map
  }, [versions])

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

  // Mirrors the hub's own rule locally instead of refetching: turning one
  // version ON flips whichever other version of that template was live OFF.
  async function handleToggleLive(template, version) {
    setLiveBusyId(version.id)
    try {
      const res = await fetch(`/api/listing-tools/versions/${version.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          live: !version.isLive,
          templateName: template.templateName,
          marketplaceName: template.marketplaceName || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 401) return
      if (!res.ok || !data?.version) throw new Error(data?.error || 'Could not update the live version')
      const nowLive = data.version.isLive
      const stamp = new Date().toISOString()
      setVersions((prev) =>
        (prev || []).map((v) => {
          if (v.id === version.id) return { ...v, ...data.version, meta: v.meta, updatedAt: stamp }
          if (nowLive && v.templateId === template.id && v.isLive) return { ...v, isLive: false }
          return v
        }),
      )
      addToast(
        nowLive
          ? `${versionLabelOf(version)} is now live for "${template.templateName}".`
          : `${versionLabelOf(version)} of "${template.templateName}" taken offline.`,
        'success',
      )
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLiveBusyId(null)
    }
  }

  const marketplaceTabs = useMemo(() => (templates ? buildMarketplaceTabs(templates) : null), [templates])
  const activeTab = marketplaceTabs ? resolveActiveTab(marketplaceTabs, marketplaceKey) : null
  const tabTemplates = activeTab ? templates.filter((t) => marketplaceKeyOf(t) === activeTab.key) : templates || []

  // Selection never carries across tabs — bulk actions (download, AI copy,
  // Edit Bulk Listing) must only ever act on rows you can actually see.
  function handleSelectTab(key) {
    setMarketplaceKey(key)
    setSelectedIds(new Set())
  }

  const query = search.trim().toLowerCase()
  const filtered = tabTemplates.filter((t) => {
    if (!query) return true
    const haystack = [
      t.templateName, t.description, t.finalName, t.templateNumber,
      ...(versionsByTemplate.get(t.id) || []).map(versionLabelOf),
    ]
    return haystack.some((s) => String(s || '').toLowerCase().includes(query))
  })

  const versionCount = tabTemplates.reduce((n, t) => n + (versionsByTemplate.get(t.id) || []).length, 0)
  const liveCount = tabTemplates.filter((t) => (versionsByTemplate.get(t.id) || []).some((v) => v.isLive)).length

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

  // Download Rules for Selected or All Templates — "all" = every template
  // in the selected marketplace tab.
  async function handleDownloadBulk(onlySelected = false) {
    let targets = tabTemplates
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
    const scope = activeTab ? activeTab.label.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'listing-tools'
    XLSX.writeFile(wb, onlySelected ? 'selected-ai-rules.xlsx' : `${scope}-ai-rules.xlsx`)
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

  const rowProps = {
    onToggleSelect: toggleSelectOne,
    onUpdated: handleUpdated,
    onDeleted: handleDeleted,
    onToggleLive: handleToggleLive,
  }

  return (
    <div className="min-h-full bg-surface px-6 pb-6 pt-3">
      <div className="mb-5">
        <MarketplaceTabs tabs={marketplaceTabs} activeKey={activeTab?.key} onSelect={handleSelectTab} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-1">
        <h1 className="text-lg font-bold text-foreground">
          Template Settings
          {activeTab && <span className="font-semibold text-subtle"> · {activeTab.label}</span>}
        </h1>
        {templates !== null && (
          <p className="text-[12px] text-subtle">
            <span className="font-semibold text-muted">{tabTemplates.length}</span> template{tabTemplates.length === 1 ? '' : 's'}
            {versions !== null && (
              <>
                {' · '}
                <span className="font-semibold text-muted">{versionCount}</span> version{versionCount === 1 ? '' : 's'}
                {' · '}
                <span className="font-semibold text-emerald-600">{liveCount}</span> live
              </>
            )}
          </p>
        )}
      </div>
      <p className="text-[13px] text-subtle mb-5">
        Create, edit, and delete your Listing Tools template definitions — groups, headers, dropdown sources, export preset, and AI rules. Every saved version of a template is listed under it, newest first.
      </p>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab ? `Search ${activeTab.label} templates or versions…` : 'Search templates or versions…'}
            className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-card-hover rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-light"
          />
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-lg bg-card-hover p-1" role="radiogroup" aria-label="Which versions to show">
          {VIEW_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={viewMode === m.id}
              onClick={() => setViewMode(m.id)}
              className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                viewMode === m.id ? 'bg-card text-accent-hover shadow-sm' : 'text-subtle hover:text-muted'
              }`}
            >
              {m.label}
            </button>
          ))}
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
        <Link href="/listing-tools/template-settings/new-bulk">
          <PillButton variant="upload" icon={Layers}>
            Create Bulk Listing
          </PillButton>
        </Link>
        <PillButton
          variant="ghost"
          icon={Layers}
          disabled={selectedIds.size < 2}
          title={selectedIds.size < 2 ? 'Select 2 or more templates below to bulk-edit them' : undefined}
          onClick={() => router.push(`/listing-tools/template-settings/new-bulk?templates=${[...selectedIds].join(',')}`)}
        >
          Edit Bulk Listing
        </PillButton>
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
              {COLUMNS.map((label) => (
                <th key={label} className="px-3 py-2.5 text-left font-semibold text-foreground whitespace-nowrap">
                  {label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates === null && (
              <tr>
                <td colSpan={COL_COUNT} className="px-4 py-10 text-center text-subtle">
                  Loading…
                </td>
              </tr>
            )}
            {templates !== null && filtered.length === 0 && (
              <tr>
                <td colSpan={COL_COUNT} className="px-4 py-10 text-center text-subtle">
                  {query ? 'No templates or versions match your search.' : 'No templates yet — create one to get started.'}
                </td>
              </tr>
            )}
            {filtered.flatMap((t) => {
              const all = versionsByTemplate.get(t.id) || []
              const shown = viewMode === 'latest' ? all.slice(0, 1) : all
              if (shown.length === 0) {
                return [<TemplateSettingsListRow key={t.id} template={t} isSelected={selectedIds.has(t.id)} {...rowProps} />]
              }
              // The head row keeps a stable key so a new version appearing
              // above it doesn't remount it (and drop an in-progress edit).
              return shown.map((v, i) => (
                <TemplateSettingsListRow
                  key={i === 0 ? t.id : v.id}
                  template={t}
                  version={v}
                  isHead={i === 0}
                  isLastInGroup={i === shown.length - 1}
                  isSelected={selectedIds.has(t.id)}
                  liveBusy={liveBusyId === v.id}
                  {...rowProps}
                />
              ))
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
