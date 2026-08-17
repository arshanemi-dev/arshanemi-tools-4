import { getUserSettings } from '@/lib/db'
import { defaultToolsAccessByRole } from '@/data/tools'

// Resolves which tool slugs a user is granted — the per-user `tools_access`
// row if one exists, else the role's default grant (data/tools.js). Used by
// the SKU routes' tool-access gate (mirrors barmeto-admin-pannels'
// lib/tools.js).
export async function getUserToolsAccess(userId, role) {
  const settings = await getUserSettings(userId)
  return settings?.tools_access ?? defaultToolsAccessByRole[role] ?? defaultToolsAccessByRole.user
}
