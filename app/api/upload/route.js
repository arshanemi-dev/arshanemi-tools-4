import { NextResponse } from 'next/server'
import { uploadImage, deleteImage } from '@/lib/upload'

export async function POST(req) {
  const formData = await req.formData()
  const file = formData.get('file')
  const collection = formData.get('collection') || 'general'

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const url = await uploadImage(file, collection)
  return NextResponse.json({ url })
}

export async function DELETE(req) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  await deleteImage(url)
  return NextResponse.json({ ok: true })
}
