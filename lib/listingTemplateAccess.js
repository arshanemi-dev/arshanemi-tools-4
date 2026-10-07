import { proxyAdminCall, authHeaderFrom } from './connect'

// Server-side check for "can this user reach the Template Settings section"
// — called directly from app/listing-tools/layout.js and
// app/listing-tools/template-settings/layout.js, which already have the raw
// cookie token, so this never needs its own client-facing API route. Fails
// closed (false) on any proxy error — this is a permission gate, not a
// convenience feature.
export async function fetchTemplateSettingsAllowed(token, role) {
  if (role === 'master_admin') return true
  if (!token) return false
  try {
    const { ok, data } = await proxyAdminCall('/api/listing-tools/template-access/me', {
      authHeader: `Bearer ${token}`,
    })
    return ok ? !!data.allowed : false
  } catch {
    return false
  }
}

// The same permission for an API request. The layouts above only keep someone
// off the Template Settings PAGES; everything those pages do — create or
// change a template, upload its source sheet, edit Our Headers / mapping
// rules / versions — is a plain API call anyone logged in could make
// directly, so each of those routes asks this too.
//
// A "yes" is remembered per token for a minute: one screen there fires many
// of these calls, and each check is a round trip to the hub. A "no" is never
// remembered, so a failed check (hub briefly unreachable) can't lock a
// permitted user out, and a permission just granted works at once.
const YES_FOR_MS = 60 * 1000
const recentYes = new Map() // token → when it was last confirmed

export const TEMPLATE_SETTINGS_DENIED = 'Template Settings is not enabled for your account.'

export async function requestMayUseTemplateSettings(req, payload) {
  if (!payload) return false
  if (payload.role === 'master_admin') return true
  const header = authHeaderFrom(req)
  const token = header ? header.slice('Bearer '.length) : null
  if (!token) return false
  const confirmedAt = recentYes.get(token)
  if (confirmedAt && Date.now() - confirmedAt < YES_FOR_MS) return true
  const allowed = await fetchTemplateSettingsAllowed(token, payload.role)
  if (allowed) {
    if (recentYes.size > 500) recentYes.clear()
    recentYes.set(token, Date.now())
  } else {
    recentYes.delete(token)
  }
  return allowed
}
