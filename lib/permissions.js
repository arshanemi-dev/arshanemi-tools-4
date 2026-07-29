// Single source of truth for "which role can reach which /settings route."
// Server-only — imported by the settings layout guard, the settings
// dashboard, and the /api/auth/permissions route. Never import this from a
// 'use client' component; it's the backend side of what used to be two
// separate hardcoded arrays (Sidebar.jsx's nav groups + layout.js's
// ALLOWED_PREFIXES). Icons are string names (not components) so this stays
// JSON-serializable for the API route.
//
// This app's nav is intentionally scoped down (see Sidebar.jsx history) to
// Companies/Users/Theme/Profile — the rest of the full CMS nav (and the
// tools catalog / per-user tools access screens) from the root
// arshanemi-admin-pannels app doesn't apply here.

export const NAV_CONFIG = [
  {
    label: 'COMPANIES & USERS',
    items: [
      { key: 'companies', label: 'Companies', href: '/settings/companies', icon: 'Building2', roles: ['master_admin'], quickAction: true },
      { key: 'users', label: 'Users', href: '/settings/users', icon: 'Users', roles: ['master_admin', 'admin'], quickAction: true },
    ],
  },
  {
    label: 'SITE CONFIG',
    items: [
      { key: 'theme', label: 'Theme Settings', href: '/settings/theme', icon: 'Palette', roles: ['master_admin'] },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      // Plain 'user' role never sees this nav (no sidebar) and is bounced
      // straight to the public /profile page instead — see
      // getLandingPageForRole below and app/settings/layout.js.
      { key: 'profile', label: 'My Profile', href: '/settings/profile', icon: 'UserCircle', roles: ['master_admin', 'admin'] },
    ],
  },
]

function filterItem(item, role) {
  return item.roles.includes(role)
}

export function getNavForRole(role) {
  return NAV_CONFIG
    .map((group) => ({ ...group, items: group.items.filter((item) => filterItem(item, role)) }))
    .filter((group) => group.items.length > 0)
}

export function getAllowedHrefsForRole(role) {
  return getNavForRole(role).flatMap((group) => group.items.map((item) => item.href))
}

export function isPathAllowed(pathname, role) {
  if (role === 'master_admin') return true
  return getAllowedHrefsForRole(role).some((href) => href !== '/settings' && pathname.startsWith(href))
}

export function getLandingPageForRole(role) {
  if (role === 'master_admin') return '/settings'
  // Plain 'user' has no /settings surface at all — their whole account
  // experience is the public /profile page (main dashboard header, not the
  // admin shell). See app/settings/layout.js and app/profile/page.js.
  if (role === 'user') return '/profile'
  const hrefs = getAllowedHrefsForRole(role).filter((href) => href !== '/settings')
  return hrefs[0] || '/settings/profile'
}
