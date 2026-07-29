import { redirect, notFound } from 'next/navigation'
import { headers, cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { isPathAllowed, getLandingPageForRole } from '@/lib/permissions'
import Sidebar from '@/components/admin/Sidebar'
import Topbar from '@/components/admin/Topbar'
import { ToastProvider } from '@/components/admin/Toast'
import SessionManager from '@/components/admin/SessionManager'

export const metadata = {
  title: 'Admin — Arshanemi',
  robots: { index: false },
}

export default async function AdminLayout({ children }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  // Login page: render children only — no shell, no redirect loop
  if (pathname === '/settings/login') {
    return <ToastProvider>{children}</ToastProvider>
  }

  const cookieStore = await cookies()
  const token = cookieStore.get('admin-token')?.value || cookieStore.get('arshanemi-token')?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) redirect('/settings/login')

  const role = payload.role

  // Plain 'user' role has no admin shell at all — their whole account
  // experience lives at the public /profile page (main dashboard header),
  // not inside /settings. Bounce them out before any of the allowlist
  // checks below even run.
  if (role === 'user') redirect('/profile')

  // Every role below master_admin only gets a fixed slice of the panel.
  // Landing on the bare dashboard sends them to their own home page; any
  // other page outside their allowlist is a 404 — they're logged in, just
  // not permitted here, so a login redirect would be the wrong signal.
  if (role !== 'master_admin') {
    if (pathname === '/settings') redirect(getLandingPageForRole(role))
    if (!isPathAllowed(pathname, role)) notFound()
  }

  return (
    <ToastProvider>
      <SessionManager />
      {/* Fixed full-viewport shell — nothing outside this scrolls */}
      <div className="flex h-screen overflow-hidden bg-surface">
        <Sidebar role={role} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar username={payload.name} email={payload.email} role={role} />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8 max-w-screen-2xl">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
