import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import TemplateLogsView from '@/components/listing/template-logs/TemplateLogsView'

export const metadata = {
  title: 'Template Logs — Listing Tools',
  robots: { index: false },
}

// master_admin only — the sidebar link is already hidden from everyone else
// (ListingToolsSidebar.jsx); this blocks typing the URL directly. Same
// missing-payload rule as template-settings/layout.js: no cookie can just
// mean an SSO handoff whose cookie isn't set yet, so only a session we
// positively know is non-master gets redirected. The hub scopes the data
// itself too — a non-master caller only ever gets their own log rows.
export default async function TemplateLogsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('barmeto-token')?.value || cookieStore.get('admin-token')?.value
  const payload = token ? await verifyToken(token) : null

  if (payload && payload.role !== 'master_admin') redirect('/listing-tools')

  return <TemplateLogsView />
}
