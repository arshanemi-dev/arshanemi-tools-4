// Lightweight pub-sub bridging non-React code (SessionManager's patched
// window.fetch, lib/tokenStore.js's authFetch) to the React-rendered
// LoginRequiredModal (mounted once via components/auth/AuthGateProvider).
// Neither call site lives inside a component, so a plain React context
// can't reach them — this is the smallest thing that can.
let listeners = []

export function onAuthRequired(listener) {
  listeners.push(listener)
  return () => { listeners = listeners.filter((l) => l !== listener) }
}

export function requireLogin() {
  listeners.forEach((listener) => listener())
}

const IS_CONNECT = process.env.NEXT_PUBLIC_IS_CONNECT === 'true'
const ADMIN_URL = (process.env.NEXT_PUBLIC_ADMIN_API_URL || '').replace(/\/$/, '')

// Where the "Login" affordance should send the visitor. Connected mode
// (this app reached through the hub's SSO handoff) has no working local
// account for that session to sign back into — send them to the hub's own
// /login instead. Standalone mode keeps this app's own /login form, with a
// ?next= back to wherever they were.
export function getLoginUrl() {
  if (IS_CONNECT && ADMIN_URL) return `${ADMIN_URL}/login`
  if (typeof window === 'undefined') return '/login'
  const next = window.location.pathname + window.location.search
  return `/login${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`
}

// Every "Login" affordance in this app (the shared modal, the guest topbar
// button) should navigate through this, not build its own href — keeps the
// IS_CONNECT branching in exactly one place.
export function redirectToLogin() {
  if (typeof window !== 'undefined') window.location.href = getLoginUrl()
}
