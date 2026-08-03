'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import { useToast } from '@/components/admin/Toast'

export default function ChooseTemplatePage() {
  const { addToast } = useToast()
  const [templates, setTemplates] = useState(null)
  const [mine, setMine] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/listing-tools', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => setTemplates(data.templates || []))
      .catch(() => setTemplates([]))

    fetch('/api/listing-tools/assignments/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => setMine(new Set((data.templates || []).map((t) => t.templateId))))
      .catch(() => setMine(new Set()))
  }, [])

  const filtered = (templates || []).filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return t.templateName.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
  })

  // Full-replace PUT — the hub deletes-then-reinserts this user's whole
  // assignment row, so every toggle sends the complete desired set, not a delta.
  async function toggleMine(template) {
    const wasChecked = mine.has(template.id)
    const next = new Set(mine)
    if (wasChecked) next.delete(template.id)
    else next.add(template.id)
    setMine(next)

    const list = (templates || [])
      .filter((t) => next.has(t.id))
      .map((t) => ({ templateId: t.id, templateName: t.templateName }))

    const res = await fetch('/api/listing-tools/assignments/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates: list }),
    })
    if (!res.ok) {
      setMine(mine) // revert on failure
      addToast('Could not save your template selection', 'error')
    }
  }

  return (
    <div className="min-h-full bg-gray-50 px-6 py-6">
      <div className="relative max-w-md mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-white border-b border-gray-200">
              <th className="px-4 py-2.5 text-left font-semibold text-gray-800 w-40">My Template</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-800">Template Name</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-800">Description</th>
              <th className="px-4 py-2.5 text-right font-semibold text-gray-800 w-36">Expand</th>
            </tr>
          </thead>
          <tbody>
            {(templates === null || mine === null) && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
            )}
            {templates !== null && mine !== null && filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No templates yet.</td></tr>
            )}
            {templates !== null && mine !== null && filtered.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2 text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mine.has(t.id)}
                      onChange={() => toggleMine(t)}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                    />
                    My Template
                  </label>
                </td>
                <td className="px-4 py-3 text-gray-800 font-medium">{t.templateName}</td>
                <td className="px-4 py-3 text-gray-500">{t.description || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/listing-tools/templates/${t.id}`}>
                    <PillButton variant="view">View Details</PillButton>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
