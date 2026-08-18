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
/**
 * Detects if the code is executing inside an iframe browser context.
 */
/**
 * Safely checks if the code is executing inside an iframe browser context.
 */
export function isIframe() {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch (e) {
    // Cross-origin restrictions on window.top indicate an iframe context
    return true
  }
}

/**
 * Returns the target login URL based on context (Iframe vs Direct Navigation).
 */
export function getLoginUrl() {
  // 1. SSR / Server-side fallback (Must come first to prevent window errors)
  if (typeof window === 'undefined') {
    return '/login'
  }

  const inIframe = isIframe()

  // 2. Iframe context: Redirect to admin login URL ONLY if actually inside an iframe AND IS_CONNECT is true
  if (inIframe && IS_CONNECT && ADMIN_URL) {
    return `${ADMIN_URL}/login`
  }

  // 3. Direct browser navigation: Local login with current page redirect
  const next = window.location.pathname + window.location.search
  return `/login${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`
}

/**
 * Executes the login redirection.
 * Breaks out of iframe using window.top when embedded.
 */
export function redirectToLogin() {
  if (typeof window === 'undefined') return

  const targetUrl = getLoginUrl()

  // Frame breaker: If in an iframe, redirect the top parent window
  if (isIframe()) {
    window.top.location.href = targetUrl
  } else {
    window.location.href = targetUrl
  }
}
