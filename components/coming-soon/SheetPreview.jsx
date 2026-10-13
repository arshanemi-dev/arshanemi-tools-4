import { Check, Download, Images, Sparkles } from 'lucide-react';
import { comingSoon } from '@/data/comingSoon';

// A listing sheet filling itself in, on a loop: the SKU column is already
// there (what the seller typed), every other cell wipes in left to right, top
// to bottom, then the sheet clears and the next batch starts. Decorative —
// hidden from screen readers.

// A cell's row / column. .cs-fill (app/globals.css) turns these into its start
// delay. Written out in full so Tailwind sees the classes.
const ROW = ['[--r:0]', '[--r:1]', '[--r:2]', '[--r:3]', '[--r:4]'];
const COL = ['[--c:0]', '[--c:1]', '[--c:2]', '[--c:3]', '[--c:4]', '[--c:5]'];

// How much of its cell each bar covers, one array per row — uneven on purpose,
// so the rows read as different products rather than a pattern.
const BARS = [
  ['w-4/5', 'w-full', 'w-3/5', 'w-2/3', 'w-1/2'],
  ['w-3/5', 'w-4/5', 'w-4/5', 'w-1/2', 'w-2/3'],
  ['w-full', 'w-11/12', 'w-1/2', 'w-4/5', 'w-1/2'],
  ['w-2/3', 'w-3/4', 'w-2/3', 'w-3/5', 'w-3/4'],
  ['w-4/5', 'w-full', 'w-3/4', 'w-2/3', 'w-1/2'],
];

// Five data columns and a narrow last one for the row's tick.
const GRID = 'grid grid-cols-[0.9fr_1.6fr_1fr_1.1fr_0.8fr_0.875rem] items-center gap-x-2 px-4 sm:gap-x-3';

export default function SheetPreview() {
  const { fileName, chip, columns, imagesLabel, exportLabel } = comingSoon.preview;

  return (
    // sm:mb-14 keeps room below for the floating note, clear of the footer
    <div aria-hidden="true" className="relative mx-auto w-full max-w-xl sm:mb-14">
      {/* Soft brand-colour light behind the sheet */}
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-accent-vivid/25 via-cyan/15 to-transparent blur-3xl" />

      <div className="cs-float cs-glow overflow-hidden rounded-2xl border border-divider bg-background/90 backdrop-blur">
        {/* Title bar */}
        <div className="flex items-center gap-3 border-b border-divider bg-surface px-4 py-3">
          <span className="flex shrink-0 gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-divider-light" />
            <span className="h-2.5 w-2.5 rounded-full bg-divider-light" />
            <span className="h-2.5 w-2.5 rounded-full bg-divider-light" />
          </span>
          <span className="truncate text-xs font-medium text-muted">{fileName}</span>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-vivid/10 px-2.5 py-1 text-[11px] font-semibold text-accent-vivid">
            <Sparkles size={12} className="animate-pulse motion-reduce:animate-none" />
            {chip}
          </span>
        </div>

        {/* Column headers */}
        <div className={`${GRID} border-b border-divider bg-surface/60 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-subtle`}>
          {columns.map((column) => (
            <span key={column} className="truncate">{column}</span>
          ))}
          <span />
        </div>

        {/* Rows */}
        {BARS.map((bars, r) => (
          <div key={r} className={`${GRID} ${ROW[r]} border-b border-divider py-3.5`}>
            {bars.map((width, c) =>
              c === 0 ? (
                <span key={c} className={`h-2 rounded-full bg-foreground/20 ${width}`} />
              ) : (
                <span key={c} className={`cs-fill ${COL[c]} h-2 rounded-full bg-gradient-to-r from-accent-vivid to-cyan ${width}`} />
              )
            )}
            <Check size={14} strokeWidth={3} className={`cs-fill ${COL[5]} text-action`} />
          </div>
        ))}

        {/* Batch progress */}
        <div className="flex items-center gap-3 bg-surface px-4 py-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-divider">
            <span className="cs-progress block h-full rounded-full bg-gradient-to-r from-accent-vivid to-cyan" />
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-muted">
            <Download size={12} />
            {exportLabel}
          </span>
        </div>
      </div>

      {/* Floating note — the bulk-image half of the story */}
      <div className="cs-float-slow cs-glow absolute -bottom-14 -left-4 hidden items-center gap-3 rounded-2xl border border-divider bg-background/95 px-3.5 py-3 backdrop-blur sm:flex lg:-left-8">
        <span className="flex -space-x-2">
          <span className="h-8 w-8 rounded-lg border-2 border-background bg-gradient-to-br from-accent-light to-accent-vivid" />
          <span className="h-8 w-8 rounded-lg border-2 border-background bg-gradient-to-br from-accent-vivid to-cyan" />
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-background bg-gradient-to-br from-cyan to-accent text-white">
            <Images size={14} />
          </span>
        </span>
        <span className="text-xs font-semibold text-foreground">{imagesLabel}</span>
      </div>
    </div>
  );
}
