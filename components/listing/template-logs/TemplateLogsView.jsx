'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Download } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import MarketplaceTabs from '@/components/listing/MarketplaceTabs'
import { useToast } from '@/components/admin/Toast'
import { LOG_CATEGORIES, actionMeta, fmtDate, fmtTime, versionLabelOf } from '@/lib/templateLogActions'
import { buildMarketplaceTabs, marketplaceKeyOf, resolveActiveTab } from '@/lib/marketplaceTabs'
import { SORT_LABELS, describeFilter, filterRows, isFilterActive, sortRows } from '@/lib/gridFilters'
import LogStatTiles from './LogStatTiles'
import LogFilterBar from './LogFilterBar'
import LogGrid from './LogGrid'
import LogDetailDrawer from './LogDetailDrawer'
import { LOG_COLUMNS } from './logColumns'

// Pages of this size (under the hub's 999 cap) until everything in scope is
// in; LOAD_CAP guards against an unbounded pull on a very old, busy log.
const LOAD_PAGE = 900
const LOAD_CAP = 10000
const RENDER_STEP = 200
const DEFAULT_SORT = { key: 'createdAt', dir: 'desc' }

async function getJson(url) {
  const res = await fetch(url, { credentials: 'include' })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function filtersSignature(filters) {
  return Object.entries(filters)
    .map(([k, f]) => `${k}:${f?.values ? [...f.values].join('|') : ''}:${JSON.stringify(f?.condition || null)}`)
    .join(';')
}

// Template Logs (master_admin). Top-level marketplace tabs (first selected
// by default) scope what's loaded; below that the page works like a
// spreadsheet: the marketplace's whole log is pulled in once (paged), then
// every column can be sorted, filtered by condition or by values, and
// searched — all client-side, so sorting and filtering are always over
// every row, never just the loaded page. Template names and version labels
// are joined from the templates list and the light all-versions list; a row
// for something since deleted falls back to what its own detail captured.
export default function TemplateLogsView() {
  const { addToast } = useToast()
  const [marketplaceKey, setMarketplaceKey] = useState(null) // null = default to the first tab
  const [columnFilters, setColumnFilters] = useState({})
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [search, setSearch] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [templates, setTemplates] = useState(null)
  const [templatesFailed, setTemplatesFailed] = useState(false)
  const [versions, setVersions] = useState(null)
  const [feed, setFeed] = useState({ key: null, logs: [], capped: false, error: null })
  const [progress, setProgress] = useState({ key: null, count: 0 })
  const [render, setRender] = useState({ key: null, limit: RENDER_STEP })
  const [openLog, setOpenLog] = useState(null)

  const marketplaceTabs = useMemo(() => (templates ? buildMarketplaceTabs(templates) : null), [templates])
  const activeTab = marketplaceTabs ? resolveActiveTab(marketplaceTabs, marketplaceKey) : null

  // The tab scope as plain strings, so a templates refetch that changes
  // nothing doesn't count as a new scope and reload the log.
  const templatesReady = templates !== null
  const scopeIds = activeTab ? activeTab.templateIds.join(',') : ''
  const scopeMarketplace = activeTab?.marketplace || ''
  const scopeKey = activeTab ? `${activeTab.key}:${scopeIds}` : '*'
  // A stored result remembers which scope it answered, so "loading" is just
  // "the stored result is for a different key" — no synchronous
  // reset-to-loading setState inside the effect.
  const feedKey = `${scopeKey}#${refreshToken}`

  useEffect(() => {
    let cancelled = false
    getJson('/api/listing-tools')
      .then((d) => { if (!cancelled) { setTemplates(d.templates || []); setTemplatesFailed(false) } })
      .catch(() => { if (!cancelled) { setTemplates([]); setTemplatesFailed(true) } })
    getJson('/api/listing-tools/versions')
      .then((d) => { if (!cancelled) setVersions(d.versions || []) })
      .catch(() => { if (!cancelled) setVersions([]) })
    return () => { cancelled = true }
  }, [refreshToken])

  // Waits for the templates list — a marketplace tab IS its templates, so
  // there's no scope to ask the hub for until that's in.
  useEffect(() => {
    if (!templatesReady) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const all = []
        let before = null
        let capped = false
        for (;;) {
          const p = new URLSearchParams({ feed: '1', limit: String(LOAD_PAGE) })
          if (scopeIds) p.set('templateIds', scopeIds)
          if (scopeMarketplace) p.set('marketplace', scopeMarketplace)
          if (before) p.set('before', before)
          const d = await getJson(`/api/listing-tools/logs?${p}`)
          if (cancelled) return
          all.push(...(d.logs || []))
          setProgress({ key: feedKey, count: all.length })
          if (!d.hasMore) break
          if (all.length >= LOAD_CAP) { capped = true; break }
          before = all[all.length - 1].createdAt
        }
        setFeed({ key: feedKey, logs: all, capped, error: null })
      } catch (err) {
        if (!cancelled) setFeed({ key: feedKey, logs: [], capped: false, error: err.message })
      }
    })()
    return () => { cancelled = true }
  }, [feedKey, scopeIds, scopeMarketplace, templatesReady])

  const templatesById = useMemo(() => new Map((templates || []).map((t) => [t.id, t])), [templates])
  const versionsById = useMemo(() => new Map((versions || []).map((v) => [v.id, v])), [versions])

  const rows = useMemo(
    () =>
      feed.logs.map((l) => {
        const t = templatesById.get(l.templateId)
        const v = l.versionId ? versionsById.get(l.versionId) : null
        return {
          ...l,
          templateName: t?.templateName || l.detail?.templateName || 'Unknown template',
          templateNumber: t?.templateNumber || l.detail?.templateNumber || null,
          // Unknown (not "deleted") when the templates list itself failed.
          templateExists: templatesFailed || !!t,
          versionLabel: v ? versionLabelOf(v) : l.detail?.versionLabel || null,
          versionNumber: v?.versionNumber ?? l.detail?.versionNumber ?? null,
          versionIsLive: !!v?.isLive,
          versionExists: !!v,
        }
      }),
    [feed.logs, templatesById, versionsById, templatesFailed],
  )

  const filteredRows = useMemo(() => filterRows(rows, LOG_COLUMNS, columnFilters, search), [rows, columnFilters, search])
  const sortedRows = useMemo(
    () => sortRows(filteredRows, LOG_COLUMNS.find((c) => c.key === sort.key), sort.dir),
    [filteredRows, sort],
  )
  // A column's value checklist offers what every OTHER filter leaves.
  const optionRowsFor = useCallback(
    (key) => filterRows(rows, LOG_COLUMNS, columnFilters, search, key),
    [rows, columnFilters, search],
  )

  const loading = feed.key !== feedKey || templates === null || versions === null
  const loadingLabel = progress.key === feedKey && progress.count > 0
    ? `Loading events… ${progress.count.toLocaleString()} so far`
    : 'Loading events…'

  const viewKey = `${feed.key}|${filtersSignature(columnFilters)}|${sort.key}:${sort.dir}|${search}`
  const renderLimit = render.key === viewKey ? render.limit : RENDER_STEP
  const isFiltered = !!search.trim() || LOG_COLUMNS.some((c) => isFilterActive(c, columnFilters[c.key]))

  const applyFilter = useCallback((key, filter) => {
    setColumnFilters((prev) => {
      const next = { ...prev }
      if (filter) next[key] = filter
      else delete next[key]
      return next
    })
  }, [])
  const closeDrawer = useCallback(() => setOpenLog(null), [])

  function clearAll() {
    setColumnFilters({})
    setSearch('')
  }

  // Column filters are built from one marketplace's values, so they reset
  // on a tab switch; sort and search carry over.
  function handleSelectTab(key) {
    setMarketplaceKey(key)
    setColumnFilters({})
    setOpenLog(null)
  }

  function showBatch(batchId) {
    setOpenLog(null)
    setColumnFilters({ batch: { values: new Set([String(batchId)]), condition: null } })
  }

  // The (hidden) stat tiles: counts over everything loaded, and a click sets
  // the Event column's values filter to that category's events.
  const eventColumn = LOG_COLUMNS.find((c) => c.key === 'event')
  const categoryLabels = (c) => new Set(c.actions.map((a) => actionMeta(a).label))
  const tileCounts = useMemo(
    () => Object.fromEntries(LOG_CATEGORIES.map((c) => [c.id, c.actions ? rows.filter((r) => c.actions.includes(r.action)).length : rows.length])),
    [rows],
  )
  const eventFilter = columnFilters.event
  const activeCategory = !isFilterActive(eventColumn, eventFilter)
    ? 'all'
    : LOG_CATEGORIES.find((c) => {
        if (!c.actions || !eventFilter.values || eventFilter.condition) return false
        const labels = categoryLabels(c)
        return labels.size === eventFilter.values.size && [...labels].every((l) => eventFilter.values.has(l))
      })?.id || null
  function selectCategory(id) {
    const category = LOG_CATEGORIES.find((c) => c.id === id)
    applyFilter('event', category?.actions ? { values: categoryLabels(category), condition: null } : null)
  }

  const chips = LOG_COLUMNS.filter((c) => isFilterActive(c, columnFilters[c.key])).map((c) => ({
    key: c.key,
    label: describeFilter(c, columnFilters[c.key]),
    onClear: () => applyFilter(c.key, null),
  }))
  const sortColumn = LOG_COLUMNS.find((c) => c.key === sort.key)
  const sortChip = sort.key !== DEFAULT_SORT.key || sort.dir !== DEFAULT_SORT.dir
    ? { label: `${sortColumn.label}: ${SORT_LABELS[sortColumn.type][sort.dir].replace(/^Sort /, '')}`, onClear: () => setSort(DEFAULT_SORT) }
    : null

  function exportCsv() {
    if (!sortedRows.length) {
      addToast('Nothing to export — no events in view.', 'error')
      return
    }
    const header = ['Date', 'Time', 'Event', 'Marketplace', 'Template #', 'Template', 'Version', 'Details', 'By', 'Batch ID']
    const lines = [
      header,
      ...sortedRows.map((r) => [
        fmtDate(r.createdAt), fmtTime(r.createdAt), actionMeta(r.action).label, activeTab?.label || '', r.templateNumber || '',
        r.templateName, r.versionLabel || '', r.detail?.summary || '', r.actorName || '', r.batchId,
      ]),
    ].map((row) => row.map(csvCell).join(','))
    const scope = activeTab ? `${activeTab.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-` : ''
    const url = URL.createObjectURL(new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `template-logs-${scope}${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-full bg-surface px-4 pb-6 pt-3 sm:px-6">
      <div className="mb-5">
        <MarketplaceTabs tabs={marketplaceTabs} activeKey={activeTab?.key} onSelect={handleSelectTab} />
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-lg font-bold text-foreground">
            Template Logs
            {activeTab && <span className="font-semibold text-subtle"> · {activeTab.label}</span>}
          </h1>
          <p className="mt-0.5 text-[13px] text-subtle">
            Every change to {activeTab ? `your ${activeTab.label} templates` : 'your templates'} and their versions — saves, go-lives, rule edits, visibility and deletions — with who made it and when.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PillButton variant="ghost" icon={RefreshCw} loading={loading} onClick={() => setRefreshToken((t) => t + 1)}>
            Refresh
          </PillButton>
          <PillButton variant="download" icon={Download} onClick={exportCsv} title="Download the rows currently in view (filtered and sorted) as a CSV">
            Export CSV
          </PillButton>
        </div>
      </div>

      <LogStatTiles counts={loading ? null : tileCounts} active={activeCategory} onSelect={selectCategory} />

      <div className="mb-3">
        <LogFilterBar search={search} onSearch={setSearch} chips={chips} sortChip={sortChip} onClearAll={clearAll} />
      </div>

      {feed.capped && feed.key === feedKey && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[12.5px] text-amber-700">
          Showing the newest {LOAD_CAP.toLocaleString()} events for this marketplace — older ones aren&apos;t loaded.
        </div>
      )}
      {feed.error && feed.key === feedKey && (
        <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-700">
          Couldn&apos;t load the logs — {feed.error}
        </div>
      )}

      <LogGrid
        columns={LOG_COLUMNS}
        rows={sortedRows}
        totalCount={rows.length}
        loading={loading}
        loadingLabel={loadingLabel}
        filters={columnFilters}
        sort={sort}
        onSort={(key, dir) => setSort({ key, dir })}
        onApplyFilter={applyFilter}
        optionRowsFor={optionRowsFor}
        onRowClick={setOpenLog}
        activeRowId={openLog?.id}
        onBatch={showBatch}
        renderLimit={renderLimit}
        onShowMore={(all) => setRender({ key: viewKey, limit: all ? sortedRows.length : renderLimit + RENDER_STEP })}
        isFiltered={isFiltered}
        onClearFilters={clearAll}
      />

      {openLog && <LogDetailDrawer log={openLog} onClose={closeDrawer} onBatch={showBatch} />}
    </div>
  )
}
