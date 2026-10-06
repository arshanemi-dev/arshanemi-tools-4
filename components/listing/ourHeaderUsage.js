// Where an Our Header is already in use — the facts behind the "already
// mapped" warning shown before one is deleted (HeaderMappingSection.jsx;
// gathered by BulkTemplateDesign.jsx's checkHeaderUsage). Plain functions,
// no React.
//
// A header can be in use in three places:
//  - saved templates: their fields are copies made from Our Headers. A field
//    is this header's when it carries its id (`ourHeaderId`, kept on fields
//    saved by the mapping page), or simply has the same name — the only link
//    an older field has, and the one Auto Listing itself goes by when it
//    carries a product's details from one template to another.
//  - saved Mapping / Place rules, which point at it by id.
//  - the mapping on screen right now, not saved yet.

const norm = (s) => String(s ?? '').trim().toLowerCase()

// `sources`: { templates: [{ templateName, headers: [{ label, ourHeaderId }] }],
//              rules: [{ name, entries: [{ ourHeaderId }] }],
//              mappedHeaders: the page's mapped list }
// → { templates: [name…], rules: [name…], mappedHere: boolean }
export function findHeaderUsage(header, { templates = [], rules = [], mappedHeaders = [] } = {}) {
  const key = norm(header.label)
  const isThis = (id, label) => id === header.id || (!!key && norm(label) === key)
  return {
    templates: templates
      .filter((t) => (t.headers || []).some((h) => isThis(h.ourHeaderId, h.label)))
      .map((t) => t.templateName || 'Untitled template'),
    rules: rules
      .filter((r) => (r.entries || []).some((e) => e.ourHeaderId === header.id))
      .map((r) => r.name || 'Unnamed rule'),
    mappedHere: mappedHeaders.some((m) => (m.sheetHeaders || []).length > 0 && isThis(m.ourHeaderId, m.ourHeaderLabel)),
  }
}

export function isHeaderUsed(usage) {
  return !!usage && (usage.templates.length > 0 || usage.rules.length > 0 || usage.mappedHere)
}

export function listNames(names, max = 3) {
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')}, +${names.length - max} more`
}

// "3 templates (A, B, C), 1 saved rule (R) and this page's mapping" — '' when unused.
export function describeHeaderUsage(usage) {
  if (!isHeaderUsed(usage)) return ''
  const parts = []
  if (usage.templates.length) parts.push(`${usage.templates.length} template${usage.templates.length === 1 ? '' : 's'} (${listNames(usage.templates)})`)
  if (usage.rules.length) parts.push(`${usage.rules.length} saved rule${usage.rules.length === 1 ? '' : 's'} (${listNames(usage.rules)})`)
  if (usage.mappedHere) parts.push("this page's mapping")
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]
}
