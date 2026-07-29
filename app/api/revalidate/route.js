import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export async function POST(req) {
  const { tags = [] } = await req.json()
  tags.forEach((tag) => revalidateTag(tag))
  return NextResponse.json({ revalidated: tags })
}
