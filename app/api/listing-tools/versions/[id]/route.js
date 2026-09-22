import { proxyMapping } from '@/lib/listingMappingProxy'

export async function PATCH(req, { params }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  return proxyMapping(req, `/api/listing-tools/versions/${id}`, { method: 'PATCH', body })
}

export async function DELETE(req, { params }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  return proxyMapping(req, `/api/listing-tools/versions/${id}?${searchParams.toString()}`, { method: 'DELETE' })
}
