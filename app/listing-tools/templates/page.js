'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Plus, Minus } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import TemplateBadge from '@/components/listing/TemplateBadge'
import { useToast } from '@/components/admin/Toast'

export default function ChooseTemplatePage() {
  const { addToast } = useToast()
  const [templates, setTemplates] = useState(null)
  const [mine, setMine] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/listing-tools', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      // No client-side isAllowedToShow filter here — GET /api/listing-tools
      // already returns exactly the right per-viewer-role set (master_admin:
      // everything unfiltered; admin: itself + its sub-users unconditionally,
      // plus toggled-on master_admin templates; user: itself unconditionally,
      // plus toggled-on admin/master_admin templates). Re-filtering here would
      // wrongly hide an admin's own not-yet-toggled sub-user drafts.
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
    return (
      t.templateName.toLowerCase().includes(q) ||
      (t.finalName || '').toLowerCase().includes(q) ||
      (t.templateNumber || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    )
  })

  // Full-replace PUT — the hub deletes-then-reinserts this user's whole
  // assignment row, so every add/remove sends the complete desired set, not
  // a delta.
  async function syncMine(next) {
    const prev = mine
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
      setMine(prev)
      // A 401 already triggered the shared login-required modal (see
      // lib/authGate.js) — don't also show a generic, unhelpful toast for
      // the same failure.
      if (res.status !== 401) addToast('Could not save your template selection', 'error')
    }
  }
  function addMine(template) {
    if (mine.has(template.id)) return
    syncMine(new Set(mine).add(template.id))
  }
  function removeMine(template) {
    if (!mine.has(template.id)) return
    const next = new Set(mine)
    next.delete(template.id)
    syncMine(next)
  }

  return (
    <div className="min-h-full bg-surface px-6 py-6">
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
              <th className="px-4 py-2.5 text-left font-semibold text-foreground">Template #</th>
              <th className="px-4 py-2.5 text-left font-semibold text-foreground">Template Name</th>
              <th className="px-4 py-2.5 text-left font-semibold text-foreground">Template Final Name</th>
              <th className="px-4 py-2.5 text-left font-semibold text-foreground w-52">My Template</th>
              <th className="px-4 py-2.5 text-left font-semibold text-foreground w-52">All Template</th>
              <th className="px-4 py-2.5 text-left font-semibold text-foreground">Description</th>
              <th className="px-4 py-2.5 text-right font-semibold text-foreground w-36">View Details</th>
            </tr>
          </thead>
          <tbody>
            {(templates === null || mine === null) && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-subtle">Loading…</td></tr>
            )}
            {templates !== null && mine !== null && filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-subtle">No templates yet.</td></tr>
            )}
            {templates !== null && mine !== null && filtered.map((t) => {
              const isMine = mine.has(t.id)
              return (
                <tr key={t.id} className="border-b border-divider last:border-b-0 hover:bg-surface/60">
                  {/* My Template — a badge only appears once you've actually
                      added this template; the − removes it. */}
                  <td className="px-4 py-3">
                    {isMine ? (
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent/15 pl-2.5 pr-1.5 py-1 text-[12px] font-medium text-accent-hover">
                        <span className="truncate">{t.templateName}</span>
                        <button
                          type="button"
                          onClick={() => removeMine(t)}
                          title="Remove from My Template"
                          className="flex-shrink-0 rounded-full p-0.5 text-accent hover:bg-accent/25 hover:text-accent-hover"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </span>
                    ) : (
                      <span className="text-[12px] text-subtle">—</span>
                    )}
                  </td>

                  {/* All Template — every template gets a badge here, always
                      with a + to add it (disabled once it's already mine). */}
                  <td className="px-4 py-3">
                    <span className="inline-flex max-w-full items-center gap-1.5">
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-card-hover pl-2.5 pr-1.5 py-1 text-[12px] font-medium text-muted">
                        <span className="truncate">{t.templateName}</span>
                        <button
                          type="button"
                          onClick={() => addMine(t)}
                          disabled={isMine}
                          title={isMine ? 'Already in My Template' : 'Add to My Template'}
                          className="flex-shrink-0 rounded-full p-0.5 text-subtle hover:bg-card-hover hover:text-muted disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </span>
                      <TemplateBadge badge={t.viewerBadge} />
                    </span>
                  </td>

                  <td className="px-4 py-3 text-subtle">{t.keywords || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/listing-tools/template-settings/${t.id}/details`}>
                      <PillButton variant="view">View Details</PillButton>
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
