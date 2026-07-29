/**
 * cron-cleanup.mjs — daily file expiry cleanup
 * Run with: npm run cron
 *
 * Checks both:
 *   1. Admin panel Supabase DB — deletes expired rows from files_expiry
 *   2. Tools JSON file — filters and rewrites tools/arshanemi-tools-1/data/files-expiry.json
 */

import cron from 'node-cron'
import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TOOLS_JSON = resolve(__dirname, '../tools/arshanemi-tools-1/data/files-expiry.json')

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not set (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
  return createClient(url, key)
}

async function cleanupDB() {
  const supabase = getSupabase()
  const now = new Date().toISOString()
  const { error, count } = await supabase
    .from('files_expiry')
    .delete({ count: 'exact' })
    .lt('expiry_at', now)
  if (error) {
    console.error('[cron] DB cleanup error:', error.message)
  } else {
    console.log(`[cron] Admin DB: ${count ?? 0} expired file(s) removed`)
  }
}

async function cleanupJSON() {
  try {
    const raw     = await readFile(TOOLS_JSON, 'utf8')
    const records = JSON.parse(raw)
    const now     = new Date()
    const active  = records.filter(r => new Date(r.expiryAt ?? r.expiry_at) > now)
    await writeFile(TOOLS_JSON, JSON.stringify(active, null, 2))
    console.log(`[cron] Tools JSON: ${records.length - active.length} expired file(s) removed`)
  } catch (e) {
    console.error('[cron] JSON cleanup error:', e.message)
  }
}

async function runCleanup() {
  console.log(`[cron] Running cleanup at ${new Date().toISOString()}`)
  await Promise.all([cleanupDB(), cleanupJSON()])
  console.log('[cron] Cleanup complete')
}

// Run daily at midnight
cron.schedule('0 0 * * *', runCleanup)

console.log('[cron] File expiry cleanup job started — runs daily at midnight (UTC)')
console.log('[cron] Press Ctrl+C to stop.')

// Run once immediately on startup so you can test without waiting for midnight
runCleanup()
