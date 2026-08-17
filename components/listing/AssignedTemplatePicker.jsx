'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// Landing state for Product Details / Prefill Details before a template is
// picked — the exact same list + endpoint as the "Auto Listing" sidebar
// dropdown (ListingToolsSidebar.jsx, /api/listing-tools/assignments/me),
// same plain dot-bullet style, deliberately NOT a Choose Your Template-style
// card/table. Nothing else loads until a template here is clicked; clicking
// sets ?template= on basePath, which switches that page into its scoped view.
export default function AssignedTemplatePicker({ basePath }) {
  const [templates, setTemplates] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/listing-tools/assignments/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => { if (!cancelled) setTemplates(data.templates || []) })
      .catch(() => { if (!cancelled) setTemplates([]) })
    return () => { cancelled = true }
  }, [])

  if (templates === null) {
    return (
      <div className="min-h-[70vh] bg-surface px-6 py-6">
        <p className="text-[13px] text-subtle">Loading…</p>
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <div className="min-h-[70vh] bg-surface px-6 py-6">
        <p className="text-[13px] text-subtle">
          No templates assigned yet. Go to{' '}
          <Link href="/listing-tools/templates" className="text-accent hover:underline">Choose Your template</Link>{' '}
          to pick one.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] bg-surface px-6 py-6">
      <ul className="space-y-1">
        {templates.map((t) => (
          <li key={t.templateId}>
            <Link
              href={`${basePath}?template=${t.templateId}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] font-medium text-muted hover:bg-card hover:shadow-sm transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
              <span className="truncate">{t.templateName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
