'use client'
import { useState, useRef } from 'react'
import { UploadCloud, Loader2 } from 'lucide-react'

// Matches an uploaded filename to a row by substring against that row's
// unique-key column (SKU once assigned, otherwise Design Number/Brand
// Name) — picks the longest matching key so e.g. "D-100" doesn't win over
// a more specific "D-1001" also present in the sheet.
function bestMatchRow(filename, rows, matchHeaderId) {
  const name = filename.toLowerCase()
  let best = -1
  let bestLen = 0
  rows.forEach((row, i) => {
    const key = String(row[matchHeaderId] ?? row.sku ?? '').toLowerCase().trim()
    if (key.length > 1 && key.length > bestLen && name.includes(key)) {
      best = i
      bestLen = key.length
    }
  })
  return best
}

export default function BulkImageDropZone({ headers, rows, onRowsChange, uploadUrl, matchHeaderId }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [summary, setSummary] = useState(null)
  const inputRef = useRef(null)
  const imageHeaders = [...headers].filter((h) => h.dataType === 'image').sort((a, b) => a.order - b.order)

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0 || !uploadUrl) return
    setUploading(true)
    setSummary(null)
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('files', f))
      const res = await fetch(uploadUrl, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      const uploadedFiles = data.files || []

      const nextRows = rows.map((r) => ({ ...r }))
      let matched = 0
      for (const uf of uploadedFiles) {
        if (!uf.url) continue
        const rowIndex = bestMatchRow(uf.filename, nextRows, matchHeaderId)
        if (rowIndex === -1) continue
        const targetHeader = imageHeaders.find((h) => !nextRows[rowIndex][h.id])
        if (!targetHeader) continue
        nextRows[rowIndex] = { ...nextRows[rowIndex], [targetHeader.id]: uf.url }
        matched++
      }
      onRowsChange(nextRows)
      setSummary(`Matched ${matched} of ${uploadedFiles.length} images to rows by filename.`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed cursor-pointer transition-colors ${
        dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-white hover:border-indigo-300'
      }`}
    >
      {uploading ? (
        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />
      ) : (
        <UploadCloud className="w-4 h-4 text-gray-400 flex-shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-gray-700">
          {uploading ? 'Uploading & matching…' : 'Drop product images here, or click to browse'}
        </p>
        <p className="text-[11.5px] text-gray-400 truncate">
          {summary || 'Filenames are matched to rows by SKU or Design Number — fills the first empty Image column.'}
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
