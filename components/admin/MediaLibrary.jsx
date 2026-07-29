'use client'
import { useState, useMemo } from 'react'
import {
  Grid3X3, List, Copy, Trash2, Check, FileText,
  Image as ImageIcon, ChevronRight, Loader2,
} from 'lucide-react'
import { useToast } from './Toast'

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isImage(blob) {
  return (blob.contentType || '').startsWith('image/')
}

function CopyBtn({ url }) {
  const [copied, setCopied] = useState(false)
  const { addToast } = useToast()

  async function copy(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      addToast('URL copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('Copy failed', 'error')
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy URL"
      className={`p-1.5 rounded-lg transition-colors ${
        copied
          ? 'bg-green-100 text-green-600'
          : 'bg-surface hover:bg-accent/10 text-subtle hover:text-accent'
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function GridCard({ blob, selected, onToggle, onDelete, onSelect }) {
  const img = isImage(blob)
  return (
    <div
      onClick={() => onSelect ? onSelect(blob) : onToggle(blob.url)}
      className={`relative group rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
        selected ? 'border-accent shadow-md' : 'border-divider hover:border-accent/50'
      }`}
    >
      {/* Thumbnail */}
      <div className="h-28 bg-surface flex items-center justify-center">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={blob.url} alt={blob.filename} className="w-full h-full object-cover" />
        ) : (
          <FileText className="w-8 h-8 text-subtle" />
        )}
      </div>

      {/* Checkbox */}
      {!onSelect && (
        <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
          selected ? 'bg-accent border-accent' : 'border-white/80 bg-white/60 opacity-0 group-hover:opacity-100'
        }`}>
          {selected && <Check className="w-3 h-3 text-white" />}
        </div>
      )}

      {/* Actions overlay */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyBtn url={blob.url} />
        {!onSelect && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete([blob.url]) }}
            title="Delete"
            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-2 py-1.5 bg-card border-t border-divider">
        <p className="text-xs text-muted truncate font-medium">{blob.filename}</p>
        <p className="text-[10px] text-subtle">{formatBytes(blob.size)}</p>
      </div>
    </div>
  )
}

