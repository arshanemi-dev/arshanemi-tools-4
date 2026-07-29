import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getNavForRole, getLandingPageForRole } from '@/lib/permissions'

// Backend source of truth for the settings sidebar: any authenticated role
// gets back only the nav groups/items it's allowed to see, plus where it
// should land. Sidebar.jsx fetches this on mount instead of hardcoding nav
// arrays client-side; settings/layout.js and settings/page.js call the same
// lib/permissions.js helpers directly (no extra request) so all three agree.
export async function GET(req) {
  const payload = await getUserFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = payload.role
  const res = NextResponse.json({
    role,
    name: payload.name,
    nav: getNavForRole(role),
    landingPage: getLandingPageForRole(role),
  })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
