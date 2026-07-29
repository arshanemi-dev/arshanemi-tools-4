import { NextResponse } from 'next/server'
import { getCachedCollection } from '@/lib/db'

export async function GET(req, { params }) {
  const { collection } = await params
  const data = await getCachedCollection(collection)
  return NextResponse.json(data)
}
