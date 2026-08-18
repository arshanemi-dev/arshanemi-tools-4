import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { fetchTemplateSettingsAllowed } from '@/lib/listingTemplateAccess'

// Covers list/new/[templateId]/[templateId]/details — every route under
// template-settings/ — in one place, same pattern as
// app/listing-tools/template-access/page.js's own master_admin gate. This
// section's sidebar link is already hidden from anyone not granted; this
// adds the same check server-side so typing the URL directly can't bypass
// it.
//
// A missing payload here is deliberately NOT a redirect: it can mean either
// "genuinely signed out" or "signed in via the hub's SSO handoff, cookie
// not set yet" (see app/listing-tools/layout.js) — those are
// indistinguishable server-side, so this only blocks when we positively
// know a session exists and lacks permission. A real guest's page-level API
// calls still 401 and surface the shared login-required modal instead.
export default async function TemplateSettingsLayout({ children }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('barmeto-token')?.value || cookieStore.get('admin-token')?.value
  const payload = token ? await verifyToken(token) : null

  if (payload && payload.role !== 'master_admin') {
    const allowed = await fetchTemplateSettingsAllowed(token, payload.role)
    if (!allowed) redirect('/listing-tools')
  }

  return children
}
