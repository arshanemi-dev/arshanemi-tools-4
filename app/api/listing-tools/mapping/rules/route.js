import { proxyMapping } from '@/lib/listingMappingProxy'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  return proxyMapping(req, `/api/listing-tools/mapping/rules?${searchParams.toString()}`)
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  return proxyMapping(req, '/api/listing-tools/mapping/rules', { method: 'POST', body })
}
