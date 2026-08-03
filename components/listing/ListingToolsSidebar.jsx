'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'

// Static dark sidebar — intentionally separate from
// components/admin/Sidebar.jsx, which is wired to /settings's role-based
// nav config. Every account that reaches /listing-tools at all (any
// authenticated role, gated by the layout) sees these five items; "Template
// Access" is appended only for master_admin (see role prop below), backing
// app/listing-tools/template-access/page.js which enforces the same gate
// server-side for anyone who types the URL directly.
const NAV_ITEMS = [
  { href: '/listing-tools', label: 'Auto Listing' },
  { href: '/listing-tools/design-details', label: 'Design Details' },
  { href: '/listing-tools/prefill-details', label: 'Prefill Details' },
  { href: '/listing-tools/templates', label: 'Choose Your template' },
  { href: '/listing-tools/template-settings', label: 'Template Settings' },
]

const MASTER_ADMIN_NAV_ITEMS = [
  { href: '/listing-tools/template-access', label: 'Template Access' },
]

export default function ListingToolsSidebar({ role }) {
  const pathname = usePathname()
  const params = useParams()
  const [myTemplates, setMyTemplates] = useState([])
  const navItems = role === 'master_admin' ? [...NAV_ITEMS, ...MASTER_ADMIN_NAV_ITEMS] : NAV_ITEMS

  // "My Template" checkboxes on Choose Your Template (app/listing-tools/templates/page.js)
  // save into this same per-user selection — refetched on every mount, i.e.
  // every full page reload, so this list never drifts from what was last
  // saved there. Shown under "Auto Listing" on every /listing-tools page
  // whenever non-empty (pixel-matches source/*.png — no toggle affordance).
  useEffect(() => {
    let cancelled = false
    fetch('/api/listing-tools/assignments/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => { if (!cancelled) setMyTemplates(data.templates || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const isActive = (href) => (href === '/listing-tools' ? pathname === '/listing-tools' : pathname.startsWith(href))
  const activeTemplateId = params?.templateId

  return (
    <aside className="w-48 flex-shrink-0 h-full bg-[#0a0a0a] flex flex-col overflow-y-auto py-5
      [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent
      [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
      <nav className="flex flex-col">
        {navItems.map((item, i) => (
          <div key={item.href}>
            <Link
              href={item.href}
              className={`block px-5 py-2.5 transition-colors ${
                i === 0 ? 'text-[15px] font-semibold mb-1' : 'text-[13.5px] font-medium'
              } ${isActive(item.href) ? 'bg-black text-white' : 'text-white/75 hover:text-white hover:bg-white/5'}`}
            >
              {item.label}
            </Link>

            {i === 0 && myTemplates.length > 0 && (
              <ul className="pb-2">
                {myTemplates.map((t) => (
                  <li key={t.templateId}>
                    <Link
                      href={`/listing-tools/templates/${t.templateId}`}
                      className={`flex items-center gap-2 pl-7 pr-5 py-1.5 text-[13px] transition-colors ${
                        t.templateId === activeTemplateId ? 'text-emerald-400 font-medium' : 'text-white/55 hover:text-white'
                      }`}
                    >
                      <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                      <span className="truncate">{t.templateName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}
