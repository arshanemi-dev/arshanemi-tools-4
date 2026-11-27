'use client'
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/components/admin/Toast'
import DataTable, { TH } from './DataTable'
import useTableView from './useTableView'
import { actionMeta, fmtDate, fmtDateTime, fmtTime } from '@/lib/templateLogActions'

const time = (iso) => (iso ? new Date(iso).getTime() : null)
const NO_ROWS = []

// Both tables in tools-5's table (DataTable): every column sorts and filters
// from its header, on what the cell shows; dates sort by the real time.
const VERSION_COLUMNS = [
  { key: 'label', label: 'Version Number', text: (v) => v.label || `V${v.versionNumber}`, sortValue: (v) => v.versionNumber ?? null },
  { key: 'created', label: 'Create date', text: (v) => (v.createdAt ? fmtDate(v.createdAt) : ''), sortValue: (v) => time(v.createdAt) },
  { key: 'updated', label: 'Updated date', text: (v) => (v.updatedAt ? fmtDate(v.updatedAt) : ''), sortValue: (v) => time(v.updatedAt) },
  { key: 'liveAt', label: 'Live date', text: (v) => (v.liveAt ? fmtDate(v.liveAt) : ''), sortValue: (v) => time(v.liveAt) },
  { key: 'live', label: 'Live', text: (v) => (v.isLive ? 'Live' : 'Off') },
]

