// JSON-file storage backend for every table/collection/singleton in
// lib/db.js — no database. Mirrors tools/user-local-login's lib/blobStore.js.
// Each tool instance gets its own namespace folder (from TOOLS_NAME) so
// multiple tools can share one Blob store without colliding:
//   database/<tools-name-slug>/users.json
//   database/<tools-name-slug>/theme.json
import { put, head } from '@vercel/blob'

const TOOLS_NAME = process.env.TOOLS_NAME || 'barmeto-tools-dashboard'

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'barmeto-tools-dashboard'
}

function blobPath(key) {
  return `database/${toSlug(TOOLS_NAME)}/${key}.json`
}

// Resolves the blob's real URL via head() (authenticated by
// BLOB_READ_WRITE_TOKEN) instead of hand-building it from BLOB_STORE_ID —
// the store's public hostname isn't reliably derivable from the ID, so a
// hand-built URL can silently 404 against the wrong store and this would
// look like "no data" instead of a config error. head() throws when the
// blob doesn't exist, which the caller's catch turns into `fallback`.
export async function readBlobJson(key, fallback) {
  try {
    const meta = await head(blobPath(key), { token: process.env.BLOB_READ_WRITE_TOKEN })
    const res = await fetch(`${meta.url}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return fallback
    return await res.json()
  } catch {
    return fallback
  }
}

export async function writeBlobJson(key, data) {
  await put(blobPath(key), JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return data
}
