'use client'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import AutoListingRow from '@/components/listing/AutoListingRow'

export default function AutoListingPage() {
  const [templates, setTemplates] = useState(null)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    fetch('/api/listing-tools', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      // A template stays out of Auto Listing until it's explicitly marked
      // ready from the Template Settings list (isAllowedToShow, off by
      // default) — this page is for filling in real product data, not for
      // browsing templates that are still being set up.
      .then((data) => setTemplates((data.templates || []).filter((t) => t.isAllowedToShow)))
      .catch(() => setTemplates([]))
  }, [])

  const filtered = (templates || []).filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return t.templateName.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
  })

  return (
    <div className="min-h-[70vh] bg-surface px-6 py-6">
      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-card-hover rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-light"
        />
      </div>

      <div className="border border-divider rounded-lg overflow-hidden bg-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-card border-b border-divider">
              <th className="px-4 py-2.5 text-left font-semibold text-foreground w-40">My Template</th>
              <th className="px-4 py-2.5 text-left font-semibold text-foreground">Template Name</th>
              <th className="px-4 py-2.5 text-left font-semibold text-foreground">Description</th>
              <th className="px-4 py-2.5 text-right font-semibold text-foreground w-36">Expand</th>
            </tr>
          </thead>
          <tbody>
            {templates === null && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-subtle">Loading…</td></tr>
            )}
            {templates !== null && filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-subtle">No templates yet — create one to get started.</td></tr>
            )}
            {filtered.map((t) => (
              <AutoListingRow
                key={t.id}
                template={t}
                expanded={expandedId === t.id}
                onToggle={() => setExpandedId((id) => (id === t.id ? null : t.id))}
                onDeleted={() => setTemplates((prev) => prev.filter((x) => x.id !== t.id))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
