import { proxyMapping } from '@/lib/listingMappingProxy'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  return proxyMapping(req, `/api/listing-tools/logs?${searchParams.toString()}`)
}
