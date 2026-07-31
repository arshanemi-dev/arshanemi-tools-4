import { NextResponse } from 'next/server'
import { getAuthPayload, getAdminFromRequest } from '@/lib/auth'
import { getSingleton, updateSingleton } from '@/lib/db'

const KEY = 'listing_tools_config'
const DEFAULT_CONFIG = { allowCreateEdit: { admin: false, user: false } }

// GET is readable by any authenticated role — the Auto Listing page checks
// this to decide whether to render its own "New Template" entry point.
// master_admin is implicitly always allowed and never consults this config.
export async function GET(req) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const config = await getSingleton(KEY)
  return NextResponse.json({ ...DEFAULT_CONFIG, ...config })
}

export async function PUT(req) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const config = { allowCreateEdit: { admin: !!body.allowCreateEdit?.admin, user: !!body.allowCreateEdit?.user } }
  await updateSingleton(KEY, config)
  return NextResponse.json(config)
}
