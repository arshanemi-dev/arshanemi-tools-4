// Marketplace tabs for the Template Settings list and the Template Logs
// page — built from the marketplaces the saved templates actually use
// (each template's marketplaceName), not a fixed list, so a marketplace
// appears as soon as its first template is saved. Grouping is
// case-insensitive ("Meesho" / "meesho" are one tab); templates with no
// marketplace set share one trailing "Other" tab so none become unreachable.

export const OTHER_MARKETPLACE_KEY = '__other__'

export function marketplaceKeyOf(template) {
  const name = String(template?.marketplaceName || '').trim()
  return name ? name.toLowerCase() : OTHER_MARKETPLACE_KEY
}

// [{ key, label, marketplace, count, templateIds }] — most templates first
// (ties alphabetical) so the default first tab is the busiest marketplace,
// "Other" always last. `label` is the most common spelling in use;
// `marketplace` is what the Template Logs page matches log details against
// (null for "Other").
export function buildMarketplaceTabs(templates) {
  const groups = new Map()
  for (const t of templates || []) {
    const key = marketplaceKeyOf(t)
    if (!groups.has(key)) groups.set(key, { key, spellings: new Map(), templateIds: [] })
    const g = groups.get(key)
    g.templateIds.push(t.id)
    if (key !== OTHER_MARKETPLACE_KEY) {
      const spelling = t.marketplaceName.trim()
      g.spellings.set(spelling, (g.spellings.get(spelling) || 0) + 1)
    }
  }
  return [...groups.values()]
    .map((g) => {
      const label = g.key === OTHER_MARKETPLACE_KEY ? 'Other' : [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0]
      return {
        key: g.key,
        label,
        marketplace: g.key === OTHER_MARKETPLACE_KEY ? null : label,
        count: g.templateIds.length,
        templateIds: g.templateIds,
      }
    })
    .sort((a, b) => {
      if (a.key === OTHER_MARKETPLACE_KEY) return 1
      if (b.key === OTHER_MARKETPLACE_KEY) return -1
      return b.count - a.count || a.label.localeCompare(b.label)
    })
}

// The chosen tab, or the first one when nothing's chosen yet (the default)
// or the chosen marketplace no longer has any templates.
export function resolveActiveTab(tabs, selectedKey) {
  return tabs.find((t) => t.key === selectedKey) || tabs[0] || null
}
