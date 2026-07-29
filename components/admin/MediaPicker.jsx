'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  X, FolderOpen, Upload, Loader2,
  ChevronRight, Images, Folder, FolderPlus, Trash2, Check,
} from 'lucide-react'
import MediaLibrary from './MediaLibrary'
import { useToast } from './Toast'

// ─── Same tree builder as media page (pure fn) ────────────────────────────────

function buildTree(blobs) {
  const root = new Map()

  function ensureNode(parts, parentMap, parentPath = '') {
    const name = parts[0]
    const fullPath = parentPath ? `${parentPath}/${name}` : name
    if (!parentMap.has(name)) {
      parentMap.set(name, { name, path: fullPath, count: 0, children: new Map() })
    }
    const node = parentMap.get(name)
    node.count++
    if (parts.length > 1) ensureNode(parts.slice(1), node.children, fullPath)
  }

  for (const b of blobs) {
    if (!b.folder) continue
    const parts = b.folder.split('/')
    // increment each ancestor
    let cur = root
    let curPath = ''
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      curPath = curPath ? `${curPath}/${name}` : name
      if (!cur.has(name)) cur.set(name, { name, path: curPath, count: 0, children: new Map() })
      if (!b.isPlaceholder) cur.get(name).count++
      cur = cur.get(name).children
    }
  }

  function toArray(map) {
    return [...map.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => ({ ...n, children: toArray(n.children) }))
  }
  return toArray(root)
}

// ─── Recursive TreeNode ───────────────────────────────────────────────────────

