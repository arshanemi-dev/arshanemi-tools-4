'use client'
import { useEffect, useState } from 'react'
import { isLoggedIn, authFetch } from '@/lib/tokenStore'
import ListingToolsSidebar from './ListingToolsSidebar'
import DashboardTopbar from '@/components/dashboard/DashboardTopbar'

// Reconciles the server-rendered session (app/listing-tools/layout.js reads
// an httpOnly cookie, which a cross-app SSO handoff visitor doesn't have
// yet — their token only exists in a URL param at that point, see
// lib/tokenHandoff.js) with the real client-side one once that handoff has
// had a chance to run. Without this, an SSO-handed-off visitor would be
// stuck seeing a "Log in" topbar and no role-gated nav items even though
// every data call on the page is already correctly authenticated
// (SessionManager attaches the Bearer token to those automatically).
export default function ListingToolsShell({ initialUser, initialTemplateSettingsAllowed, headerHidden, children }) {
  const [user, setUser] = useState(initialUser)
  const [templateSettingsAllowed, setTemplateSettingsAllowed] = useState(initialTemplateSettingsAllowed)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    if (initialUser || !isLoggedIn()) return

    authFetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.email) setUser({ name: data.name, email: data.email, role: data.role }) })
      .catch(() => {})

    authFetch('/api/listing-tools/template-access/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setTemplateSettingsAllowed(!!data.allowed) })
      .catch(() => {})
  }, [initialUser])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {!headerHidden && <DashboardTopbar user={user} onMenuClick={() => setNavOpen(true)} />}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ListingToolsSidebar
          role={user?.role}
          templateSettingsAllowed={templateSettingsAllowed}
          mobileOpen={navOpen}
          onClose={() => setNavOpen(false)}
        />
        <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
      </div>
    </div>
  )
}
