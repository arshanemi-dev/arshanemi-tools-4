// Excel / Google Sheets–style column filtering and sorting — pure functions
// over plain rows + column definitions, no React. Used by the Template Logs
// grid; nothing in here is specific to logs.
//
// Column definition:
//   { key, label, type: 'text' | 'number' | 'date',
//     value(row)      → the cell's value as a string, used by "Filter by
//                       values" and text conditions ('' = blank)
//     valueLabel?(v)  → how a value reads in the checklist (default: itself)
//     text?(row)      → what global search matches against (default: value)
//     number?(row)    → numeric value (type 'number')
//     date?(row)      → ISO timestamp (type 'date'; value() should return its
//                       local day key, see dayKeyOf)
//     sortValue?(row) → comparable override (e.g. V10 after V9) }
//
// Column filter: { condition: { op, a, b } | null, values: Set<string> | null }
// — both optional and AND-ed together; values null = every value allowed.

export const CONDITIONS = {
  text: [
    { op: 'contains', label: 'Contains', args: 1 },
    { op: 'notContains', label: 'Does not contain', args: 1 },
    { op: 'startsWith', label: 'Starts with', args: 1 },
    { op: 'endsWith', label: 'Ends with', args: 1 },
    { op: 'equals', label: 'Is exactly', args: 1 },
    { op: 'empty', label: 'Is empty', args: 0 },
    { op: 'notEmpty', label: 'Is not empty', args: 0 },
  ],
  number: [
    { op: 'eq', label: 'Equal to', args: 1, symbol: '=' },
    { op: 'neq', label: 'Not equal to', args: 1, symbol: '≠' },
    { op: 'gt', label: 'Greater than', args: 1, symbol: '>' },
    { op: 'gte', label: 'Greater than or equal to', args: 1, symbol: '≥' },
    { op: 'lt', label: 'Less than', args: 1, symbol: '<' },
    { op: 'lte', label: 'Less than or equal to', args: 1, symbol: '≤' },
    { op: 'between', label: 'Between', args: 2 },
  ],
  date: [
    { op: 'today', label: 'Today', args: 0 },
    { op: 'yesterday', label: 'Yesterday', args: 0 },
    { op: 'last7', label: 'Last 7 days', args: 0 },
    { op: 'last30', label: 'Last 30 days', args: 0 },
    { op: 'thisMonth', label: 'This month', args: 0 },
    { op: 'lastMonth', label: 'Last month', args: 0 },
    { op: 'on', label: 'Is on', args: 1 },
    { op: 'before', label: 'Is before', args: 1 },
    { op: 'after', label: 'Is after', args: 1 },
    { op: 'between', label: 'Is between', args: 2 },
  ],
}

export const SORT_LABELS = {
  text: { asc: 'Sort A → Z', desc: 'Sort Z → A' },
  number: { asc: 'Sort smallest → largest', desc: 'Sort largest → smallest' },
  date: { asc: 'Sort oldest → newest', desc: 'Sort newest → oldest' },
}

export const BLANK_LABEL = '(Blanks)'

const pad = (n) => String(n).padStart(2, '0')

