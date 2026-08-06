'use client'
import { useRef, useState } from 'react'
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, RotateCw } from 'lucide-react'
import { useListingImageUpload } from '@/hooks/useListingImageUpload'

function isRowEmpty(row) {
  return Object.values(row || {}).every((v) => v === undefined || v === null || String(v).trim() === '')
}

// Ordered list of open Image-column boxes across every filled-in row (the
// always-present trailing blank row is skipped — nothing to attach an
// image to yet) — one row's boxes are listed in full before the next
// row's, column order within a row follows header.order. This list IS the
// upload capacity: (filled rows × image columns) − boxes already holding
// an image, exactly the arithmetic product wants surfaced as a limit.
function buildEmptySlots(rows, imageHeaders) {
  const slots = []
  rows.forEach((row, rowIndex) => {
    if (isRowEmpty(row)) return
    imageHeaders.forEach((h) => {
      if (!row[h.id]) slots.push({ rowIndex, headerId: h.id })
    })
  })
  return slots
}

// Uploads N dropped/selected files to Dropbox one at a time (via
// useListingImageUpload — same sequential-with-retry contract as
// ImageCell.jsx). Rather than matching a file to "its" row by filename,
// every finished upload just claims the next open Image-column box in
// row-then-column order — row 1's empty boxes fill before row 2's start.
// Before starting, the selection is checked against how many empty boxes
// actually exist; selecting more files than that is rejected outright
// (no partial upload) with a warning instead.
export default function BulkImageDropZone({ headers, rows, onRowsChange, uploadUrl }) {
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState(null) // { text, warning }
  const inputRef = useRef(null)
  const rowsRef = useRef(rows)
  const { uploads, uploading, uploadFiles } = useListingImageUpload(uploadUrl)
  const imageHeaders = [...headers].filter((h) => h.dataType === 'image').sort((a, b) => a.order - b.order)

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0 || !uploadUrl) return

    const slots = buildEmptySlots(rows, imageHeaders)
    if (files.length > slots.length) {
      setMessage({
        warning: true,
        text: `Only ${slots.length} empty image box${slots.length === 1 ? '' : 'es'} available across filled rows — you selected ${files.length}. Remove some and try again.`,
      })
      return
    }

    setMessage(null)
    rowsRef.current = rows.map((r) => ({ ...r }))
    let filled = 0
    let slotIndex = 0

    const results = await uploadFiles(files, {
      onFileDone: (result) => {
        const slot = slots[slotIndex]
        slotIndex++
        if (!slot) return
        rowsRef.current[slot.rowIndex] = { ...rowsRef.current[slot.rowIndex], [slot.headerId]: result.url }
        filled++
        onRowsChange([...rowsRef.current])
      },
    })

    const succeeded = results.filter((r) => r.ok).length
    setMessage({
      warning: false,
      text: `Filled ${filled} of ${succeeded} uploaded image${succeeded === 1 ? '' : 's'} into empty boxes, row by row.`,
    })
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed transition-colors ${
          uploading ? 'pointer-events-none opacity-70 border-gray-300 bg-white' :
          dragging ? 'border-indigo-400 bg-indigo-50 cursor-pointer' : 'border-gray-300 bg-white hover:border-indigo-300 cursor-pointer'
        }`}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />
        ) : (
          <UploadCloud className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-gray-700">
            {uploading
              ? `Uploading to Dropbox ${uploads.filter((u) => u.status === 'done').length}/${uploads.length}…`
              : 'Drop product images here, or click to browse'}
          </p>
          <p className={`text-[11.5px] truncate ${message?.warning ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {message?.text || 'Fills empty Image boxes row by row, uploaded one by one to Dropbox — selecting more images than empty boxes across filled rows is blocked.'}
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

      {uploads.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white">
          {uploads.map((u) => (
            <li key={u.id} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
              {u.status === 'done' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : u.status === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              ) : u.status === 'retrying' ? (
                <RotateCw className="w-3.5 h-3.5 text-amber-500 animate-spin flex-shrink-0" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin flex-shrink-0" />
              )}
              <span className="truncate flex-1 text-gray-600">{u.file.name}</span>
              {u.status === 'error' ? (
                <span className="text-red-500 flex-shrink-0">{u.error}</span>
              ) : u.status !== 'done' ? (
                <span className="text-gray-400 flex-shrink-0">
                  {u.status === 'retrying' ? `retry ${u.attempt}/3` : `${u.progress}%`}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
