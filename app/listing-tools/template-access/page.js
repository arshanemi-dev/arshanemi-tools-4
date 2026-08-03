import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import TemplateAccessPanel from '@/components/listing/TemplateAccessPanel'

export const metadata = {
  title: 'Template Access — Listing Tools',
  robots: { index: false },
}

// master_admin only. The parent layout already bounces unauthenticated
// sessions to /login; this adds the role check on top of that so
// admin/user accounts can't reach this by typing the URL — the sidebar
// link is already hidden from them (ListingToolsSidebar.jsx).
export default async function TemplateAccessPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('arshanemi-token')?.value || cookieStore.get('admin-token')?.value
  const payload = token ? await verifyToken(token) : null

  if (payload?.role !== 'master_admin') redirect('/listing-tools')

  return (
    <div className="min-h-full bg-gray-50">
      <TemplateAccessPanel />
    </div>
  )
}