// The Version Page + Log tab — a version row per save (the hub's
// createListingTemplateVersion, called from the bulk mapping page's Save
// flow via /api/listing-tools/versions), a single on/off "live" toggle per
// template (not tools-5's draft/sub-version model — see the migration's own
// comment on why this is deliberately simpler), and an append-only log with
// a Batch ID column so one bulk operation shows as one batch. "Edit" and
// "Rename" both open the same rename dialog — a version's only editable
// field is its label, so there's no separate richer "Edit" behavior to
// build yet. Fields here are camelCase (the hub's lib/db.js converts every
// row before returning it — see templateVersionRowToItem/templateLogRowToItem).
export default function TemplateVersionsView({ templateId, templateName, marketplaceName }) {
  const { addToast } = useToast()
  const [versions, setVersions] = useState(null)
  const [logs, setLogs] = useState(null)
  const [versionSearch, setVersionSearch] = useState('')
  const [logSearch, setLogSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const reload = () => setRefreshToken((t) => t + 1)

  useEffect(() => {
    fetch(`/api/listing-tools/versions?templateId=${encodeURIComponent(templateId)}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { versions: [] }))
      .then((data) => setVersions(data.versions || []))
      .catch(() => setVersions([]))
    fetch(`/api/listing-tools/logs?templateId=${encodeURIComponent(templateId)}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { logs: [] }))
      .then((data) => setLogs(data.logs || []))
      .catch(() => setLogs([]))
  }, [templateId, refreshToken])

  const versionLabelById = useMemo(() => {
    const map = new Map()
    for (const v of versions || []) map.set(v.id, v.label || `V${v.versionNumber}`)
    return map
  }, [versions])

  const filteredVersions = useMemo(
    () => (versions || NO_ROWS).filter((v) => (v.label || '').toLowerCase().includes(versionSearch.toLowerCase())),
    [versions, versionSearch],
  )
  const filteredLogs = useMemo(() => (logs || NO_ROWS).filter((l) => {
    if (!logSearch.trim()) return true
    const q = logSearch.toLowerCase()
    const versionLabel = versionLabelById.get(l.versionId) || l.detail?.versionLabel || ''
    return [actionMeta(l.action).label, l.detail?.summary, versionLabel, l.actorName]
      .some((s) => String(s || '').toLowerCase().includes(q))
  }), [logs, logSearch, versionLabelById])

  const logColumns = useMemo(() => [
    { key: 'version', label: 'Version Number', text: (l) => versionLabelById.get(l.versionId) || l.detail?.versionLabel || '' },
    { key: 'action', label: 'Action', text: (l) => actionMeta(l.action).label },
    { key: 'details', label: 'Details', text: (l) => l.detail?.summary || '' },
    { key: 'date', label: 'Log Date', text: (l) => (l.createdAt ? fmtDate(l.createdAt) : ''), sortValue: (l) => time(l.createdAt) },
    { key: 'time', label: 'Time', text: (l) => (l.createdAt ? fmtTime(l.createdAt) : '') },
    { key: 'batch', label: 'Batch ID', text: (l) => (l.batchId == null ? '' : String(l.batchId)), sortValue: (l) => l.batchId ?? null, numeric: true },
  ], [versionLabelById])
  const versionTable = useTableView(filteredVersions, VERSION_COLUMNS)
  const logTable = useTableView(filteredLogs, logColumns)

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleToggleLive(version) {
    setBusy(true)
    try {
      const res = await fetch(`/api/listing-tools/versions/${version.id}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, templateName, marketplaceName, live: !version.isLive }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to update')
      reload()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleRename() {
    if (selectedIds.size !== 1) return
    const id = [...selectedIds][0]
    const current = (versions || []).find((v) => v.id === id)
    const label = window.prompt('Rename this version:', current?.label || '')
    if (!label?.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/listing-tools/versions/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), templateId, templateName, marketplaceName }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Rename failed')
      addToast('Version renamed.', 'success')
      reload()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Delete ${selectedIds.size} version(s)? This can't be undone.`)) return
    setBusy(true)
    try {
      for (const id of selectedIds) {
        const qs = new URLSearchParams({ templateId, ...(templateName ? { templateName } : {}), ...(marketplaceName ? { marketplaceName } : {}) })
        const res = await fetch(`/api/listing-tools/versions/${id}?${qs}`, { method: 'DELETE' })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Delete failed')
      }
      addToast('Version(s) deleted.', 'success')
      setSelectedIds(new Set())
      reload()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (versions === null || logs === null) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Version Page */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-foreground">Version Page</h2>
          <div className="relative ml-auto max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-subtle" />
            <input
              value={versionSearch}
              onChange={(e) => setVersionSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-divider bg-card pl-8 pr-3 py-1.5 text-[12.5px] outline-none focus:border-accent-light"
            />
          </div>
          <button
            type="button"
            onClick={handleRename}
            disabled={selectedIds.size !== 1 || busy}
            className="flex items-center gap-1.5 rounded-full border border-divider px-3 py-1.5 text-[12.5px] font-medium text-foreground disabled:opacity-40"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={handleRename}
            disabled={selectedIds.size !== 1 || busy}
            className="flex items-center gap-1.5 rounded-full border border-divider px-3 py-1.5 text-[12.5px] font-medium text-foreground disabled:opacity-40"
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={selectedIds.size === 0 || busy}
            className="flex items-center gap-1.5 rounded-full border border-[#e59a9a] px-3 py-1.5 text-[12.5px] font-medium text-[#d14343] disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
        <DataTable
          table={versionTable}
          columns={VERSION_COLUMNS}
          lead={<th className={`${TH} w-10`} aria-label="Select" />}
          colSpan={VERSION_COLUMNS.length + 1}
          empty={versionSearch.trim() ? 'No versions match your search.' : 'No versions yet — save this template to create one.'}
          noMatch="No versions match the search or filters."
          noun="version"
          summaryExtra={selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
        >
                {versionTable.pageRows.map((v) => (
                  <tr key={v.id} data-selected={selectedIds.has(v.id)}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selectedIds.has(v.id)} onChange={() => toggleSelect(v.id)} className="h-4 w-4 accent-[var(--color-action)]" aria-label={`Select ${v.label || `V${v.versionNumber}`}`} />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground">{v.label || `V${v.versionNumber}`}</td>
                    <td className="px-3 py-2.5 text-subtle" title={fmtDateTime(v.createdAt)}>{fmtDate(v.createdAt)}</td>
                    <td className="px-3 py-2.5 text-subtle" title={fmtDateTime(v.updatedAt)}>{fmtDate(v.updatedAt)}</td>
                    <td className="px-3 py-2.5 text-subtle" title={v.liveAt ? `Last went live ${fmtDateTime(v.liveAt)}` : 'Never been live'}>{fmtDate(v.liveAt)}</td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!!v.isLive}
                        onClick={() => handleToggleLive(v)}
                        disabled={busy}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-70 ${v.isLive ? 'bg-emerald-500' : 'bg-divider-light'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-card shadow-sm transition-transform ${v.isLive ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
        </DataTable>
      </div>

      {/* Log */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-foreground">Log</h2>
          <div className="relative ml-auto max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-subtle" />
            <input
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-divider bg-card pl-8 pr-3 py-1.5 text-[12.5px] outline-none focus:border-accent-light"
            />
          </div>
        </div>
        <DataTable
          table={logTable}
          columns={logColumns}
          empty={logSearch.trim() ? 'No activity matches your search.' : 'No activity logged yet.'}
          noMatch="No activity matches the search or filters."
          noun="event"
        >
                {logTable.pageRows.map((l) => {
                  const meta = actionMeta(l.action)
                  const Icon = meta.icon
                  return (
                  <tr key={l.id}>
                    <td className="px-3 py-2.5 text-foreground">{versionLabelById.get(l.versionId) || l.detail?.versionLabel || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${meta.chip}`}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted max-w-[320px]">
                      <span className="block truncate" title={l.detail?.summary || ''}>{l.detail?.summary || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-subtle">{fmtDate(l.createdAt)}</td>
                    <td className="px-3 py-2.5 text-subtle">{fmtTime(l.createdAt)}</td>
                    <td className="px-3 py-2.5 font-mono text-subtle">{l.batchId}</td>
                  </tr>
                  )
                })}
        </DataTable>
      </div>
    </div>
  )
}
