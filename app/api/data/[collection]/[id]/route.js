import { NextResponse } from 'next/server'
import { getItem } from '@/lib/db'

export async function GET(req, { params }) {
  const { collection, id } = await params
  const item = await getItem(collection, id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(item)
}
