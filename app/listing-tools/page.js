'use client'
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import AutoListingRow from '@/components/listing/AutoListingRow'
import DataTable, { PlainTh } from '@/components/listing/DataTable'
import useTableView from '@/components/listing/useTableView'

const NO_TEMPLATES = []

// What each cell shows — what its column sorts and filters on (tools-5's
// table — DataTable). The expand toggle and View Details have no filter.
const COLUMNS = [
  { key: 'name', label: 'Template Name', text: (t) => t.templateName || '' },
  { key: 'description', label: 'Description', text: (t) => t.description || '' },
]

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

  const filtered = useMemo(() => (templates || NO_TEMPLATES).filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return t.templateName.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
  }), [templates, search])
  const table = useTableView(filtered, COLUMNS)

  return (
    <div className="min-h-[70vh] bg-surface px-4 sm:px-6 py-6">
      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-card-hover rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-light"
        />
      </div>

      <DataTable
        table={table}
        columns={COLUMNS}
        lead={<PlainTh>My Template</PlainTh>}
        trail={<PlainTh>Expand</PlainTh>}
        colSpan={COLUMNS.length + 2}
        loading={templates === null}
        empty={search.trim() ? 'No templates match your search.' : 'No templates yet — create one to get started.'}
        noMatch={search.trim() ? 'No templates match your search or filters.' : 'No templates match the current filters.'}
        noun="template"
        scrollClass="max-h-[80vh]"
      >
        {table.pageRows.map((t) => (
          <AutoListingRow
            key={t.id}
            template={t}
            expanded={expandedId === t.id}
            onToggle={() => setExpandedId((id) => (id === t.id ? null : t.id))}
            onDeleted={() => setTemplates((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </DataTable>
    </div>
  )
}
