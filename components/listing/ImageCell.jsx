'use client'
import { useState, useRef } from 'react'
import { ImagePlus, X, Loader2 } from 'lucide-react'

// Per-cell single-image dropzone — compact enough to sit inline in a grid
// cell (unlike components/admin/ImageUpload.jsx's full-size box). Uploads
// through whichever per-template route the grid passes as `uploadUrl` so
// every image for a template lands under the same
// tools/{company}/{user}/listing-tools/{templateId}/ prefix as bulk drops.
export default function ImageCell({ value, onChange, uploadUrl, disabled }) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  async function upload(file) {
    if (!file || !uploadUrl) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('files', file)
      const res = await fetch(uploadUrl, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      const uploaded = data.files?.[0]
      if (uploaded?.url) onChange(uploaded.url)
    } finally {
      setUploading(false)
    }
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
      className={`flex items-center justify-center w-14 h-11 mx-auto my-1 rounded border border-dashed transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed border-gray-200' : 'cursor-pointer border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
      } ${dragging ? 'border-indigo-400 bg-indigo-50' : ''}`}
    >
      {uploading ? (
        <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
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
