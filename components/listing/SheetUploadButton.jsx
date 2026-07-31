'use client'
import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import PillButton from './PillButton'
import { parseUploadedSheetRows } from './parseUploadedSheet'
import { useToast } from '@/components/admin/Toast'

// Wraps the Upload Sheet / Upload Old Sheet pill button + hidden file input
// + parseUploadedSheetRows() plumbing so every grid toolbar can drop this
// in without repeating the same file-picker wiring.
export default function SheetUploadButton({ headers, onRows, label = 'Upload Sheet' }) {
  const { addToast } = useToast()
  const inputRef = useRef(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(file) {
    if (!file) return
    setLoading(true)
    try {
      const rows = await parseUploadedSheetRows(file, headers)
      if (rows.length === 0) {
        addToast('No matching columns found in that file.', 'error')
        return
      }
      onRows(rows)
      addToast(`Imported ${rows.length} row${rows.length === 1 ? '' : 's'}`, 'success')
    } catch {
      addToast('Could not read that file — is it a valid .xlsx?', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PillButton variant="upload" icon={UploadCloud} loading={loading} onClick={() => inputRef.current?.click()}>
        {label}
      </PillButton>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
    </>
  )
}
