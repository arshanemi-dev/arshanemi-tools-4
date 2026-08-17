'use client'
import { useEffect, useState } from 'react'
import { Loader2, FileSpreadsheet, AlertTriangle } from 'lucide-react'

// Read-only render of the original .xlsx exactly as uploaded — every sheet,
// laid out like a real spreadsheet (lettered columns, numbered rows, frozen
// header gutters, sheet tabs along the bottom) instead of a plain HTML
// table, so it actually reads as "the Excel file" rather than a data dump.
// Cell styling (merges, column widths, header colors/borders) comes from
// lib/exports/excelTemplateEngine.js, dynamically imported here so its
// ExcelJS bundle only loads once this tab is actually opened.
const ROW_GUTTER_WIDTH = 44

function colLetter(n) {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export default function ExcelFormatsView({ sourceFileUrl }) {
  const [sheets, setSheets] = useState(null)
  const [activeSheet, setActiveSheet] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!sourceFileUrl) return
    let cancelled = false
    import('@/lib/exports/excelTemplateEngine')
      .then(({ buildViewerModel }) => buildViewerModel(sourceFileUrl))
      .then((model) => {
        if (cancelled) return
        setSheets(model)
        setActiveSheet(0)
      })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [sourceFileUrl])

  if (!sourceFileUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <FileSpreadsheet className="w-7 h-7 text-subtle" />
        <p className="text-[13.5px] font-semibold text-muted">Original file isn&apos;t available for this template.</p>
        <p className="text-[12px] text-subtle max-w-sm">
          It was either created before this feature existed, or uploaded as a legacy .xls file — only .xlsx uploads keep a viewable copy of the original.
        </p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <AlertTriangle className="w-7 h-7 text-amber-400" />
        <p className="text-[13.5px] font-semibold text-muted">Couldn&apos;t open the original file.</p>
      </div>
    )
  }
  if (!sheets) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    )
  }

  const sheet = sheets[activeSheet]
  const colCount = sheet?.colWidths.length || 0

  return (
    <div className="border border-divider-light rounded-lg overflow-hidden bg-card shadow-sm">
      {/* Toolbar strip — just enough chrome to read as "a spreadsheet", not a data table */}
      <div className="flex items-center gap-2 border-b border-divider-light bg-surface px-3 py-2">
        <FileSpreadsheet className="w-4 h-4 text-accent flex-shrink-0" />
        <span className="text-[12.5px] font-semibold text-muted truncate">{sheet?.name}</span>
        {sheet?.truncated && (
          <span className="ml-auto flex-shrink-0 text-[11px] text-amber-600">
            Showing first {sheet.rows.length} rows / {colCount} cols
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-auto max-h-[65vh]">
        <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: `${ROW_GUTTER_WIDTH}px` }} />
            {sheet?.colWidths.map((w, i) => <col key={i} style={{ width: `${w}px` }} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-card-hover border border-divider-light" />
              {Array.from({ length: colCount }, (_, i) => (
                <th
                  key={i}
                  className="sticky top-0 z-20 bg-card-hover border border-divider-light px-1 py-1 text-[11px] font-medium text-subtle select-none"
                >
                  {colLetter(i + 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet?.rows.length === 0 && (
              <tr><td className="px-4 py-8 text-center text-[12px] text-subtle">This sheet is empty.</td></tr>
            )}
            {sheet?.rows.map((row, rowNumber) => (
              <tr key={row.key} style={row.height ? { height: `${row.height}px` } : undefined}>
                <th
                  className="sticky left-0 z-10 bg-card-hover border border-divider-light px-1.5 text-[11px] font-medium text-subtle text-right select-none"
                >
                  {rowNumber + 1}
                </th>
                {row.cells.map((cell) => (
                  <td
                    key={cell.key}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    style={cell.style}
                    className="relative border border-divider px-2 py-1 text-[12px] text-foreground align-top whitespace-pre-wrap hover:z-[5] hover:outline hover:outline-2 hover:-outline-offset-1 hover:outline-accent-light"
                  >
                    {cell.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet tabs — bottom strip, like the real workbook's tab bar */}
      <div className="flex items-end gap-0.5 border-t border-divider-light bg-card-hover px-2 pt-1.5 overflow-x-auto">
        {sheets.map((s, i) => (
          <button
            key={`${s.name}-${i}`}
            type="button"
            onClick={() => setActiveSheet(i)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-t-md border border-b-0 -mb-px whitespace-nowrap transition-colors ${
              i === activeSheet
                ? 'bg-card border-divider-light text-foreground'
                : 'bg-card-hover border-transparent text-subtle hover:bg-card-hover hover:text-muted'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}
