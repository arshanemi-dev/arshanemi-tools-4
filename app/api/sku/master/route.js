import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { getUserToolsAccess } from '@/lib/tools'
import {
  getMasterSkusForUser,
  addMasterSkuForUser,
  renameMasterSkuForUser,
  deleteMasterSkuForUser,
} from '@/lib/db'
import { IS_CONNECT, proxyAdminCall, authHeaderFrom } from '@/lib/connect'

// Per-user Master SKU CRUD for the 'pdf-cropper' tool (mirrors
// arshanemi-admin-pannels' identical route). In connected mode this app has
// no local `users`/`user_settings` rows for the caller — login proxies to
// root and only stores root's issued token (see lib/connect.js) — so the
// read/write goes to root's own /api/sku/master instead of this app's local
// Supabase; root re-validates the forwarded token and re-checks tool access
// itself, so the local tool-access check is skipped in that mode.
const TOOL_SLUG = 'pdf-cropper'

async function authorize(req) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (IS_CONNECT) return { userId: payload.userId }
  const access = await getUserToolsAccess(payload.userId, payload.role)
  if (!access.includes(TOOL_SLUG)) {
    return { error: NextResponse.json({ error: 'access_denied' }, { status: 403 }) }
  }
  return { userId: payload.userId }
}

export async function GET(req) {
  const { userId, error } = await authorize(req)
  if (error) return error

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall('/api/sku/master', { authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const masterSkus = await getMasterSkusForUser(userId)
  return NextResponse.json({ masterSkus })
}

export async function POST(req) {
  const { userId, error } = await authorize(req)
  if (error) return error

  const body = await req.json()

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall('/api/sku/master', {
      method: 'POST',
      body,
      authHeader: authHeaderFrom(req),
    })
    return NextResponse.json(data, { status })
  }

  const { sku, oldSku, newSku } = body

  if (oldSku && newSku) {
    const masterSkus = await renameMasterSkuForUser(userId, oldSku, newSku)
    return NextResponse.json({ masterSkus })
  }

  const masterSkus = await addMasterSkuForUser(userId, sku)
  return NextResponse.json({ masterSkus })
}

export async function DELETE(req) {
  const { userId, error } = await authorize(req)
  if (error) return error

  const body = await req.json()

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall('/api/sku/master', {
      method: 'DELETE',
      body,
      authHeader: authHeaderFrom(req),
    })
    return NextResponse.json(data, { status })
  }

  const { sku } = body
  const masterSkus = await deleteMasterSkuForUser(userId, sku)
  return NextResponse.json({ masterSkus })
}
