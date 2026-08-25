'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

// Static dark sidebar — the only nav this app has now that the local
// /settings admin shell is gone. These first four items (their index
// positions 0/1/2 drive the dropdown-vs-plain-link rendering below, so they
// must stay first) are shown to every account that reaches /listing-tools at
// all. "Template Settings" is appended only when the viewer is master_admin
// or has been individually granted access (see app/listing-tools/layout.js's
// templateSettingsAllowed prop, backed by app/listing-tools/template-settings/layout.js's
// server-side gate). "Template Access" is appended only for master_admin,
// backing app/listing-tools/template-access/page.js which enforces the same
// gate server-side for anyone who types the URL directly.
const BASE_NAV_ITEMS = [
  { href: '/listing-tools', label: 'Auto Listing' ,templateNav:`auto-details`},
  { href: '/listing-tools/product-details', label: 'Product Details',templateNav:`product-details` },
  { href: '/listing-tools/brand-details', label: 'Brand Details',templateNav:`brand-details` },
  { href: '/listing-tools/templates', label: 'Choose Your template',templateNav:`templates` },
  { href: '/listing-tools/history', label: 'History' },
]

const TEMPLATE_SETTINGS_ITEM = { href: '/listing-tools/template-settings', label: 'Template Settings' }
const TEMPLATE_ACCESS_ITEM = { href: '/listing-tools/template-access', label: 'Template Access' }

export default function ListingToolsSidebar({ role, templateSettingsAllowed }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [myTemplates, setMyTemplates] = useState([])
  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(role === 'master_admin' || templateSettingsAllowed ? [TEMPLATE_SETTINGS_ITEM] : []),
    ...(role === 'master_admin' ? 
      [
        // TEMPLATE_ACCESS_ITEM
      ]
      
      : []),
  ]

  // "My Template" checkboxes on Choose Your Template (app/listing-tools/templates/page.js)
  // save into this same per-user selection — refetched on every mount, i.e.
  // every full page reload. Shown whenever non-empty, on every page — "if
  // any template exist then open", not gated by which page you're on.
  useEffect(() => {
    let cancelled = false
    fetch('/api/listing-tools/assignments/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => { if (!cancelled) setMyTemplates(data.templates || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const isActive = (href) => (href === '/listing-tools' ? pathname === '/listing-tools' : pathname.startsWith(href))
  // Which of the three dropdown-driven group pages (Auto Listing, Product Details, Brand
  // Details) the viewer is currently on, and which template's ?template= is open there — drives
  // the indigo "currently open" highlight below, on both the group label and its matching
  // template link. Previously this only ever recognized Product Details' own path, so opening a
  // template from Brand Details (or Auto Listing itself) never highlighted anything even
  // though a real template was open.
  const GROUP_PATHS = { '/listing-tools/auto-details': 'auto-details', '/listing-tools/product-details': 'product-details', '/listing-tools/brand-details': 'brand-details' }
  const activateTemplateNav = GROUP_PATHS[pathname] || null
  const activeTemplateId = activateTemplateNav ? searchParams.get('template') : null

  return (
    <aside className="w-48 flex-shrink-0 h-full bg-background flex flex-col overflow-y-auto py-5
      [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent
      [&::-webkit-scrollbar-thumb]:bg-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full">
      <nav className="flex flex-col">
        {navItems.map((item, i) =>
          i === 0|| i === 1|| i === 2 ? (
            // "Auto Listing" is a dropdown label only — it never navigates
            // anywhere itself, it just introduces the template list below it.
            <div key={item.href}>
              <div className={`px-5 py-2 text-[15px] font-semibold mb-1 transition-colors ${
                item.templateNav === activateTemplateNav ? 'text-accent-light bg-gray-100' : 'text-foreground/75'
              }`}>{item.label}</div>
              {myTemplates.length > 0 && (
                <ul className="pb-2">
                  {myTemplates.map((t) => (
                    <li key={t.templateId}>
                      <Link
                        href={`/listing-tools/${item.templateNav}?template=${t.templateId}`}
                        className={`flex items-center gap-2 pl-7 pr-5 py-1.5 text-[13px] transition-colors ${
                          t.templateId === activeTemplateId&&item.templateNav === activateTemplateNav ? 'text-accent-light font-bold border-r-3' : 'text-foreground/55 hover:text-foreground'
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
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-5 py-2.5 text-[13.5px] font-medium transition-colors ${
                isActive(item.href) ? 'bg-accent/15 text-accent-light' : 'text-foreground/75 hover:text-foreground hover:bg-foreground/5'
              }`}
            >
              {item.label}
            </Link>
          )
        )}
      </nav>
    </aside>
  )
}
