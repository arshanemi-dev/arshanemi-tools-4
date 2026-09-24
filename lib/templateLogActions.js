import {
  Activity, GitBranch, GitBranchPlus, PencilLine, Radio, PowerOff, Trash2, FilePlus2, FilePen, FileX2,
  Sparkles, Eye, EyeOff, Layers, CircleDot,
} from 'lucide-react'

// One vocabulary for every audit-log row the hub's listing_template_logs
// holds — shared by the Template Logs page and each template's Versions
// tab. Version-level actions (create/edit/on/off/delete) come from the
// hub's /versions routes; template_* ones from lib/templateLogDiff.js.
// Tone classes are written out in full so Tailwind's scanner sees them.
const TONES = {
  indigo: { chip: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/25', dot: 'bg-indigo-500' },
  amber: { chip: 'bg-amber-500/10 text-amber-600 ring-amber-500/25', dot: 'bg-amber-500' },
  emerald: { chip: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25', dot: 'bg-emerald-500' },
  slate: { chip: 'bg-slate-500/10 text-slate-500 ring-slate-500/25', dot: 'bg-slate-400' },
  rose: { chip: 'bg-rose-500/10 text-rose-600 ring-rose-500/25', dot: 'bg-rose-500' },
  violet: { chip: 'bg-violet-500/10 text-violet-600 ring-violet-500/25', dot: 'bg-violet-500' },
  sky: { chip: 'bg-sky-500/10 text-sky-600 ring-sky-500/25', dot: 'bg-sky-500' },
  fuchsia: { chip: 'bg-fuchsia-500/10 text-fuchsia-600 ring-fuchsia-500/25', dot: 'bg-fuchsia-500' },
  teal: { chip: 'bg-teal-500/10 text-teal-600 ring-teal-500/25', dot: 'bg-teal-500' },
}

const ACTIONS = {
  create: { label: 'Version created', icon: GitBranchPlus, tone: 'indigo' },
  edit: { label: 'Version renamed', icon: PencilLine, tone: 'amber' },
  on: { label: 'Went live', icon: Radio, tone: 'emerald' },
  off: { label: 'Taken offline', icon: PowerOff, tone: 'slate' },
  delete: { label: 'Version deleted', icon: Trash2, tone: 'rose' },
  template_create: { label: 'Template created', icon: FilePlus2, tone: 'violet' },
  template_update: { label: 'Template updated', icon: FilePen, tone: 'sky' },
  template_rules: { label: 'AI rules updated', icon: Sparkles, tone: 'fuchsia' },
  template_show: { label: 'Made visible', icon: Eye, tone: 'teal' },
  template_hide: { label: 'Hidden', icon: EyeOff, tone: 'slate' },
  template_delete: { label: 'Template deleted', icon: FileX2, tone: 'rose' },
}

export function actionMeta(action) {
  const meta = ACTIONS[action] || { label: String(action || 'Event').replace(/_/g, ' '), icon: CircleDot, tone: 'slate' }
  return { ...meta, ...TONES[meta.tone] }
}

// The Template Logs page's stat tiles — each tile is also that category's
// filter, so the counts and the filter can never disagree.
export const LOG_CATEGORIES = [
  { id: 'all', label: 'All events', icon: Activity, actions: null },
  { id: 'versions', label: 'Versions', icon: GitBranch, actions: ['create', 'edit', 'delete'] },
  { id: 'live', label: 'Live changes', icon: Radio, actions: ['on', 'off'] },
  { id: 'edits', label: 'Template edits', icon: FilePen, actions: ['template_update', 'template_rules', 'template_show', 'template_hide'] },
  { id: 'lifecycle', label: 'Created & deleted', icon: Layers, actions: ['template_create', 'template_delete'] },
]

export function versionLabelOf(version) {
  if (!version) return null
  return version.label || `V${version.versionNumber}`
}

// ─── Date formatting ─────────────────────────────────────────────────────
const DATE_FMT = { day: '2-digit', month: 'short', year: 'numeric' }

export function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', DATE_FMT) : '—'
}
export function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
}
export function fmtDateTime(iso) {
  return iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : '—'
}

export function fmtRelative(iso, now = Date.now()) {
  if (!iso) return ''
  const secs = Math.round((now - new Date(iso).getTime()) / 1000)
  if (secs < 45) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return fmtDate(iso)
}

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// "Today" / "Yesterday" / "Mon, 22 Sep 2026" — the Template Logs page's
// day-group headings.
export function dayLabel(iso, now = new Date()) {
  const d = new Date(iso)
  if (dayKey(d) === dayKey(now)) return 'Today'
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  if (dayKey(d) === dayKey(y)) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', ...DATE_FMT })
}

export function sameDay(a, b) {
  return dayKey(new Date(a)) === dayKey(new Date(b))
}
