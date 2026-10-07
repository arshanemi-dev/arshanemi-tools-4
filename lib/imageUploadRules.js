// What counts as an uploadable image — shared by every route that stores one
// (/api/upload → Vercel Blob, listing-tools/[templateId]/images → Dropbox).
// Plain rules, no storage imports.

export const MAX_IMAGE_MB = 5

// Extension → the content type the file is stored (and later served) with.
// Decided here, never taken from the browser: a file's own claimed type is
// how an .html or .svg page ends up served from our storage as a web page.
const IMAGE_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  bmp: 'image/bmp',
}

export function imageExtension(filename) {
  return String(filename || '').split('.').pop().toLowerCase()
}

// The content type an accepted image is stored with — by its extension.
export function imageContentType(filename) {
  return IMAGE_TYPES[imageExtension(filename)] || 'application/octet-stream'
}

// null when `file` may be stored, otherwise why not.
export function imageUploadError(file) {
  if (!IMAGE_TYPES[imageExtension(file?.name)]) return 'Only JPG, PNG, WEBP, GIF, AVIF or BMP images can be uploaded'
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `File must be under ${MAX_IMAGE_MB}MB`
  return null
}
