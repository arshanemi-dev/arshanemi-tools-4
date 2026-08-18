import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { IS_CONNECT } from '@/lib/connect'
import { fetchTemplateSettingsAllowed } from '@/lib/listingTemplateAccess'
import { ToastProvider } from '@/components/admin/Toast'
import ListingToolsShell from '@/components/listing/ListingToolsShell'

export const metadata = {
  title: 'Listing Tools — Barmeto',
  robots: { index: false },
}
const HEADER_HIDDEN = process.env.NEXT_PUBLIC_IS_Header_Hide === 'true'

export default async function ListingToolsLayout({ children }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('barmeto-token')?.value || cookieStore.get('admin-token')?.value
  const payload = token ? await verifyToken(token) : null

  // No hard redirect on a missing session: a visitor who arrived via the
  // hub's cross-app SSO handoff (lib/tokenHandoff.js) only has their token
  // in a URL query param at this point — the httpOnly cookie this server
  // check reads doesn't exist yet, and won't until client JS runs. Blocking
  // here used to bounce every SSO-handed-off visitor straight to /login,
  // dropping the handoff params in the process (a plain redirect() doesn't
  // carry the current URL's query string) — forcing a redundant manual
  // login every single time. ListingToolsShell reconciles the real
  // client-side session after mount; any API call that genuinely has no
  // valid session surfaces the shared login-required modal instead of a
  // page redirect (see lib/authGate.js).

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
              Listing Tools is only available when this app is opened through the Barmeto admin
              panel. Sign in there and launch Listing Tools from your dashboard.
            </p>
          </div>
        </div>
      </ToastProvider>
    )
  }

  const templateSettingsAllowed = payload ? await fetchTemplateSettingsAllowed(token, payload.role) : false

  return (
    <ToastProvider>
      <ListingToolsShell
        initialUser={payload ? { name: payload.name, email: payload.email, role: payload.role } : null}
        initialTemplateSettingsAllowed={templateSettingsAllowed}
        headerHidden={HEADER_HIDDEN}
      >
        {children}
      </ListingToolsShell>
    </ToastProvider>
  )
}
