'use client'
import { useState, useRef } from 'react'
import { ImagePlus, X, Loader2, Clock, AlertCircle } from 'lucide-react'
import { useListingImageUpload } from '@/hooks/useListingImageUpload'

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
// `bulkStatus` (optional) is this cell's own upload-status entry from that
// shared session, when a bulk operation elsewhere targeted this exact
// row/box — there's no separate progress bar anywhere; every box shows its
// own queued/uploading/retrying/error state right here as it happens.
export default function ImageCell({ value, onChange, uploadUrl, disabled, onMultipleFiles, bulkStatus }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const { uploads, uploadFiles } = useListingImageUpload(uploadUrl)
  const status = uploads[0] || bulkStatus
  const isQueued = status?.status === 'queued'
  const isBusy = status?.status === 'uploading' || status?.status === 'retrying'
  const isRetrying = status?.status === 'retrying'
  const hasError = status?.status === 'error'

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

  if (value) {
    return (
      <div className="relative group w-14 h-11 mx-auto my-1 rounded overflow-hidden border border-gray-200 bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="" className="w-full h-full object-cover" />
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-0 right-0 p-0.5 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={disabled ? undefined : onDrop}
      onClick={() => !disabled && !isBusy && !isQueued && inputRef.current?.click()}
      title={hasError ? `${status.error} — click to retry` : isQueued ? 'Queued…' : isRetrying ? `Retrying (${status.attempt}/3)…` : undefined}
      className={`flex items-center justify-center w-14 h-11 mx-auto my-1 rounded border border-dashed transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed border-gray-200' :
        hasError ? 'cursor-pointer border-red-300 bg-red-50 hover:border-red-400' :
        'cursor-pointer border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
      } ${dragging ? 'border-indigo-400 bg-indigo-50' : ''}`}
    >
      {isBusy ? (
        <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
      ) : isQueued ? (
        <Clock className="w-3.5 h-3.5 text-gray-300" />
      ) : hasError ? (
        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
      ) : (
        <ImagePlus className="w-3.5 h-3.5 text-gray-400" />
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
  )
}
