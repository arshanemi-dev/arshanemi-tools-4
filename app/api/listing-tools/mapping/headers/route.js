import { proxyMapping } from '@/lib/listingMappingProxy'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  return proxyMapping(req, `/api/listing-tools/mapping/headers?${searchParams.toString()}`)
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  return proxyMapping(req, '/api/listing-tools/mapping/headers', { method: 'POST', body })
}
