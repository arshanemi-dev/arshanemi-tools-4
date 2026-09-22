'use client'
import { useRef } from 'react'
import { UploadCloud, FileSpreadsheet, Loader2, X } from 'lucide-react'

// Hidden file input + small pill button (before a file is picked) / file-name
// chip with a remove × (after) — shared by NewTemplateDesign.jsx's "Upload
// Sheet" and the bulk mapping page's "Upload Bulk Sheet" (Task 3: same
// upload-button UI, not a re-styled copy). `multiple` (off by default, so
// NewTemplateDesign.jsx's single-workbook flow is unaffected) makes onPick
// receive the whole FileList instead of just the first File. `tone`
// ('dark', the original, or 'green') only recolors the button background —
// the bulk page uses 'green', NewTemplateDesign.jsx keeps the default.
export default function SourceFileUploadControl({ fileName, parsing, onPick, onClear, label = 'Upload Sheet', multiple = false, tone = 'dark' }) {
  const fileRef = useRef(null)
  const toneCls = tone === 'green' ? 'bg-[#16a34a] hover:bg-[#128a3e]' : 'bg-[#101828]'
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onPick(multiple ? e.target.files : e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {fileName ? (
        <div className="flex h-8 items-center gap-1.5 rounded-full border border-divider bg-surface pl-2.5 pr-1.5">
          {parsing ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#16a34a]" />
          ) : (
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-[#16a34a]" />
          )}
          <span className="max-w-[140px] truncate text-[12.5px] font-medium text-foreground" title={fileName}>
            {fileName}
          </span>
          <button
            type="button"
            onClick={onClear}
            title="Remove sheet & reset the form below"
            className="shrink-0 rounded-full p-1 text-subtle hover:bg-[#fdeeee] hover:text-[#e02424]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={parsing}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-medium text-white disabled:opacity-60 ${toneCls}`}
        >
          {parsing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UploadCloud className="h-3.5 w-3.5 text-emerald-400" />
          )}
          {label}
        </button>
      )}
    </>
  )
}
