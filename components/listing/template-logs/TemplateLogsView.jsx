'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Download } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import MarketplaceTabs from '@/components/listing/MarketplaceTabs'
import { useToast } from '@/components/admin/Toast'
import { LOG_CATEGORIES, actionMeta, fmtDate, fmtTime, versionLabelOf } from '@/lib/templateLogActions'
import { buildMarketplaceTabs, marketplaceKeyOf, resolveActiveTab } from '@/lib/marketplaceTabs'
import LogStatTiles from './LogStatTiles'
import LogFilterBar, { RANGES } from './LogFilterBar'
import LogFeed from './LogFeed'
import LogDetailDrawer from './LogDetailDrawer'

const PAGE_SIZE = 50
const DEFAULT_FILTERS = { range: 'all', category: 'all', templateId: '', batchId: null }

// Query string for the hub's GET /api/listing-tools/logs?feed=1. `scopeIds`
// / `scopeMarketplace` = the active marketplace tab (its templates' ids, and
// its name for since-deleted templates' rows). The stats request only ever
// carries range + template + marketplace: the tiles are the action filter,
// so their counts must not shrink when one is selected.
function buildQuery(filters, { scopeIds, scopeMarketplace, before, stats } = {}) {
  const p = new URLSearchParams({ feed: '1', limit: String(stats ? 1 : PAGE_SIZE) })
  const range = RANGES.find((r) => r.id === filters.range)
  if (range?.ms) p.set('since', new Date(Date.now() - range.ms).toISOString())
  if (filters.templateId) p.set('templateId', filters.templateId)
  if (scopeIds) p.set('templateIds', scopeIds)
  if (scopeMarketplace) p.set('marketplace', scopeMarketplace)
  if (stats) {
    p.set('stats', '1')
    return p.toString()
  }
  const category = LOG_CATEGORIES.find((c) => c.id === filters.category)
  if (category?.actions) p.set('actions', category.actions.join(','))
  if (filters.batchId) p.set('batchId', String(filters.batchId))
  if (before) p.set('before', before)
  return p.toString()
}

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

