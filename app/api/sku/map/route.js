import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { getUserToolsAccess } from '@/lib/tools'
import {
  getSkuMappingsForUser,
  upsertSkuMappingForUser,
  deleteSkuMappingForUser,
} from '@/lib/db'
import { IS_CONNECT, proxyAdminCall, authHeaderFrom } from '@/lib/connect'

// Per-user SKU→Master mapping CRUD for the 'pdf-cropper' tool (mirrors
// barmeto-admin-pannels' identical route). Same connected-mode contract as
// ./master/route.js — see that file's comment for why the tool-access check
// is skipped locally and the call proxies to root instead.
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
    const { status, data } = await proxyAdminCall('/api/sku/map', { authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const skuMappings = await getSkuMappingsForUser(userId)
  return NextResponse.json({ skuMappings })
}

export async function POST(req) {
  const { userId, error } = await authorize(req)
  if (error) return error

  const body = await req.json()

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall('/api/sku/map', {
      method: 'POST',
      body,
      authHeader: authHeaderFrom(req),
    })
    return NextResponse.json(data, { status })
  }

  const { sku, masterSku } = body
  const skuMappings = await upsertSkuMappingForUser(userId, sku, masterSku)
  return NextResponse.json({ skuMappings })
}

export async function DELETE(req) {
  const { userId, error } = await authorize(req)
  if (error) return error

  const body = await req.json()

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall('/api/sku/map', {
      method: 'DELETE',
      body,
      authHeader: authHeaderFrom(req),
    })
    return NextResponse.json(data, { status })
  }

  const { sku } = body
  const skuMappings = await deleteSkuMappingForUser(userId, sku)
  return NextResponse.json({ skuMappings })
}
