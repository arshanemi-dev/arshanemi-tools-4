import { proxyMapping } from '@/lib/listingMappingProxy'

export async function PATCH(req, { params }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  return proxyMapping(req, `/api/listing-tools/mapping/place-rules/${id}`, { method: 'PATCH', body })
}

export async function DELETE(req, { params }) {
  const { id } = await params
  return proxyMapping(req, `/api/listing-tools/mapping/place-rules/${id}`, { method: 'DELETE' })
}
