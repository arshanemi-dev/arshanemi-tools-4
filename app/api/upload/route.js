import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { uploadImage, deleteImage, imageUploadError, canDeleteImage } from '@/lib/upload'

export async function POST(req) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file')
  const collection = formData.get('collection') || 'general'

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  const problem = imageUploadError(file)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const url = await uploadImage(file, collection, payload.userId)
  return NextResponse.json({ url })
}

// Being logged in isn't enough to delete a file: only the user who uploaded
// it, or a master admin — and only ever an uploaded image, never anything
// else kept in the same store (see lib/upload.js's canDeleteImage).
export async function DELETE(req) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await req.json().catch(() => ({}))
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  if (!canDeleteImage(url, payload)) {
    return NextResponse.json({ error: 'You can only delete images you uploaded yourself.' }, { status: 403 })
  }
  await deleteImage(url)
  return NextResponse.json({ ok: true })
}
