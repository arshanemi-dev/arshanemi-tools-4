import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getStaffFromRequest } from '@/lib/auth'
import { env } from '@/lib/env'

// On-demand cache purge. Previously wide open — anyone could force-revalidate
// any tag repeatedly, turning it into a cache-stampede / load amplifier.
// Now needs either the REVALIDATE_SECRET (for CI / external webhooks) or a
// logged-in staff session — same rule as the root admin panel's own
// /api/revalidate.
async function isAuthorized(req) {
  const secret = env.REVALIDATE_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : req.nextUrl.searchParams.get('secret')
    if (provided && provided === secret) return true
  }
  return !!(await getStaffFromRequest(req))
}

export async function POST(req) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const tags = Array.isArray(body.tags) ? body.tags.filter((t) => typeof t === 'string' && t.length > 0).slice(0, 50) : []
  tags.forEach((tag) => revalidateTag(tag))
  return NextResponse.json({ revalidated: tags })
}