function ListRow({ blob, selected, onToggle, onDelete, onSelect }) {
  const img = isImage(blob)
  return (
    <tr
      onClick={() => onSelect ? onSelect(blob) : onToggle(blob.url)}
      className={`cursor-pointer transition-colors ${
        selected ? 'bg-accent/10' : 'hover:bg-surface'
      }`}
    >
      {!onSelect && (
        <td className="pl-4 py-3 w-10">
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
            selected ? 'bg-accent border-accent' : 'border-divider-light'
          }`}>
            {selected && <Check className="w-2.5 h-2.5 text-white" />}
          </div>
        </td>
      )}
      <td className="py-3 px-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-surface flex-shrink-0 flex items-center justify-center overflow-hidden">
            {img
              ? <img src={blob.url} alt="" className="w-full h-full object-cover" />
              : <FileText className="w-4 h-4 text-subtle" />
            }
          </div>
          <span className="text-sm text-muted font-medium truncate max-w-[180px]">{blob.filename}</span>
        </div>
      </td>
      <td className="py-3 px-3 text-xs text-subtle">{blob.folder}</td>
      <td className="py-3 px-3 text-xs text-subtle">{formatBytes(blob.size)}</td>
      <td className="py-3 px-3 text-xs text-subtle">{formatDate(blob.uploadedAt)}</td>
      <td className="py-3 px-3">
        <span className="text-xs text-subtle font-mono truncate max-w-[140px] block">
          {blob.url.replace(/^https?:\/\/[^/]+\//, '').substring(0, 30)}…
        </span>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <CopyBtn url={blob.url} />
          {!onSelect && (
            <button
              type="button"
              onClick={() => onDelete([blob.url])}
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

const PAGE_SIZE = 24

export default function MediaLibrary({
  blobs = [],
  loading = false,
  onDelete,
  onSelect,       // if provided: picker mode — clicking an item calls onSelect(blob) instead of selecting
}) {
  const { addToast } = useToast()
  const [view, setView] = useState('grid')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState(false)
  const [detail, setDetail] = useState(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return blobs
    return blobs.filter(
      (b) => b.filename.toLowerCase().includes(q) || b.folder.toLowerCase().includes(q)
    )
  }, [blobs, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageBlobs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSelect(url) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === pageBlobs.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pageBlobs.map((b) => b.url)))
    }
  }

  async function handleDelete(urls) {
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/media/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })
      if (!res.ok) throw new Error('Delete failed')
      setSelected(new Set())
      setDetail(null)
      onDelete?.(urls)
      addToast(`Deleted ${urls.length} file${urls.length !== 1 ? 's' : ''}`, 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const allSelected = pageBlobs.length > 0 && selected.size === pageBlobs.length

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-divider bg-card flex-shrink-0">
        <input
          type="text"
          placeholder="Search files…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 text-sm border border-divider-light rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />

        <span className="text-xs text-subtle whitespace-nowrap">
          {filtered.length} file{filtered.length !== 1 ? 's' : ''}
        </span>

        {selected.size > 0 && !onSelect && (
          <button
            type="button"
            onClick={() => handleDelete([...selected])}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete {selected.size}
          </button>
        )}

        <div className="flex border border-divider rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setView('grid')}
            className={`px-2.5 py-1.5 ${view === 'grid' ? 'bg-accent text-white' : 'text-subtle hover:bg-surface'}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`px-2.5 py-1.5 ${view === 'list' ? 'bg-accent text-white' : 'text-subtle hover:bg-surface'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main grid/list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-subtle">
              <ImageIcon className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">{search ? 'No files match your search' : 'No files in this folder'}</p>
            </div>
          ) : view === 'grid' ? (
            <>
              {!onSelect && (
                <div className="flex items-center gap-2 mb-3">
                  <button type="button" onClick={toggleAll} className="text-xs text-accent hover:underline">
                    {allSelected ? 'Deselect all' : 'Select all on page'}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {pageBlobs.map((blob) => (
                  <GridCard
                    key={blob.url}
                    blob={blob}
                    selected={selected.has(blob.url)}
                    onToggle={toggleSelect}
                    onDelete={handleDelete}
                    onSelect={onSelect ? () => onSelect(blob) : null}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="bg-card rounded-xl border border-divider overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-surface border-b border-divider">
                  <tr>
                    {!onSelect && (
                      <th className="pl-4 py-2.5 w-10">
                        <div
                          onClick={toggleAll}
                          className={`w-4 h-4 rounded border-2 cursor-pointer flex items-center justify-center ${
                            allSelected ? 'bg-accent border-accent' : 'border-divider-light'
                          }`}
                        >
                          {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                      </th>
                    )}
                    <th className="py-2.5 px-3 text-xs font-semibold text-subtle uppercase tracking-wide">File</th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-subtle uppercase tracking-wide">Folder</th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-subtle uppercase tracking-wide">Size</th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-subtle uppercase tracking-wide">Date</th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-subtle uppercase tracking-wide">Path</th>
                    <th className="py-2.5 px-3 text-xs font-semibold text-subtle uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {pageBlobs.map((blob) => (
                    <ListRow
                      key={blob.url}
                      blob={blob}
                      selected={selected.has(blob.url)}
                      onToggle={toggleSelect}
                      onDelete={handleDelete}
                      onSelect={onSelect ? () => onSelect(blob) : null}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-divider-light rounded-lg disabled:opacity-40 hover:bg-surface"
              >
                Prev
              </button>
              <span className="text-sm text-subtle">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-divider-light rounded-lg disabled:opacity-40 hover:bg-surface"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Detail panel — only in non-picker grid view */}
        {detail && !onSelect && (
          <div className="w-64 border-l border-divider bg-card flex-shrink-0 overflow-y-auto p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted">File Info</p>
              <button type="button" onClick={() => setDetail(null)} className="text-subtle hover:text-muted text-xs">✕</button>
            </div>
            <div className="rounded-xl overflow-hidden bg-surface flex items-center justify-center h-36">
              {isImage(detail)
                ? <img src={detail.url} alt={detail.filename} className="w-full h-full object-contain" />
                : <FileText className="w-10 h-10 text-subtle" />
              }
            </div>
            <div className="space-y-1.5 text-xs text-muted">
              <p><span className="font-medium">Name:</span> {detail.filename}</p>
              <p><span className="font-medium">Folder:</span> {detail.folder}</p>
              <p><span className="font-medium">Size:</span> {formatBytes(detail.size)}</p>
              <p><span className="font-medium">Uploaded:</span> {formatDate(detail.uploadedAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-subtle mb-1">URL</p>
              <p className="text-[10px] font-mono bg-surface rounded-lg p-2 break-all text-muted leading-relaxed">
                {detail.url}
              </p>
            </div>
            <div className="flex gap-2">
              <CopyBtn url={detail.url} />
              <button
                type="button"
                onClick={() => handleDelete([detail.url])}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
