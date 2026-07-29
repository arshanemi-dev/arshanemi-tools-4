import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getUserFromCookies } from '@/lib/auth'
import { getNavForRole } from '@/lib/permissions'
import { NAV_ICONS } from '@/components/admin/navIcons'

// Section colors cycle by group index — presentation-only, so it stays out
// of lib/permissions.js (which only knows about roles/hrefs, not styling).
const SECTION_COLORS = [
  'bg-violet-50 text-violet-600',
  'bg-orange-50 text-orange-600',
  'bg-blue-50 text-blue-600',
]

export default async function DashboardPage() {
  const payload = await getUserFromCookies()
  const role = payload?.role || 'master_admin'
  const groups = getNavForRole(role).filter((g) => g.label && g.label !== 'ACCOUNT')
  const quickLinks = getNavForRole(role)
    .flatMap((g) => g.items)
    .filter((item) => item.quickAction)

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Welcome back!</h2>
        <p className="text-subtle mt-1 text-sm">
          Manage your website content from the sections below.
        </p>
      </div>

      {/* Quick actions */}
      {quickLinks.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {quickLinks.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                i === 0
                  ? 'bg-accent hover:bg-accent-hover text-white'
                  : 'bg-card hover:bg-surface text-muted border border-divider'
              }`}
            >
              {link.label}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ))}
        </div>
      )}

      {/* One card grid per authorized nav group */}
      {groups.map((group, gi) => (
        <div key={group.label}>
          <h3 className="text-sm font-semibold text-subtle uppercase tracking-wider mb-4">
            {group.label}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {group.items.map((item) => {
              const Icon = NAV_ICONS[item.icon]
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="bg-card rounded-xl border border-divider p-5 hover:shadow-md hover:border-accent/30 transition-all group"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${SECTION_COLORS[gi % SECTION_COLORS.length]}`}>
                    {Icon && <Icon className="w-5 h-5" />}
                  </div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                    {item.label}
                  </p>
                  <p className="text-xs text-subtle mt-0.5 flex items-center gap-1">
                    Manage <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
