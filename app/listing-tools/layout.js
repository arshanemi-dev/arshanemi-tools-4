import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { IS_CONNECT } from '@/lib/connect'
import { ToastProvider } from '@/components/admin/Toast'
import SessionManager from '@/components/admin/SessionManager'
import ListingToolsSidebar from '@/components/listing/ListingToolsSidebar'
import ListingToolsHeader from '@/components/listing/ListingToolsHeader'

export const metadata = {
  title: 'Listing Tools — Arshanemi',
  robots: { index: false },
}

export default async function ListingToolsLayout({ children }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('arshanemi-token')?.value || cookieStore.get('admin-token')?.value
  const payload = token ? await verifyToken(token) : null

  if (!payload) redirect('/login')

  // Billing, template history and per-user assignment all need a real hub
  // user id, which only exists when this app is reached through the admin
  // panel's SSO handoff — see plan Decision #2. Standalone/local-login
  // sessions get a clear notice instead of a broken half-working feature.
  if (!IS_CONNECT) {
    return (
      <ToastProvider>
        <div className="flex h-screen items-center justify-center bg-background px-6 text-center">
          <div className="max-w-sm">
            <h1 className="text-lg font-bold text-foreground">Connect via the Admin Panel</h1>
            <p className="mt-2 text-sm text-muted">
              Listing Tools is only available when this app is opened through the Arshanemi admin
              panel. Sign in there and launch Listing Tools from your dashboard.
            </p>
          </div>
        </div>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <SessionManager />
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <ListingToolsHeader name={payload.name} email={payload.email} />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ListingToolsSidebar role={payload.role} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </ToastProvider>
  )
}
