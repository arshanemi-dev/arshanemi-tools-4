import { proxyAdminCall } from './connect'

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
