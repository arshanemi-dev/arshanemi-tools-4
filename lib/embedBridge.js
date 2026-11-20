// Barmeto hub ↔ tool bridge + PostHog for this tool app. Same file in every
// tool repo (tools/arshanemi-tools-1…5, chrome_link_opener) — keep them in
// sync. The hub's half is components/tools/ToolUseClient.jsx in the admin
// panel repo.
//
// Where a tool can be running (platform()):
//   'embedded' — inside the hub's iframe at www.barmeto.com/tools/{slug}/use/
//                (every tool)
//   'desktop'  — the Link Opener's Windows app (chrome_link_opener/desktop):
//                Electron loads this same site as a top-level window and its
//                preload adds `window.desktop`. No hub here: own login, own
//                PostHog, events tagged platform=desktop + app version.
//   'web'      — opened directly in a browser tab (standalone).
//
// Why: the tools run inside a cross-origin, sandboxed iframe on
// www.barmeto.com/tools/{slug}/use/. From there they
//   - can't navigate the top window (the sandbox has no allow-top-navigation),
//     and can't show the hub's /login inside the frame (the hub sends
//     X-Frame-Options: SAMEORIGIN) — both left sellers on a blank frame or a
//     dead "Log in" button (PostHog recordings, Nov 2026);
//   - are invisible to the hub's PostHog, so nobody could tell whether a
//     seller actually used a tool.
// So, when embedded:
//   requestHubLogin()  → asks the hub to show its own sign-up / login screen
//   track()            → sends the event to the hub, which captures it on the
//                        person it already identified (one person, one funnel)
//   PostHog runs here only to feed session replay to the hub's recording
//   (recordCrossOriginIframes) — no duplicate pageviews/autocapture.
// Opened directly (not embedded), PostHog here works as a normal install.
import posthog from 'posthog-js'

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? 'phc_nLvNhFq4eTb5D6TohxaXyckbLkXPH7PCgDeketwahXM9'
const REGION = process.env.NEXT_PUBLIC_POSTHOG_REGION === 'us' ? 'us' : 'eu'

// Where the hub can be. postMessage with a non-matching targetOrigin is
// silently dropped by the browser, so posting to each is safe: only the real
// parent receives it.
function hubOrigins() {
  const list = ['https://www.barmeto.com', 'https://barmeto.com']
  for (const raw of [process.env.NEXT_PUBLIC_ADMIN_API_URL, process.env.NEXT_PUBLIC_ADMIN_URL]) {
    try { if (raw) list.push(new URL(raw).origin) } catch { /* ignore */ }
  }
  return [...new Set(list)]
}

export function platform() {
  if (typeof window === 'undefined') return 'server'
  if (window.desktop?.isDesktop) return 'desktop'
  return isEmbedded() ? 'embedded' : 'web'
}

