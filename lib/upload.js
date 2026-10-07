import { put, del } from '@vercel/blob'
import { imageContentType, imageExtension } from './imageUploadRules'

export { imageUploadError, MAX_IMAGE_MB } from './imageUploadRules'

// Everything /api/upload stores lives under this one folder of the Blob
// store. The same store also holds this app's JSON "database" files
// (database/<tools-name>/users.json, … — see lib/blobStore.js), so a delete
// must never be able to reach outside it.
const IMAGE_ROOT = 'barmeto-images'
const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com'

function folderName(value, fallback) {
  const s = String(value ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return s || fallback
}
// A user id as one path segment — case kept (ids are case-sensitive).
function ownerFolder(userId) {
  return String(userId ?? '').replace(/[^A-Za-z0-9_-]/g, '-')
}

// Stored as barmeto-images/<collection>/<uploader's user id>/<random>.<ext> —
// the uploader's id is part of the path because that path is the only record
// of who owns the file (see canDeleteImage). Callers check imageUploadError
// first; the content type comes from the extension, never from the browser.
export async function uploadImage(file, collection, userId) {
  const { nanoid } = await import('nanoid')
  const filename = `${IMAGE_ROOT}/${folderName(collection, 'general')}/${ownerFolder(userId)}/${nanoid()}.${imageExtension(file.name)}`
  const blob = await put(filename, file, {
    access: 'public',
    contentType: imageContentType(file.name),
    addRandomSuffix: false,
  })
  return blob.url
}

// Whether this viewer may delete the file at `url`: it has to be one of this
// store's uploaded images (never anything else kept in the store), and the
// viewer has to be the user it was uploaded by — the folder it sits in — or a
// master admin. An image uploaded before files were filed per user has no
// owner folder, so only a master admin can remove it.
export function canDeleteImage(url, { userId, role } = {}) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith(BLOB_HOST_SUFFIX)) return false
  let segments
  try {
    segments = decodeURIComponent(parsed.pathname).split('/').filter(Boolean)
  } catch {
    return false
  }
  if (segments[0] !== IMAGE_ROOT || segments.length < 3 || segments.some((s) => s === '.' || s === '..')) return false
  if (role === 'master_admin') return true
  return !!userId && segments.length >= 4 && segments[segments.length - 2] === ownerFolder(userId)
}

export async function deleteImage(url) {
  if (!url) return
  try {
    await del(url)
  } catch {
  }
}
