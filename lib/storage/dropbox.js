// Dropbox-backed storage for Listing Tools product images (the "Image N"
// header columns) — replaces the old Vercel Blob path
// (lib/media.js's uploadUserToolMedia). Trimmed to just what Listing Tools
// needs (upload + shared link); no file-browser ops like tools-1's fuller
// lib/storage/dropbox.js (list/move/copy/delete) since nothing here browses
// Dropbox — every upload is a one-off product image.

import { Dropbox } from 'dropbox'
import { getServerDropboxToken } from '../dropboxToken'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 429 and 5xx are transient — safe to retry. 4xx (except 429) are permanent failures.
function isRetryable(err) {
  const status = err?.status
  if (typeof status === 'number') return status === 429 || status >= 500
  return true // no HTTP status = network/connection error
}

// Exponential backoff with jitter: 700ms, ~1400ms, ~2800ms between attempts
async function withRetry(fn, maxAttempts = 3, baseMs = 700) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxAttempts || !isRetryable(err)) throw err
      await sleep(baseMs * 2 ** (attempt - 1) + Math.random() * 300)
    }
  }
}

// The SDK's binary-download path picks between res.blob() and res.buffer()
// based on isWindowOrWorker() — in a Node server that always takes the
// res.buffer() branch, expecting a node-fetch-style Response. Node's native
// fetch (undici) has no .buffer(), so upload-adjacent calls that touch that
// path throw "res.buffer is not a function" without this patch.
async function nodeCompatFetch(...args) {
  const res = await fetch(...args)
  if (typeof res.buffer !== 'function') {
    res.buffer = () => res.arrayBuffer().then((ab) => Buffer.from(ab))
  }
  return res
}

async function getDbx() {
  const accessToken = await getServerDropboxToken()
  return new Dropbox({ accessToken, fetch: nodeCompatFetch })
}

function friendlyDropboxError(err) {
  if (typeof err?.status !== 'number') return err
  if (err.status === 401) {
    return new Error('Dropbox rejected the connection (401 Unauthorized) — the access token is invalid or expired. Check DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN.')
  }
  return err
}

// Convert Dropbox sharing-page URL → direct CDN URL (no redirect, permanent)
function toDirectUrl(url) {
  return url
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    .replace('?dl=0', '')
    .replace('&dl=0', '')
}

async function getSharedLink(dbx, path) {
  try {
    const res = await dbx.sharingCreateSharedLinkWithSettings({
      path,
      settings: { requested_visibility: { '.tag': 'public' } },
    })
    return toDirectUrl(res.result.url)
  } catch (e) {
    if (e?.error?.error?.['.tag'] === 'shared_link_already_exists') {
      const existing = await dbx.sharingListSharedLinks({ path, direct_only: true })
      return toDirectUrl(existing.result.links[0]?.url ?? '')
    }
    throw friendlyDropboxError(e)
  }
}

// Uploads one file to Dropbox at folderPath/filename (autorenamed on
// conflict) and returns a permanent direct-CDN URL alongside file metadata.
export async function uploadFile(folderPath, filename, buffer, contentType) {
  const dbx  = await getDbx()
  const path = `${folderPath}/${filename}`.replace(/\/\//g, '/')
  try {
    const res = await withRetry(() =>
      dbx.filesUpload({ path, contents: buffer, mode: 'add', autorename: true })
    )
    const url = await withRetry(() => getSharedLink(dbx, res.result.path_display))
    return {
      url,
      pathname: res.result.path_display,
      filename,
      size: res.result.size ?? buffer.length,
      uploadedAt: new Date().toISOString(),
      contentType: contentType || 'application/octet-stream',
    }
  } catch (err) {
    throw friendlyDropboxError(err)
  }
}
