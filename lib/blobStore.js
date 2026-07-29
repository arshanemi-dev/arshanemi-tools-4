// JSON-file storage backend for the generic collection/singleton family in
// lib/db.js — an alternative to the layout_settings Supabase table, toggled
// by NEXT_PUBLIC_IS_JSON_SAVED_DATA. Mirrors tools/user-local-login's
// lib/blobStore.js. Each tool instance gets its own namespace folder (from
// TOOLS_NAME) so multiple tools can share one Blob store without colliding:
//   database/<tools-name-slug>/blogs.json
//   database/<tools-name-slug>/theme.json
import { put } from '@vercel/blob'

const TOOLS_NAME = process.env.TOOLS_NAME || 'arshanemi-tools-dashboard'

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'arshanemi-tools-dashboard'
}

function blobBaseUrl() {
  const raw = process.env.BLOB_STORE_ID || ''
  const id = raw.replace(/^store_/i, '').toLowerCase()
  return `https://${id}.public.blob.vercel-storage.com`
}

function blobPath(key) {
  return `database/${toSlug(TOOLS_NAME)}/${key}.json`
}

export async function readBlobJson(key, fallback) {
  const url = `${blobBaseUrl()}/${blobPath(key)}?t=${Date.now()}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
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
