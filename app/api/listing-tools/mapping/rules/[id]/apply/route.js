import { proxyMapping } from '@/lib/listingMappingProxy'

export async function POST(req, { params }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  return proxyMapping(req, `/api/listing-tools/mapping/rules/${id}/apply`, { method: 'POST', body })
}
