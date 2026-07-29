import Link from 'next/link'

// Dummy dev-only index of every page currently in this app — quick
// navigation while the app is this small. Not linked from anywhere.
export const metadata = {
  title: 'Listing Tools — Arshanemi',
  robots: { index: false },
}

const PAGE_GROUPS = [
  {
    label: 'Public',
    pages: [
      { href: '/login', label: 'Login' },
      { href: '/forgot-password', label: 'Forgot Password' },
      { href: '/reset-password', label: 'Reset Password' },
      { href: '/profile', label: 'Profile' },
    ],
  },
  {
    label: 'Settings',
    pages: [
      { href: '/settings', label: 'Dashboard' },
      { href: '/settings/companies', label: 'Companies' },
      { href: '/settings/users', label: 'Users' },
      { href: '/settings/theme', label: 'Theme' },
      { href: '/settings/profile', label: 'Profile' },
      { href: '/settings/login', label: 'Login (OTP)' },
    ],
  },
]

export default function ListingToolsPage() {
  return (
    <div className="min-h-screen bg-background px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Listing Tools</h1>
          <p className="mt-2 text-sm text-muted">Every page currently in this app, for quick navigation.</p>
        </header>

        {PAGE_GROUPS.map((group) => (
          <section key={group.label} className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-subtle">
              {group.label}
            </h2>
            <ul className="divide-y divide-divider rounded-2xl border border-divider bg-card/40">
              {group.pages.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    className="flex items-center justify-between px-5 py-4 text-sm font-medium text-foreground transition-colors hover:bg-card-hover"
                  >
                    {p.label}
                    <span className="text-xs text-subtle">{p.href}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
