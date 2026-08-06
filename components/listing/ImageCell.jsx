'use client'
import { useState, useRef } from 'react'
import { ImagePlus, X, Loader2, AlertCircle } from 'lucide-react'
import { useListingImageUpload } from '@/hooks/useListingImageUpload'

// Per-cell single-image dropzone — compact enough to sit inline in a grid
// cell (unlike components/admin/ImageUpload.jsx's full-size box). Uploads
// through whichever per-template route the grid passes as `uploadUrl`
// (Dropbox-backed, see app/api/listing-tools/[templateId]/images/route.js)
// so every image for a template lands under the same
// /listing-tools/{company}/{user}/{templateId}/ Dropbox folder as bulk
// drops. useListingImageUpload retries transient failures automatically —
// a permanent failure leaves the cell in an error state, clickable to retry.
export default function ImageCell({ value, onChange, uploadUrl, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const { uploads, uploading, uploadFiles } = useListingImageUpload(uploadUrl)
  const current = uploads[0]
  const isRetrying = current?.status === 'retrying'
  const hasError = current?.status === 'error'

  async function upload(file) {
    if (!file || !uploadUrl) return
    await uploadFiles([file], { onFileDone: (result) => onChange(result.url) })
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
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
      onClick={() => !disabled && !uploading && inputRef.current?.click()}
      title={hasError ? `${current.error} — click to retry` : undefined}
      className={`flex items-center justify-center w-14 h-11 mx-auto my-1 rounded border border-dashed transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed border-gray-200' :
        hasError ? 'cursor-pointer border-red-300 bg-red-50 hover:border-red-400' :
        'cursor-pointer border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
      } ${dragging ? 'border-indigo-400 bg-indigo-50' : ''}`}
    >
      {uploading ? (
        <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" aria-label={isRetrying ? `Retrying (${current.attempt}/3)…` : 'Uploading…'} />
      ) : hasError ? (
        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
      ) : (
        <ImagePlus className="w-3.5 h-3.5 text-gray-400" />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
      />
    </div>
  )
}
