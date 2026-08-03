'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Plus, Pencil, Trash2, Eye } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import { useToast } from '@/components/admin/Toast'

// Template Settings is the CRUD home for template *definitions* (groups/
// headers/dropdown sources/preset/AI rules) — distinct from Auto Listing
// and Choose Your Template, which are for filling in a template's actual
// product rows. Create and Edit both open the same wizard
// (components/listing/TemplateSettingsWizard.jsx) at
// template-settings/new or template-settings/[templateId]; View Details
// links to the existing per-template workspace page instead of duplicating
// it here.
export default function TemplateSettingsListPage() {
  const { addToast } = useToast()
  const [templates, setTemplates] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/listing-tools', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => setTemplates(data.templates || []))
      .catch(() => setTemplates([]))
  }, [])

  async function handleDelete(template) {
    if (!confirm(`Delete "${template.templateName}"? This can't be undone.`)) return
    const res = await fetch(`/api/listing-tools/${template.id}`, { method: 'DELETE' })
    if (res.ok) {
      addToast('Template deleted', 'success')
      setTemplates((prev) => (prev || []).filter((t) => t.id !== template.id))
    } else {
      addToast('Could not delete template', 'error')
    }
  }

  const filtered = (templates || []).filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return t.templateName.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
  })

  return (
    <div className="min-h-full bg-gray-50 px-6 py-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-lg font-bold text-gray-900">Template Settings</h1>
      </div>
      <p className="text-[13px] text-gray-500 mb-5">
        Create, edit, and delete your Listing Tools template definitions — groups, headers, dropdown sources, export preset, and AI rules.
      </p>

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <Link href="/listing-tools/template-settings/new">
          <PillButton variant="upload" icon={Plus}>Create Template</PillButton>
        </Link>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-white border-b border-gray-200">
              <th className="px-4 py-2.5 text-left font-semibold text-gray-800">Template Name</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-800">Description</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-800 w-48">Marketplace / Category</th>
              <th className="px-4 py-2.5 text-right font-semibold text-gray-800 w-64">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates === null && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
            )}
            {templates !== null && filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No templates yet — create one to get started.</td></tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60">
                <td className="px-4 py-3 text-gray-800 font-medium">{t.templateName}</td>
                <td className="px-4 py-3 text-gray-500">{t.description || '—'}</td>
                <td className="px-4 py-3 text-gray-500">
                  {t.marketplaceName || t.category ? `${t.marketplaceName || '—'} / ${t.category || '—'}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/listing-tools/templates/${t.id}`}>
                      <PillButton variant="view" icon={Eye}>View Details</PillButton>
                    </Link>
                    <Link href={`/listing-tools/template-settings/${t.id}`}>
                      <PillButton variant="edit" icon={Pencil}>Edit</PillButton>
                    </Link>
                    <PillButton variant="delete" icon={Trash2} onClick={() => handleDelete(t)}>Delete</PillButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