export function isEmbedded() {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

function postToHub(message) {
  if (!isEmbedded()) return false
  let sent = false
  for (const origin of hubOrigins()) {
    try { window.parent.postMessage(message, origin); sent = true } catch { /* ignore */ }
  }
  return sent
}

// ── Identity ─────────────────────────────────────────────────────────────
// The hub hands the session over in the iframe URL (lt_u = user JSON) before
// lib/tokenHandoff.js stores it — read the URL first so identify() happens
// even though PostHog initialises before the app's own code runs.
function currentUser() {
  if (typeof window === 'undefined') return null
  try {
    const raw = new URLSearchParams(window.location.search).get('lt_u')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

function signedOutByHub() {
  try { return new URLSearchParams(window.location.search).has('lt_out') } catch { return false }
}

let identifiedId = null
function syncIdentity() {
  if (!posthog.__loaded) return
  try {
    if (signedOutByHub()) {
      if (identifiedId || posthog.get_property?.('$user_state') === 'identified') posthog.reset()
      identifiedId = null
      return
    }
    const user = currentUser()
    if (user?.id && identifiedId !== String(user.id)) {
      identifiedId = String(user.id)
      posthog.identify(identifiedId, { name: user.name, email: user.email })
    }
  } catch { /* ignore */ }
}

// ── Init (called from instrumentation-client.js) ─────────────────────────
let started = false
export function initToolAnalytics({ toolSlug }) {
  if (started || typeof window === 'undefined' || !KEY) return
  started = true
  const where = platform()
  const embedded = where === 'embedded'
  try {
    posthog.init(KEY, {
      api_host: `https://${REGION}.i.posthog.com`,
      ui_host: `https://${REGION}.posthog.com`,
      person_profiles: 'identified_only',
      // Embedded: the hub already records pageviews and clicks for this
      // visit — only replay comes from here.
      autocapture: !embedded,
      capture_pageview: embedded ? false : 'history_change',
      capture_pageleave: !embedded,
      // Never store typed passwords/OTPs. recordCrossOriginIframes: inside
      // the hub's iframe the recording is handed to the hub's own recorder,
      // so the replay on www.barmeto.com shows what happens in the tool.
      session_recording: { maskAllInputs: true, recordCrossOriginIframes: true },
      loaded: (ph) => {
        ph.register({
          tool_slug: toolSlug,
          platform: where,
          embedded,
          ...(where === 'desktop' && window.desktop?.version ? { desktop_version: String(window.desktop.version) } : {}),
        })
        syncIdentity()
      },
    })
  } catch { /* analytics must never break the tool */ }
  toolSlugForEvents = toolSlug
}

let toolSlugForEvents = null

function loggedInNow() {
  try { return !!localStorage.getItem('refresh_token') || !!localStorage.getItem('access_token') } catch { return false }
}

// ── Events ───────────────────────────────────────────────────────────────
// Standard names used across all tools (see the hub's BRIDGED_EVENTS):
//   tool_used           a job starts (upload / generate / export…)
//   links_generated     image links ready (link generator)
//   tool_error          a job or load failed — include error_message
//   tool_limit_reached  billing gate blocked (insufficient coins, …)
//   tool_download       results downloaded
export function track(event, properties = {}) {
  if (typeof window === 'undefined' || !event) return
  const props = { tool_slug: toolSlugForEvents, logged_in: loggedInNow(), platform: platform(), ...properties }
  try {
    if (postToHub({ type: 'barmeto:track', event, properties: props })) return
    syncIdentity()
    if (posthog.__loaded) posthog.capture(event, props)
  } catch { /* ignore */ }
}

// Ask the hub to show its sign-up / login screen. Returns true when the hub
// was asked (embedded) — the caller must then NOT navigate anywhere itself.
// Standalone it returns false and the caller uses its own /login as before.
// The desktop app and a plain tab are never embedded, so they keep their
// own /login exactly as before.
export function requestHubLogin(reason = 'login_required') {
  track('tool_signup_prompt_shown', { reason })
  if (!isEmbedded()) return false
  return postToHub({ type: 'barmeto:auth_required', reason })
}

// Wraps a tool's billing gate so every billable action is measured the same
// way in every tool: proceed → tool_used, blocked → tool_limit_reached /
// tool_error. Returns the gate's own result untouched.
// silentProceed: the call site tracks its own tool_used (with richer
// properties), so only blocks/errors are reported here.
export async function trackedGate(gatePromise, { feature, quantity, silentProceed = false } = {}) {
  let result
  try {
    result = await gatePromise
  } catch (err) {
    track('tool_error', { feature, stage: 'billing_gate', error_message: String(err?.message || err).slice(0, 300) })
    throw err
  }
  try {
    if (result?.status === 'proceed') {
      if (!silentProceed) track('tool_used', { feature, quantity: quantity ?? 1 })
    } else if (result?.reason === 'login_required') {
      // reported by requestHubLogin / the login modal
    } else if (result?.reason === 'error') {
      track('tool_error', { feature, stage: 'billing_gate', error_message: String(result?.data?.message || 'billing_error').slice(0, 300) })
    } else if (result?.status === 'blocked') {
      track('tool_limit_reached', { feature, reason: result.reason })
    }
  } catch { /* ignore */ }
  return result
}
