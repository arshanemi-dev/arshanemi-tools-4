'use client'
import { useRef, useState } from 'react'
import { UploadCloud, Loader2 } from 'lucide-react'
import { useBulkImageUpload } from './useBulkImageUpload'

// Uploads N dropped/selected files to Dropbox one at a time (via
// useBulkImageUpload — same sequential-with-retry contract as
// ImageCell.jsx's own single-file path). Rather than matching a file to
// "its" row by filename, every finished upload just claims the next open
// Image-column box in row-then-column order — row 1's empty boxes fill
// before row 2's start. Before starting, the selection is checked against
// how many empty boxes actually exist; selecting more is rejected outright
// (no partial upload) with a warning instead.
//
// No progress bar here — every targeted cell shows its own queued /
// uploading / retrying / error state directly in its own row's box (see
// ImageCell.jsx's `bulkStatus` prop), so this box only needs a brief
// "uploading…" line while the batch runs.
export default function BulkImageDropZone({ headers, rows, onRowsChange, uploadUrl }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const { uploads, uploading, message, handleFiles } = useBulkImageUpload({ headers, rows, onRowsChange, uploadUrl })
  const doneCount = uploads.filter((u) => u.status === 'done').length

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (!uploading) handleFiles(e.dataTransfer.files) }}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed transition-colors ${
        uploading ? 'border-divider-light bg-card cursor-default' :
        dragging ? 'border-accent bg-accent/10 cursor-pointer' : 'border-divider-light bg-card hover:border-accent-light cursor-pointer'
      }`}
    >
      {uploading ? (
        <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
      ) : (
        <UploadCloud className="w-4 h-4 text-subtle flex-shrink-0" />
      )}

      <div className="min-w-0">
        <p className="text-[13px] font-medium text-muted">
          {uploading ? `Uploading to Dropbox — ${doneCount}/${uploads.length} done…` : 'Drop product images here, or click to browse'}
        </p>
        <p className={`text-[11.5px] truncate ${message?.warning ? 'text-red-500 font-medium' : 'text-subtle'}`}>
          {uploading
            ? 'Watch each row\'s Image box below for live progress.'
            : message?.text || 'Fills empty Image boxes row by row, uploaded one by one to Dropbox — selecting more images than empty boxes across filled rows is blocked.'}
        </p>
      </div>

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
