// Builds the { action, detail } audit entry for a template create / edit /
// delete — pure, no I/O. Called from the template routes right after the
// store write; lib/listingHistory.js's recordTemplateLog ships the result
// to the hub. `detail.changes` rows ({ field, label, before, after }) are
// what the Template Logs page's detail drawer renders as its before → after
// table, and `detail.headers` its added/removed header chips.

const TEXT_LIMIT = 300
const LABEL_LIST_LIMIT = 25

const META_FIELDS = [
  ['templateName', 'Template Name'],
  ['finalName', 'Final Name'],
  ['description', 'Description'],
  ['marketplaceName', 'Marketplace'],
  ['category1', 'Category 1'],
  ['category2', 'Category 2'],
  ['category3', 'Category 3'],
  ['category4', 'Category 4'],
  ['category5', 'Category 5'],
  ['category6', 'Category 6'],
  ['exportVersion', 'Version'],
]

const RULE_FIELDS = [
  ['title', 'Rule Title'],
  ['description', 'Rule Description'],
  ['keyword', 'Keywords'],
  ['otherRules', 'Rules'],
  ['rule1', 'Rule-1'],
  ['rule2', 'Rule-2'],
]

function clip(value) {
  const s = String(value ?? '').trim()
  return s.length > TEXT_LIMIT ? `${s.slice(0, TEXT_LIMIT)}…` : s
}

function listLabels(labels, max = 3) {
  if (labels.length <= max) return labels.join(', ')
  return `${labels.slice(0, max).join(', ')} +${labels.length - max} more`
}

export function countHeaders(sheets) {
  return (sheets || []).reduce((n, s) => n + (s.headers?.length || 0), 0)
}

function headerLabels(sheets) {
  return (sheets || []).flatMap((s) => (s.headers || []).map((h) => String(h.label || '').trim())).filter(Boolean)
}

// null when nothing about the header structure changed. `restructured`
// covers the same set of labels coming back moved between groups,
// reordered, or with a different data type — no header added or removed,
// but still a real structure edit worth a log line.
function diffHeaders(beforeSheets, afterSheets) {
  const signature = (sheets) =>
    (sheets || [])
      .flatMap((s) => (s.headers || []).map((h) => `${s.group}|${h.label}|${h.dataType || ''}`))
      .join('\n')
  if (signature(beforeSheets) === signature(afterSheets)) return null

  const before = headerLabels(beforeSheets)
  const after = headerLabels(afterSheets)
  const beforeSet = new Set(before)
  const afterSet = new Set(after)
  const added = after.filter((l) => !beforeSet.has(l))
  const removed = before.filter((l) => !afterSet.has(l))
  return {
    before: before.length,
    after: after.length,
    addedCount: added.length,
    removedCount: removed.length,
    added: added.slice(0, LABEL_LIST_LIMIT),
    removed: removed.slice(0, LABEL_LIST_LIMIT),
    restructured: added.length === 0 && removed.length === 0,
  }
}

function headerSummary(h) {
  if (h.restructured) return 'Headers rearranged'
  const parts = []
  if (h.addedCount) parts.push(`+${h.addedCount}`)
  if (h.removedCount) parts.push(`−${h.removedCount}`)
  return `Headers ${h.before} → ${h.after} (${parts.join(' / ')})`
}

// marketplaceName keeps the entry under the right marketplace tab on the
// Template Logs page even after the template itself is deleted.
function identity(meta) {
  return {
    templateName: meta?.templateName || null,
    templateNumber: meta?.templateNumber || null,
    marketplaceName: meta?.marketplaceName || null,
  }
}

export function buildTemplateCreateLog(meta, sheets) {
  const headerCount = countHeaders(sheets)
  return {
    action: 'template_create',
    detail: {
      summary: `Created "${meta.templateName}" · ${headerCount} header${headerCount === 1 ? '' : 's'}`,
      ...identity(meta),
      headerCount,
    },
  }
}

export function buildTemplateDeleteLog(meta) {
  const rows = Object.values(meta.rowCounts || {}).reduce((sum, n) => sum + (n || 0), 0)
  return {
    action: 'template_delete',
    detail: {
      summary: `Deleted "${meta.templateName}"${rows ? ` · ${rows} product row${rows === 1 ? '' : 's'} removed` : ''}`,
      ...identity(meta),
      rowsRemoved: rows,
    },
  }
}

// null when the PATCH was a no-op (e.g. Edit Rules saved unchanged) — no
// log row for that. Visibility-only and rules-only edits get their own
// actions so the Template Logs page can filter them apart from structural
// edits; anything else mixed together is one template_update listing all
// of it.
export function buildTemplateUpdateLog(before, after, { beforeSheets, afterSheets } = {}) {
  const metaChanges = META_FIELDS
    .filter(([key]) => clip(before[key]) !== clip(after[key]))
    .map(([key, label]) => ({ field: key, label, before: clip(before[key]), after: clip(after[key]) }))
  const ruleChanges = RULE_FIELDS
    .filter(([key]) => clip(before.aiRules?.[key]) !== clip(after.aiRules?.[key]))
    .map(([key, label]) => ({ field: `aiRules.${key}`, label, before: clip(before.aiRules?.[key]), after: clip(after.aiRules?.[key]) }))
  const visibility = !!before.isAllowedToShow !== !!after.isAllowedToShow ? !!after.isAllowedToShow : null
  const headers = afterSheets ? diffHeaders(beforeSheets, afterSheets) : null

  if (!metaChanges.length && !ruleChanges.length && visibility === null && !headers) return null

  const changes = [...metaChanges, ...ruleChanges]
  const base = { ...identity(after), changes, ...(headers ? { headers } : {}), ...(visibility !== null ? { visibility } : {}) }

  if (visibility !== null && !changes.length && !headers) {
    return {
      action: visibility ? 'template_show' : 'template_hide',
      detail: {
        ...base,
        summary: visibility ? 'Made visible in Auto Listing / Choose Your Template' : 'Hidden from Auto Listing / Choose Your Template',
      },
    }
  }

  // Edit Rules saves the template description alongside the 6 rule fields,
  // so a description change riding along still counts as a rules edit.
  if (ruleChanges.length && !headers && visibility === null && metaChanges.every((c) => c.field === 'description')) {
    return { action: 'template_rules', detail: { ...base, summary: `Updated AI rules — ${listLabels(changes.map((c) => c.label))}` } }
  }

  const parts = []
  const rename = metaChanges.find((c) => c.field === 'templateName')
  if (rename) parts.push(`Renamed "${rename.before}" → "${rename.after}"`)
  const otherMeta = metaChanges.filter((c) => c.field !== 'templateName').map((c) => c.label)
  if (otherMeta.length) parts.push(`Changed ${listLabels(otherMeta)}`)
  if (ruleChanges.length) parts.push('AI rules updated')
  if (headers) parts.push(headerSummary(headers))
  if (visibility !== null) parts.push(visibility ? 'made visible' : 'hidden')
  return { action: 'template_update', detail: { ...base, summary: parts.join(' · ') } }
}
