'use client'
import { Loader2 } from 'lucide-react'

// Shown while a just-uploaded sheet is parsed/its headers extracted (see
// TemplateSettingsWizard.jsx's handleFile + the fields-rebuild effect,
// which drive `progress` through a handful of named stages). `current`/
// `total` are real counts reported live as headers are actually extracted
// — not a simulated percentage — so the bar only fills once buildFields
// starts reporting real progress; earlier stages (reading the file,
// parsing the workbook) have no per-item count yet and show as a plain
// pulsing bar instead of a fake number.
export default function ExtractionProgressModal({ progress }) {
  if (!progress) return null
  const { stage, current, total } = progress
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
      <div className="w-[320px] rounded-xl border border-divider bg-card p-5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-accent" />
          <p className="text-[13.5px] font-semibold text-foreground">{stage}</p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-card-hover">
          <div
            className={`h-full rounded-full bg-accent ${pct === null ? 'w-2/5 animate-pulse' : 'transition-[width] duration-150 ease-out'}`}
            style={pct !== null ? { width: `${pct}%` } : undefined}
          />
        </div>
        <p className="mt-2 text-[11.5px] text-subtle">
          {total > 0 ? `${current} of ${total} headers` : 'Working…'}
        </p>
      </div>
    </div>
  )
}