// Template Logs (master_admin) — top-level marketplace tabs (first one
// selected by default; the whole page below is scoped to it), then that
// marketplace's audit trail: stat tiles that double as the event-type
// filter, date range / template / batch filters (server-side), instant
// search over what's loaded, a day-grouped feed, and a detail drawer per
// event. Template names and version labels are joined client-side from the
// templates list and the light all-versions list; a log row for something
// since deleted falls back to the name captured in its own detail.
export default function TemplateLogsView() {
  const { addToast } = useToast()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [marketplaceKey, setMarketplaceKey] = useState(null) // null = default to the first tab
  const [search, setSearch] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [templates, setTemplates] = useState(null)
  const [templatesFailed, setTemplatesFailed] = useState(false)
  const [versions, setVersions] = useState(null)
  const [feed, setFeed] = useState({ key: null, logs: [], hasMore: false, error: null })
  const [stats, setStats] = useState({ key: null, data: null })
  const [loadingMore, setLoadingMore] = useState(false)
  const [openLog, setOpenLog] = useState(null)

  const marketplaceTabs = useMemo(() => (templates ? buildMarketplaceTabs(templates) : null), [templates])
  const activeTab = marketplaceTabs ? resolveActiveTab(marketplaceTabs, marketplaceKey) : null
  const tabTemplates = useMemo(
    () => (activeTab ? (templates || []).filter((t) => marketplaceKeyOf(t) === activeTab.key) : templates || []),
    [templates, activeTab],
  )

  // The tab scope as plain strings, so a templates refetch that changes
  // nothing doesn't count as a new scope and refetch the feed again.
  const templatesReady = templates !== null
  const scopeIds = activeTab ? activeTab.templateIds.join(',') : ''
  const scopeMarketplace = activeTab?.marketplace || ''
  const scopeKey = activeTab ? `${activeTab.key}:${scopeIds}` : '*'

  // Each fetch result remembers which filter set it answered, so "loading"
  // is just "the stored result is for a different key" — no synchronous
  // reset-to-loading setState inside the effects.
  const feedKey = `${scopeKey}|${JSON.stringify(filters)}#${refreshToken}`
  const statsKey = `${scopeKey}|${filters.range}|${filters.templateId}#${refreshToken}`
  const { range, templateId } = filters

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
    getJson(`/api/listing-tools/logs?${buildQuery(filters, { scopeIds, scopeMarketplace })}`)
      .then((d) => { if (!cancelled) setFeed({ key: feedKey, logs: d.logs || [], hasMore: !!d.hasMore, error: null }) })
      .catch((err) => { if (!cancelled) setFeed({ key: feedKey, logs: [], hasMore: false, error: err.message }) })
    return () => { cancelled = true }
  }, [filters, feedKey, scopeIds, scopeMarketplace, templatesReady])

  useEffect(() => {
    if (!templatesReady) return undefined
    let cancelled = false
    getJson(`/api/listing-tools/logs?${buildQuery({ range, templateId }, { scopeIds, scopeMarketplace, stats: true })}`)
      .then((d) => { if (!cancelled) setStats({ key: statsKey, data: d.stats || null }) })
      .catch(() => { if (!cancelled) setStats({ key: statsKey, data: null }) })
    return () => { cancelled = true }
  }, [range, templateId, statsKey, scopeIds, scopeMarketplace, templatesReady])

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
          versionIsLive: !!v?.isLive,
          versionExists: !!v,
        }
      }),
    [feed.logs, templatesById, versionsById, templatesFailed],
  )

  const query = search.trim().toLowerCase()
  const visibleRows = query
    ? rows.filter((r) =>
        [r.templateName, r.templateNumber, r.versionLabel, r.actorName, r.detail?.summary, actionMeta(r.action).label, r.batchId]
          .some((s) => String(s ?? '').toLowerCase().includes(query)),
      )
    : rows

  const loading = feed.key !== feedKey || templates === null || versions === null
  const counts =
    stats.key !== statsKey
      ? null
      : Object.fromEntries(
          LOG_CATEGORIES.map((c) => [
            c.id,
            !stats.data ? '—' : c.actions ? c.actions.reduce((n, a) => n + (stats.data.byAction?.[a] || 0), 0) : stats.data.total,
          ]),
        )
  const isFiltered = filters.range !== 'all' || filters.category !== 'all' || !!filters.templateId || !!filters.batchId || !!query

  const updateFilters = useCallback((patch) => setFilters((f) => ({ ...f, ...patch })), [])
  const closeDrawer = useCallback(() => setOpenLog(null), [])

  // A picked template or batch belongs to one marketplace — both reset on a
  // tab switch; range / event type / search carry over.
  function handleSelectTab(key) {
    setMarketplaceKey(key)
    setOpenLog(null)
    updateFilters({ templateId: '', batchId: null })
  }

  function showBatch(batchId) {
    setOpenLog(null)
    updateFilters({ batchId, category: 'all' })
  }

  function clearFilters() {
    setFilters((f) => ({ ...DEFAULT_FILTERS, range: f.range }))
    setSearch('')
  }

  async function loadMore() {
    const last = feed.logs[feed.logs.length - 1]
    if (!last) return
    const key = feedKey
    setLoadingMore(true)
    try {
      const d = await getJson(`/api/listing-tools/logs?${buildQuery(filters, { scopeIds, scopeMarketplace, before: last.createdAt })}`)
      setFeed((prev) => (prev.key === key ? { ...prev, logs: [...prev.logs, ...(d.logs || [])], hasMore: !!d.hasMore } : prev))
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoadingMore(false)
    }
  }

  function exportCsv() {
    if (!visibleRows.length) {
      addToast('Nothing to export — no events in view.', 'error')
      return
    }
    const header = ['Date', 'Time', 'Event', 'Marketplace', 'Template #', 'Template', 'Version', 'Details', 'By', 'Batch ID']
    const lines = [
      header,
      ...visibleRows.map((r) => [
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

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
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
          <PillButton variant="download" icon={Download} onClick={exportCsv} title="Download the events currently in view as a CSV">
            Export CSV
          </PillButton>
        </div>
      </div>

      <LogStatTiles counts={counts} active={filters.category} onSelect={(category) => updateFilters({ category })} />

      <div className="mt-5">
        <LogFilterBar
          filters={filters}
          onChange={updateFilters}
          templates={tabTemplates}
          search={search}
          onSearch={setSearch}
          onClearAll={clearFilters}
        />
      </div>

      {feed.error && feed.key === feedKey && (
        <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-700">
          Couldn&apos;t load the logs — {feed.error}
        </div>
      )}

      <div className="mb-2 mt-4 flex items-center justify-between text-[12px] text-subtle">
        <span>
          {loading ? 'Loading events…' : (
            <>
              Showing <span className="font-semibold text-muted">{visibleRows.length}</span>
              {query && rows.length !== visibleRows.length ? ` of ${rows.length} loaded` : ''} event{visibleRows.length === 1 ? '' : 's'}
              {feed.hasMore ? ' · older events available below' : ''}
            </>
          )}
        </span>
      </div>

      <LogFeed
        rows={visibleRows}
        loading={loading}
        hasMore={feed.hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        onOpen={setOpenLog}
        onBatch={showBatch}
        filtered={isFiltered}
        onClearFilters={() => { clearFilters(); updateFilters({ range: 'all' }) }}
      />

      {openLog && <LogDetailDrawer log={openLog} onClose={closeDrawer} onBatch={showBatch} />}
    </div>
  )
}
