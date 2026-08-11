import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { fetchTemplateSettingsAllowed } from '@/lib/listingTemplateAccess'

// Covers list/new/[templateId]/[templateId]/details — every route under
// template-settings/ — in one place, same pattern as
// app/listing-tools/template-access/page.js's own master_admin gate. The
// parent app/listing-tools/layout.js already bounces unauthenticated
// sessions to /login and hides this section's sidebar link from anyone not
// granted; this adds the same check server-side so typing the URL directly
// can't bypass it.
export default async function TemplateSettingsLayout({ children }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arshanemi-token')?.value || cookieStore.get('admin-token')?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) redirect('/login')

  if (payload.role !== 'master_admin') {
    const allowed = await fetchTemplateSettingsAllowed(token, payload.role)
    if (!allowed) redirect('/listing-tools')
  }

  return children
}
