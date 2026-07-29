'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { NAV_ICONS } from './navIcons'

// Nav groups are no longer hardcoded here — they come from the backend
// (GET /api/auth/permissions, backed by lib/permissions.js) so a route this
// session isn't allowed to see is never fetched, let alone rendered.
export default function Sidebar({ role = 'master_admin' }) {
  const pathname = usePathname()
  const [nav, setNav] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/permissions', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { nav: [] }))
      .then((data) => { if (!cancelled) setNav(data.nav || []) })
      .catch(() => { if (!cancelled) setNav([]) })
    return () => { cancelled = true }
  }, [role])

  const isActive = (href) => {
    if (href === '/settings') return pathname === '/settings'
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-60 flex-shrink-0 h-full bg-accent flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-accent-hover flex-shrink-0">
        <Link href="/settings" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Arshanemi</p>
            <p className="text-white/50 text-[11px]">Settings</p>
          </div>
        </Link>
      </div>

      {/* Nav — only this div scrolls */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4
        [&::-webkit-scrollbar]:w-1
        [&::-webkit-scrollbar-track]:transparent
        [&::-webkit-scrollbar-thumb]:bg-white/30
        [&::-webkit-scrollbar-thumb]:rounded-full">
        {nav === null && (
          <div className="space-y-2 px-2 animate-pulse" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 rounded-lg bg-white/10" />
            ))}
          </div>
        )}

        {nav?.map((group, gi) => (
          <div key={group.label ?? gi}>
            {group.label && (
              <p className="text-white/40 text-[10px] font-semibold tracking-widest uppercase px-2 mb-1">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = NAV_ICONS[item.icon]
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all group ${
                        active
                          ? 'bg-white/15 text-white shadow-sm'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                      <span className="flex-1 truncate">{item.label}</span>
                      {active && <ChevronRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
