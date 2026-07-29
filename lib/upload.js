import { put, del } from '@vercel/blob'

export async function uploadImage(file, collection) {
  const { nanoid } = await import('nanoid')
  const ext = file.name.split('.').pop().toLowerCase()
  const filename = `arshanemi-images/${collection}/${nanoid()}.${ext}`
  const blob = await put(filename, file, {
    access: 'public',
    contentType: file.type || 'image/jpeg',
    addRandomSuffix: false,
  })
  return blob.url
}

export async function deleteImage(url) {
  if (!url || !url.includes('blob.vercel-storage.com')) return
  try {
    await del(url)
  } catch {
    // silently ignore — blob may already be deleted
  }
}
