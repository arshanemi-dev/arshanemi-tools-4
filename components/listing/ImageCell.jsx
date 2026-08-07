'use client'
import { useState, useRef, useEffect } from 'react'
import { ImagePlus, X, Loader2, Clock, AlertCircle } from 'lucide-react'
import { useListingImageUpload } from '@/hooks/useListingImageUpload'

function isValidImageUrl(str) {
  try {
    const u = new URL(str)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// Per-cell single-image dropzone — compact enough to sit inline in a grid
// cell (unlike components/admin/ImageUpload.jsx's full-size box). Uploads
// through whichever per-template route the grid passes as `uploadUrl`
// (Dropbox-backed, see app/api/listing-tools/[templateId]/images/route.js)
// so every image for a template lands under the same
// /listing-tools/{company}/{user}/{templateId}/ Dropbox folder as bulk
// drops. useListingImageUpload retries transient failures automatically —
// a permanent failure leaves the cell in an error state, clickable to retry.
//
// Selecting/dropping more than one file here doesn't try to cram them all
// into this one box — it hands the whole file list to `onMultipleFiles`
// (SheetGrid's shared bulk-upload session, same one BulkImageDropZone
// drives), which fills the next empty Image-column boxes row by row across
// the whole sheet. A single file still fills only this cell, as before.
//
// The cell also always shows a plain URL text field under the thumbnail —
// the current value (an uploaded Dropbox URL or a pasted one, indistinguishable
// once stored; this cell only ever holds a URL string either way) is visible
// as text, not just as a thumbnail, and typing/pasting a new absolute
// http(s) URL there sets it directly, no upload involved. Commits on
// blur/Enter, only once it parses as a real URL — an in-progress paste that
// isn't a valid URL yet is never sent upstream, just flagged inline.
//
// `bulkStatus` (optional) is this cell's own upload-status entry from that
// shared session, when a bulk operation elsewhere targeted this exact
// row/box — there's no separate progress bar anywhere; every box shows its
// own queued/uploading/retrying/error state right here as it happens.
export default function ImageCell({ value, onChange, uploadUrl, disabled, onMultipleFiles, bulkStatus }) {
  const [dragging, setDragging] = useState(false)
  const [urlDraft, setUrlDraft] = useState(value || '')
  const [urlInvalid, setUrlInvalid] = useState(false)
  const [imgBroken, setImgBroken] = useState(false)
  const inputRef = useRef(null)
  const { uploads, uploadFiles } = useListingImageUpload(uploadUrl)
  const status = uploads[0] || bulkStatus
  const isQueued = status?.status === 'queued'
  const isBusy = status?.status === 'uploading' || status?.status === 'retrying'
  const isRetrying = status?.status === 'retrying'
  const hasError = status?.status === 'error'

  // Stay in sync with `value` changing from outside this cell (an upload finishing, a bulk fill,
  // the row getting auto-filled/cleared elsewhere) — but not while the user has their own edit
  // in progress and it just doesn't match yet (see the dependency below).
  useEffect(() => {
    setUrlDraft(value || '')
    setUrlInvalid(false)
    setImgBroken(false)
  }, [value])

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0 || !uploadUrl) return
    if (files.length > 1 && onMultipleFiles) {
      onMultipleFiles(files)
      return
    }
    await uploadFiles([files[0]], { onFileDone: (result) => onChange(result.url) })
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function commitUrlDraft() {
    const trimmed = urlDraft.trim()
    if (!trimmed) {
      setUrlInvalid(false)
      if (value) onChange(null)
      return
    }
    if (!isValidImageUrl(trimmed)) {
      setUrlInvalid(true)
      return
    }
    setUrlInvalid(false)
    if (trimmed !== value) onChange(trimmed)
  }

  return (
    <div className="flex flex-col items-center gap-1 w-full min-w-[120px] px-1.5 py-1.5">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled ? undefined : onDrop}
        onClick={() => !disabled && !isBusy && !isQueued && !value && inputRef.current?.click()}
        title={hasError ? `${status.error} — click to retry` : isQueued ? 'Queued…' : isRetrying ? `Retrying (${status.attempt}/3)…` : undefined}
        className={`relative group flex items-center justify-center w-full h-20 flex-shrink-0 rounded border overflow-hidden transition-colors ${
          value ? 'border-gray-200 bg-gray-50' : 'border-dashed'
        } ${
          disabled ? 'opacity-50 cursor-not-allowed border-gray-200' :
          value ? '' :
          hasError ? 'cursor-pointer border-red-300 bg-red-50 hover:border-red-400' :
          'cursor-pointer border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
        } ${dragging ? 'border-indigo-400 bg-indigo-50' : ''}`}
      >
        {value ? (
          imgBroken ? (
            <AlertCircle className="w-3.5 h-3.5 text-red-400" title="Couldn't load this image URL" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" onError={() => setImgBroken(true)} />
          )
        ) : isBusy ? (
          <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
        ) : isQueued ? (
          <Clock className="w-3.5 h-3.5 text-gray-300" />
        ) : hasError ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
        ) : (
          <ImagePlus className="w-3.5 h-3.5 text-gray-400" />
        )}
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            className="absolute top-0 right-0 p-0.5 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
        />
      </div>
      {!disabled && (
        <input
          type="text"
          value={urlDraft}
          onChange={(e) => { setUrlDraft(e.target.value); setUrlInvalid(false) }}
          onBlur={commitUrlDraft}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          placeholder="Paste image URL…"
          title={value || undefined}
          className={`w-full text-[10.5px] px-1.5 py-0.5 border rounded text-gray-500 focus:outline-none focus:ring-1 ${
            urlInvalid ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-indigo-400'
          }`}
        />
      )}
      {urlInvalid && <span className="text-[10px] text-red-500 leading-none">Not a valid URL</span>}
    </div>
  )
}