function TreeNode({ node, depth, expanded, activeFolder, onToggle, onSelect }) {
  const isExpanded = expanded.has(node.path)
  const isActive = activeFolder === node.path
  const isAncestor = activeFolder.startsWith(node.path + '/')
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className={`group flex items-center transition-colors ${isActive ? 'bg-accent/10' : isAncestor ? 'bg-accent/5' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          className={`flex-shrink-0 w-6 h-8 flex items-center justify-center ${hasChildren ? 'text-subtle hover:text-muted' : 'text-transparent pointer-events-none'}`}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
        </button>

        <button
          type="button"
          onClick={() => {
            onSelect(node.path)
            if (hasChildren && !isExpanded) onToggle(node.path)
          }}
          className={`flex-1 flex items-center gap-2 py-1.5 pr-2 text-[13px] min-w-0 transition-colors ${
            isActive ? 'text-accent-hover font-semibold' : 'text-muted hover:text-foreground'
          }`}
        >
          {isActive || isExpanded
            ? <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-accent' : 'text-amber-400'}`} />
            : <Folder className={`w-4 h-4 flex-shrink-0 ${isAncestor ? 'text-amber-400' : 'text-subtle'}`} />
          }
          <span className="flex-1 truncate">{node.name}</span>
          <span className={`text-[11px] flex-shrink-0 ${isActive ? 'text-accent' : 'text-subtle'}`}>{node.count}</span>
        </button>
      </div>

      {isExpanded && hasChildren && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 border-l border-divider"
            style={{ left: `${depth * 14 + 14}px` }}
          />
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              activeFolder={activeFolder}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MediaPicker ─────────────────────────────────────────────────────────────

export default function MediaPicker({ open, onClose, onSelect }) {
  const { addToast } = useToast()

  const [allBlobs, setAllBlobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeFolder, setActiveFolder] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [tab, setTab] = useState('library')

  const [uploading, setUploading] = useState(false)
  const [addingUnder, setAddingUnder] = useState(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  const fileInputRef = useRef(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/media')
      const data = await res.json()
      const blobs = data.blobs || []
      setAllBlobs(blobs)
      const topLevel = [...new Set(blobs.map((b) => b.folder?.split('/')[0]).filter(Boolean))]
      setExpanded(new Set(topLevel))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) { loadAll(); setTab('library'); setActiveFolder('') }
  }, [open, loadAll])

  const tree = useMemo(() => buildTree(allBlobs), [allBlobs])

  const visibleBlobs = useMemo(() => {
    const base = activeFolder
      ? allBlobs.filter((b) => b.folder === activeFolder || b.folder.startsWith(activeFolder + '/'))
      : allBlobs
    return base.filter((b) => !b.isPlaceholder)
  }, [allBlobs, activeFolder])

  function toggle(path) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  function handleSelect(blob) { onSelect(blob.url); onClose() }
  function handleDeleted(urls) { setAllBlobs((prev) => prev.filter((b) => !urls.includes(b.url))) }

  const uploadDest = activeFolder.startsWith('arshanemi-media/')
    ? activeFolder.replace('arshanemi-media/', '')
    : 'general'

  async function handleUpload(files) {
    if (!files.length) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('folder', uploadDest)
      for (const f of files) fd.append('files', f)
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setAllBlobs((prev) => [...data.uploaded, ...prev])
      addToast(`Uploaded ${data.uploaded.length} file${data.uploaded.length !== 1 ? 's' : ''}`, 'success')
      setTab('library')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  function startAdding(path) {
    setAddingUnder(path)
    setNewFolderName('')
    setExpanded((prev) => new Set([...prev, path]))
  }

  function cancelAdding() { setAddingUnder(null); setNewFolderName('') }

  async function createFolder() {
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    try {
      const res = await fetch('/api/admin/media/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), parentPath: addingUnder || 'arshanemi-media' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setAddingUnder(null)
      setNewFolderName('')
      addToast(`Folder "${data.folder.name}" created`, 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setCreatingFolder(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-5xl h-[82vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-divider flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Media Library</h2>
            <p className="text-xs text-subtle mt-0.5">Click any file to insert its URL</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex border border-divider rounded-lg overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setTab('library')}
                className={`px-3 py-1.5 transition-colors ${tab === 'library' ? 'bg-accent text-white' : 'text-muted hover:bg-surface'}`}
              >Library</button>
              <button
                type="button"
                onClick={() => setTab('upload')}
                className={`px-3 py-1.5 transition-colors ${tab === 'upload' ? 'bg-accent text-white' : 'text-muted hover:bg-surface'}`}
              >Upload</button>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-subtle hover:text-muted hover:bg-surface">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar */}
          <div className="w-52 border-r border-divider bg-surface flex-shrink-0 flex flex-col overflow-hidden">
            <nav className="flex-1 overflow-y-auto pt-2 pb-2
              [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent
              [&::-webkit-scrollbar-thumb]:bg-divider-light [&::-webkit-scrollbar-thumb]:rounded-full">

              {/* All Media */}
              <button
                type="button"
                onClick={() => setActiveFolder('')}
                className={`w-full flex items-center gap-2 px-3 py-2 mx-1 rounded-lg text-sm transition-colors ${
                  activeFolder === '' ? 'bg-accent/10 text-accent-hover font-semibold' : 'text-muted hover:bg-surface'
                }`}
              >
                <Images className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">All Media</span>
                <span className="text-[11px] text-subtle">{allBlobs.length}</span>
              </button>

              {/* Tree */}
              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-4 h-4 text-subtle animate-spin" />
                </div>
              ) : (
                tree.map((node) => (
                  <PickerTreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    activeFolder={activeFolder}
                    addingUnder={addingUnder}
                    newFolderName={newFolderName}
                    creatingFolder={creatingFolder}
                    onToggle={toggle}
                    onSelect={setActiveFolder}
                    onAdd={startAdding}
                    onNewFolderNameChange={setNewFolderName}
                    onCreateFolder={createFolder}
                    onCancelAdding={cancelAdding}
                  />
                ))
              )}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {tab === 'library' ? (
              <MediaLibrary blobs={visibleBlobs} loading={loading} onDelete={handleDeleted} onSelect={handleSelect} />
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 p-8">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleUpload([...e.dataTransfer.files]) }}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-sm border-2 border-dashed border-divider-light hover:border-accent rounded-2xl flex flex-col items-center justify-center py-14 cursor-pointer transition-colors hover:bg-accent/5"
                >
                  {uploading ? (
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                        <Upload className="w-7 h-7 text-accent" />
                      </div>
                      <p className="text-sm font-medium text-muted">Drop files or click to browse</p>
                      <p className="text-xs text-subtle mt-1.5">PNG, JPG, WEBP, SVG — up to 10MB</p>
                      <p className="text-xs text-accent mt-1.5">→ <strong>arshanemi-media/{uploadDest}</strong></p>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
                  onChange={(e) => { handleUpload([...e.target.files]); e.target.value = '' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PickerTreeNode — same tree but no delete, add only ───────────────────────

function PickerTreeNode({
  node, depth, expanded, activeFolder,
  addingUnder, newFolderName, creatingFolder,
  onToggle, onSelect, onAdd,
  onNewFolderNameChange, onCreateFolder, onCancelAdding,
}) {
  const isExpanded   = expanded.has(node.path)
  const isActive     = activeFolder === node.path
  const isAncestor   = activeFolder.startsWith(node.path + '/')
  const hasChildren  = node.children.length > 0
  const isAddingHere = addingUnder === node.path
  const indent       = depth * 14 + 4

  return (
    <div>
      <div
        className={`group flex items-center transition-colors ${
          isActive ? 'bg-accent/10' : isAncestor ? 'bg-accent/5' : 'hover:bg-surface'
        }`}
        style={{ paddingLeft: `${indent}px` }}
      >
        {/* Chevron */}
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          className={`flex-shrink-0 w-6 h-8 flex items-center justify-center ${
            hasChildren || isAddingHere ? 'text-subtle hover:text-muted' : 'text-transparent pointer-events-none'
          }`}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded || isAddingHere ? 'rotate-90' : ''}`} />
        </button>

        {/* Icon + Name */}
        <button
          type="button"
          onClick={() => {
            onSelect(node.path)
            if ((hasChildren || isAddingHere) && !isExpanded) onToggle(node.path)
          }}
          className={`flex-1 flex items-center gap-2 py-1.5 text-[13px] min-w-0 transition-colors ${
            isActive ? 'text-accent-hover font-semibold' : 'text-muted'
          }`}
        >
          {isActive || isExpanded || isAddingHere
            ? <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-accent' : 'text-amber-400'}`} />
            : <Folder    className={`w-4 h-4 flex-shrink-0 ${isAncestor ? 'text-amber-400' : 'text-subtle'}`} />
          }
          <span className="flex-1 truncate">{node.name}</span>
          <span className={`text-[11px] flex-shrink-0 ${isActive ? 'text-accent' : 'text-subtle'}`}>{node.count}</span>
        </button>

        {/* Add icon only */}
        <button
          type="button"
          title="Add folder"
          onClick={(e) => { e.stopPropagation(); onAdd(node.path) }}
          className="flex-shrink-0 mr-1.5 p-1 rounded text-transparent group-hover:text-subtle hover:!text-accent hover:bg-accent/10 transition-all opacity-0 group-hover:opacity-100"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Children + inline-add */}
      {(isExpanded || isAddingHere) && (
        <div className="relative">
          <div className="absolute top-0 bottom-0 border-l border-divider" style={{ left: `${indent + 14}px` }} />
          {hasChildren && node.children.map((child) => (
            <PickerTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              activeFolder={activeFolder}
              addingUnder={addingUnder}
              newFolderName={newFolderName}
              creatingFolder={creatingFolder}
              onToggle={onToggle}
              onSelect={onSelect}
              onAdd={onAdd}
              onNewFolderNameChange={onNewFolderNameChange}
              onCreateFolder={onCreateFolder}
              onCancelAdding={onCancelAdding}
            />
          ))}
          {isAddingHere && (
            <div
              className="flex items-center gap-1 py-1 pr-2"
              style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
            >
              <FolderPlus className="w-3.5 h-3.5 text-accent flex-shrink-0" />
              <input
                autoFocus
                type="text"
                value={newFolderName}
                onChange={(e) => onNewFolderNameChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onCreateFolder(); if (e.key === 'Escape') onCancelAdding() }}
                placeholder="Folder name…"
                className="flex-1 text-xs border border-accent/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent min-w-0"
              />
              <button type="button" onClick={onCreateFolder} disabled={creatingFolder || !newFolderName.trim()}
                className="flex-shrink-0 p-1 rounded text-accent hover:bg-accent/10 disabled:opacity-40">
                {creatingFolder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={onCancelAdding}
                className="flex-shrink-0 p-1 rounded text-subtle hover:bg-surface hover:text-muted">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