// Local-time 'YYYY-MM-DD' — sorts and compares correctly as a plain string,
// and matches what <input type="date"> produces.
export function dayKeyOf(input) {
  if (!input) return ''
  const d = new Date(input)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Parses a day key back as LOCAL midnight (new Date('YYYY-MM-DD') would be
// UTC midnight — the previous day anywhere west of Greenwich).
export function dateFromDayKey(key) {
  const [y, m, d] = String(key).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function shiftDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function conditionDef(type, op) {
  return (CONDITIONS[type] || []).find((c) => c.op === op) || null
}

// A condition still missing its argument(s) filters nothing — same as a
// spreadsheet ignoring a half-typed condition.
export function isConditionComplete(type, condition) {
  const def = condition && conditionDef(type, condition.op)
  if (!def) return false
  if (def.args >= 1 && String(condition.a ?? '').trim() === '') return false
  return true
}

export function isFilterActive(column, filter) {
  return !!filter && (!!filter.values || isConditionComplete(column.type, filter.condition))
}

function matchCondition(column, row, condition, now) {
  if (!isConditionComplete(column.type, condition)) return true
  const { op } = condition
  const a = String(condition.a ?? '').trim()
  const b = String(condition.b ?? '').trim()

  if (column.type === 'number') {
    const v = Number(column.number ? column.number(row) : column.value(row))
    if (Number.isNaN(v)) return false
    const x = Number(a)
    if (op === 'between') {
      const y = b === '' ? Infinity : Number(b)
      return v >= Math.min(x, y) && v <= Math.max(x, y)
    }
    return { eq: v === x, neq: v !== x, gt: v > x, gte: v >= x, lt: v < x, lte: v <= x }[op] ?? true
  }

  if (column.type === 'date') {
    const iso = column.date ? column.date(row) : null
    if (!iso) return false
    const day = dayKeyOf(iso)
    const today = dayKeyOf(now)
    const month = day.slice(0, 7)
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    switch (op) {
      case 'today': return day === today
      case 'yesterday': return day === dayKeyOf(shiftDays(now, -1))
      case 'last7': return day >= dayKeyOf(shiftDays(now, -6)) && day <= today
      case 'last30': return day >= dayKeyOf(shiftDays(now, -29)) && day <= today
      case 'thisMonth': return month === today.slice(0, 7)
      case 'lastMonth': return month === dayKeyOf(lastMonthDate).slice(0, 7)
      case 'on': return day === a
      case 'before': return day < a
      case 'after': return day > a
      case 'between': {
        const hi = b || '9999-12-31'
        return day >= (a < hi ? a : hi) && day <= (a < hi ? hi : a)
      }
      default: return true
    }
  }

  const v = String(column.value(row) ?? '').toLowerCase()
  const q = a.toLowerCase()
  switch (op) {
    case 'contains': return v.includes(q)
    case 'notContains': return !v.includes(q)
    case 'startsWith': return v.startsWith(q)
    case 'endsWith': return v.endsWith(q)
    case 'equals': return v === q
    case 'empty': return v.trim() === ''
    case 'notEmpty': return v.trim() !== ''
    default: return true
  }
}

function matchesSearch(row, columns, query) {
  return columns.some((c) => String((c.text || c.value)(row) ?? '').toLowerCase().includes(query))
}

// Rows passing every column filter (except `exceptKey`'s — how a column's
// own value checklist is built, so it offers what the OTHER filters leave,
// exactly like Excel) and the global search.
export function filterRows(rows, columns, filters, search = '', exceptKey = null, now = new Date()) {
  const query = search.trim().toLowerCase()
  const active = columns.filter((c) => c.key !== exceptKey && isFilterActive(c, filters[c.key]))
  if (!active.length && !query) return rows
  return rows.filter((row) => {
    for (const c of active) {
      const f = filters[c.key]
      if (f.values && !f.values.has(String(c.value(row) ?? ''))) return false
      if (!matchCondition(c, row, f.condition, now)) return false
    }
    return !query || matchesSearch(row, columns, query)
  })
}

function sortValueOf(column, row) {
  if (column.sortValue) return column.sortValue(row)
  if (column.type === 'date') {
    const iso = column.date ? column.date(row) : null
    return iso ? new Date(iso).getTime() : ''
  }
  if (column.type === 'number') {
    const n = Number(column.number ? column.number(row) : column.value(row))
    return Number.isNaN(n) ? '' : n
  }
  return String(column.value(row) ?? '')
}

const isBlank = (v) => v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))

function compare(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

// Stable single-column sort; blanks always go last in either direction
// (spreadsheet behavior), so sorting never buries real values under empties.
export function sortRows(rows, column, dir) {
  if (!column || !dir) return rows
  const factor = dir === 'desc' ? -1 : 1
  return rows
    .map((row, i) => ({ row, i, v: sortValueOf(column, row) }))
    .sort((x, y) => {
      const xb = isBlank(x.v)
      const yb = isBlank(y.v)
      if (xb || yb) return xb === yb ? x.i - y.i : xb ? 1 : -1
      return compare(x.v, y.v) * factor || x.i - y.i
    })
    .map((e) => e.row)
}

// The "Filter by values" checklist: [{ value, label, count }], in the
// column's natural order (dates newest first), "(Blanks)" last.
export function distinctValues(rows, column) {
  const counts = new Map()
  for (const row of rows) {
    const v = String(column.value(row) ?? '')
    counts.set(v, (counts.get(v) || 0) + 1)
  }
  const entries = [...counts.entries()].map(([value, count]) => ({
    value,
    count,
    label: value === '' ? BLANK_LABEL : column.valueLabel ? column.valueLabel(value) : value,
  }))
  return entries.sort((x, y) => {
    if (x.value === '' || y.value === '') return x.value === '' ? 1 : -1
    if (column.type === 'date') return y.value.localeCompare(x.value)
    if (column.type === 'number') return Number(x.value) - Number(y.value)
    return compare(x.label, y.label)
  })
}

// One-line summary for an active-filter chip, e.g.
// `Event: Went live, Version created +1`, `Template contains "saree"`.
export function describeFilter(column, filter) {
  const parts = []
  if (filter?.values) {
    const labels = [...filter.values].map((v) => (v === '' ? BLANK_LABEL : column.valueLabel ? column.valueLabel(v) : v))
    parts.push(labels.length <= 2 ? labels.join(', ') : `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`)
  }
  if (isConditionComplete(column.type, filter?.condition)) {
    const { op, a, b } = filter.condition
    const def = conditionDef(column.type, op)
    const fmt = (v) => (column.type === 'date' && v ? dateFromDayKey(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : v)
    if (def.args === 0) parts.push(def.label.toLowerCase())
    else if (op === 'between') parts.push(`between ${fmt(a)} and ${b ? fmt(b) : '…'}`)
    else parts.push(`${def.symbol || def.label.toLowerCase()} ${column.type === 'text' ? `“${a}”` : fmt(a)}`)
  }
  return `${column.label}: ${parts.join(' · ')}`
}
