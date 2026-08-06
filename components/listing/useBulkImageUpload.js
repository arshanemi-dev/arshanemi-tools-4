'use client'
import { useRef, useState } from 'react'
import { useListingImageUpload } from '@/hooks/useListingImageUpload'

function isRowEmpty(row) {
  return Object.values(row || {}).every((v) => v === undefined || v === null || String(v).trim() === '')
}

// Ordered list of open Image-column boxes across every filled-in row (the
// always-present trailing blank row is skipped — nothing to attach an
// image to yet) — one row's boxes are listed in full before the next
// row's, column order within a row follows header.order. This list IS the
// upload capacity: (filled rows × image columns) − boxes already holding
// an image.
export function buildEmptySlots(rows, imageHeaders) {
  const slots = []
  rows.forEach((row, rowIndex) => {
    if (isRowEmpty(row)) return
    imageHeaders.forEach((h) => {
      if (!row[h.id]) slots.push({ rowIndex, headerId: h.id })
    })
  })
  return slots
}

// Shared "select/drop N images → fill the next N empty Image-column boxes,
// row by row" operation — same instance shape whether it's driven by the
// dedicated BulkImageDropZone toolbar or a single ImageCell that received a
// multi-file drop/selection. Uploads one file at a time to Dropbox (via
// useListingImageUpload, retry-on-transient-failure included); before
// starting, the selection is checked against how many empty boxes actually
// exist across `rows` — selecting more is rejected outright, no partial
// upload.
//
// No standalone progress bar — `uploads` is zipped against the same-order
// `slots` it was matched to into `slotStatus`, a `{rowIndex:headerId}` →
// upload-status map, so every affected cell can show its own queued /
// uploading / retrying / error state directly in its own row's box.
export function useBulkImageUpload({ headers, rows, onRowsChange, uploadUrl }) {
  const [message, setMessage] = useState(null) // { text, warning }
  const [activeSlots, setActiveSlots] = useState([])
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
    setActiveSlots(slots.slice(0, files.length))
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

  const slotStatus = {}
  uploads.forEach((u, i) => {
    const slot = activeSlots[i]
    if (slot) slotStatus[`${slot.rowIndex}:${slot.headerId}`] = u
  })

  return { uploads, uploading, message, handleFiles, slotStatus }
}
