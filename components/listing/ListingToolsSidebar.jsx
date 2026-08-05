'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

// Static dark sidebar — the only nav this app has now that the local
// /settings admin shell is gone. Every account that reaches /listing-tools
// at all (any authenticated role, gated by the layout) sees these five
// items; "Template Access" is appended only for master_admin (see role prop
// below), backing app/listing-tools/template-access/page.js which enforces
// the same gate server-side for anyone who types the URL directly.
const NAV_ITEMS = [
  { href: '/listing-tools', label: 'Auto Listing' ,templateNav:`auto-details`},
  { href: '/listing-tools/product-details', label: 'Product Details',templateNav:`product-details` },
  { href: '/listing-tools/prefill-details', label: 'Prefill Details',templateNav:`prefill-details` },
  { href: '/listing-tools/templates', label: 'Choose Your template',templateNav:`templates` },
  { href: '/listing-tools/template-settings', label: 'Template Settings'},
]

const MASTER_ADMIN_NAV_ITEMS = [
  // { href: '/listing-tools/template-access', label: 'Template Access' },
]

export default function ListingToolsSidebar({ role }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [myTemplates, setMyTemplates] = useState([])
  const navItems = role === 'master_admin' ? [...NAV_ITEMS, ...MASTER_ADMIN_NAV_ITEMS] : NAV_ITEMS

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
  // Destination is the Product Details page's single-template scoped view
  // (?template=), not Choose Your Template's stacked [templateId] page —
  // picking a template here opens one tab at a time, first tab selected.
  const activeTemplateId = pathname === '/listing-tools/product-details' ? searchParams.get('template') : null;
  const activateTemplateNav=pathname === '/listing-tools/product-details' ? 'product-details' : pathname === '/listing-tools/prefill-details' ? 'prefill-details' : pathname === '/listing-tools/templates' ? 'templates' : null;
console.log(activateTemplateNav,activeTemplateId)
  return (
    <aside className="w-48 flex-shrink-0 h-full bg-[#0a0a0a] flex flex-col overflow-y-auto py-5
      [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent
      [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
      <nav className="flex flex-col">
        {navItems.map((item, i) =>
          i === 0|| i === 1|| i === 2 ? (
            // "Auto Listing" is a dropdown label only — it never navigates
            // anywhere itself, it just introduces the template list below it.
            <div key={item.href}>
              <div className="px-5 py-2.5 text-[15px] font-semibold mb-1 text-white/75">{item.label}</div>
              {myTemplates.length > 0 && (
                <ul className="pb-2">
                  {myTemplates.map((t) => (
                    <li key={t.templateId}>
                      <Link
                        href={`/listing-tools/${item.templateNav}?template=${t.templateId}`}
                        className={`flex items-center gap-2 pl-7 pr-5 py-1.5 text-[13px] transition-colors ${
                          t.templateId === activeTemplateId&&item.templateNav === activateTemplateNav ? 'text-emerald-400 font-medium' : 'text-white/55 hover:text-white'
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
                isActive(item.href) ? 'bg-black text-white' : 'text-white/75 hover:text-white hover:bg-white/5'
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
