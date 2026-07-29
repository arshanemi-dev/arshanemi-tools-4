import { NextResponse } from 'next/server'
import { clearAuthCookie, ADMIN_COOKIE } from '@/lib/auth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  // master_admin gets a second 'admin-token' cookie at login/refresh
  // (see makeAuthCookie callers) — clear both or a master_admin session
  // survives its own logout until that cookie's maxAge runs out.
  res.cookies.set(clearAuthCookie())
  res.cookies.set({ ...clearAuthCookie(), name: ADMIN_COOKIE })
  return res
}
