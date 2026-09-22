'use client'
import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import PillButton from './PillButton'
import { parseUploadedSheetRows } from './parseUploadedSheet'
import { useToast } from '@/components/admin/Toast'

// Wraps the Upload Sheet / Upload Old Sheet pill button + hidden file input
// + parseUploadedSheetRows() plumbing so every grid toolbar can drop this
// in without repeating the same file-picker wiring. Accepts multiple files
// at once — each is parsed against the same `headers`, and every matching
// row from every file is combined into one onRows(rows) call (onRows
// replaces the whole sheet's rows, so parsing files one-by-one and calling
// it repeatedly would just make each call overwrite the last).
export default function SheetUploadButton({ headers, onRows, label = 'Upload Sheet' }) {
  const { addToast } = useToast()
  const inputRef = useRef(null)
  const [loading, setLoading] = useState(false)

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    setLoading(true)
    try {
      const allRows = []
      for (const file of files) {
        allRows.push(...(await parseUploadedSheetRows(file, headers)))
      }
      if (allRows.length === 0) {
        addToast(`No matching columns found in ${files.length === 1 ? 'that file' : 'those files'}.`, 'error')
        return
      }
      onRows(allRows)
      addToast(
        `Imported ${allRows.length} row${allRows.length === 1 ? '' : 's'}` +
          (files.length > 1 ? ` from ${files.length} files` : ''),
        'success',
      )
    } catch {
      addToast(`Could not read ${files.length === 1 ? 'that file' : 'one of those files'} — is it a valid .xlsx?`, 'error')
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
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
    </>
  )
}
