// Server-side only.
//
// Credentials (app_key, app_secret, refresh_token) → .env / .env.local only
// Access token cache (access_token, expires_at)    → data/dropbox-tokens.json
//
// The JSON file is auto-managed — never edit it manually.
// Ported from tools/barmeto-tools-1/lib/dropboxToken.js.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const TOKEN_FILE = join(process.cwd(), 'data', 'dropbox-tokens.json')

let _memCache = null // { token: string, expiresAt: number }

// ── JSON file — stores access token cache only ────────────────────────────────

function readTokenFile() {
  if (!existsSync(TOKEN_FILE)) return null
  try { return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8')) } catch { return null }
}

function writeTokenFile(access_token, expires_at) {
  try {
    writeFileSync(TOKEN_FILE, JSON.stringify({ access_token, expires_at }, null, 2))
  } catch {
    // Vercel read-only filesystem — memory cache still works
  }
}

// ── Credentials from env only ─────────────────────────────────────────────────

function getCredentials() {
  const appKey       = process.env.DROPBOX_APP_KEY
  const appSecret    = process.env.DROPBOX_APP_SECRET
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN

  if (!appKey || !appSecret || !refreshToken) {
    throw new Error(
      'Missing DROPBOX_APP_KEY, DROPBOX_APP_SECRET, or DROPBOX_REFRESH_TOKEN in .env'
    )
  }
  return { appKey, appSecret, refreshToken }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getServerDropboxToken() {
  // 1. Memory cache
  if (_memCache && Date.now() < _memCache.expiresAt - 60_000) {
    return _memCache.token
  }

  // 2. JSON file — reuse cached access token if still valid
  const file = readTokenFile()
  if (file?.access_token && file?.expires_at && Date.now() < file.expires_at - 60_000) {
    _memCache = { token: file.access_token, expiresAt: file.expires_at }
    return file.access_token
  }

  // 3. Refresh — call Dropbox with refresh_token from env
  const { appKey, appSecret, refreshToken } = getCredentials()

  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Dropbox token refresh failed: ${await res.text()}`)
  }

  const { access_token, expires_in } = await res.json()
  const expiresAt = Date.now() + (expires_in ?? 14_400) * 1000

  writeTokenFile(access_token, expiresAt)
  _memCache = { token: access_token, expiresAt }
  return access_token
}
