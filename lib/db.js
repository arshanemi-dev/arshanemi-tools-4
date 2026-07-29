import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { readBlobJson, writeBlobJson } from './blobStore'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

// Every generic collection/singleton function below (getCollection,
// getItem, createItem, saveCollection, updateItem, deleteItem, getSingleton,
// updateSingleton) funnels through these two primitives, so gating just
// these two makes the whole family storage-backend-aware in one place: real
// Supabase rows (default) or flat JSON files in Vercel Blob, toggled by
// NEXT_PUBLIC_IS_JSON_SAVED_DATA — see lib/blobStore.js. The dedicated
// relational tables (users/companies/tools/files_expiry/user_otp) are
// unaffected either way — they always use Supabase directly.
const IS_JSON_SAVED_DATA = process.env.NEXT_PUBLIC_IS_JSON_SAVED_DATA === 'true'

// ─── Layout Settings (collections + singletons stored as JSONB) ───────────────

async function readSetting(name) {
  if (IS_JSON_SAVED_DATA) return readBlobJson(name, null)
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('layout_settings')
    .select('value')
    .eq('key', name)
    .single()
  if (error || !data) return null
  return data.value
}

async function writeSetting(name, value) {
  if (IS_JSON_SAVED_DATA) { await writeBlobJson(name, value); return }
  const supabase = getSupabase()
  const { error } = await supabase
    .from('layout_settings')
    .upsert({ key: name, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

// ─── List Collections ──────────────────────────────────────────────────────────

export async function getCollection(name) {
  const data = await readSetting(name)
  return Array.isArray(data) ? data : []
}

export async function getItem(name, id) {
  const items = await getCollection(name)
  return items.find((i) => i.id === id) ?? null
}

export async function createItem(name, data) {
  const { nanoid } = await import('nanoid')
  const item = { ...data, id: nanoid() }
  const items = await getCollection(name)
  items.unshift(item)
  await writeSetting(name, items)
  return item
}

export async function saveCollection(name, array) {
  await writeSetting(name, array)
}

export async function updateItem(name, id, data) {
  const items = await getCollection(name)
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return null
  items[idx] = { ...items[idx], ...data, id }
  await writeSetting(name, items)
  return items[idx]
}

export async function deleteItem(name, id) {
  const items = await getCollection(name)
  await writeSetting(name, items.filter((i) => i.id !== id))
}

// ─── Singleton Collections ─────────────────────────────────────────────────────

export async function getSingleton(name) {
  return (await readSetting(name)) ?? {}
}

export async function updateSingleton(name, data) {
  await writeSetting(name, data)
  return data
}

// ─── Seed helper ───────────────────────────────────────────────────────────────

export async function seedCollection(name, array) {
  await writeSetting(name, array)
  console.log(`✓ Seeded ${name} (${array.length} items)`)
}

export async function seedSingleton(name, obj) {
  await writeSetting(name, obj)
  console.log(`✓ Seeded singleton: ${name}`)
}

// ─── ISR-cached public reads ───────────────────────────────────────────────────

export function getCachedCollection(name) {
  return unstable_cache(() => getCollection(name), [name], {
    tags: [name],
    revalidate: 3600,
  })()
}

export function getCachedSingleton(name) {
  return unstable_cache(() => getSingleton(name), [name], {
    tags: [name],
    revalidate: 3600,
  })()
}

// ─── Users (separate table) ────────────────────────────────────────────────────

export async function getUserByEmail(email) {
  const supabase = getSupabase()
  const { data } = await supabase.from('users').select('*').eq('email', email).single()
  return data ?? null
}

export async function getUserByMobile(mobile) {
  const supabase = getSupabase()
  const { data } = await supabase.from('users').select('*').eq('mobile', mobile).single()
  return data ?? null
}

export async function getUserById(id) {
  const supabase = getSupabase()
  const { data } = await supabase.from('users').select('*').eq('id', id).single()
  return data ?? null
}

// Mirrors arshanemi-admin-pannels' lib/db.js function of the same name, used
// by /api/auth/me to populate serializeProfile's `walletExpiresAt`. That app
// sources this from its `wallet_topups` table (coin_expiry_migration.sql),
// part of the full coin-wallet billing system — this app never got that
// system ported (no wallet_topups/coin_packages tables here), so this is a
// safe no-op stub that always reports "no expiry" rather than querying a
// table that doesn't exist. Give it a real query here if/when that billing
// system is ported to this app.
export async function getLatestWalletExpiry(_userId) {
  return null
}

export async function createUser({
  name, email, mobile, passwordHash, role = 'user', companyId = null, otpEnabled = false,
  address1 = null, address2 = null, walletCreditsTotal = 0,
}) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('users')
    .insert({
      name, email, mobile, password_hash: passwordHash, role, company_id: companyId, otp_enabled: otpEnabled,
      address1, address2, wallet_credits_total: walletCreditsTotal,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateUserPassword(userId, passwordHash) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('users')
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}

// Excludes master_admin rows — those are only ever managed via scripts/seed.mjs,
// never through the admin Users UI. Pass companyId to scope to one company
// (used by the company-scoped 'admin' role) and/or role to further narrow to
// a single role (the 'admin' role only ever manages plain 'user' accounts,
// never fellow admins).
export async function getAllUsers({ companyId, role } = {}) {
  const supabase = getSupabase()
  let query = supabase
    .from('users')
    .select('id,name,email,mobile,role,company_id,is_active,otp_enabled,address1,address2,wallet_credits_total,wallet_credits_used,created_at')
    .neq('role', 'master_admin')
    .order('created_at', { ascending: false })
  if (companyId) query = query.eq('company_id', companyId)
  if (role) query = query.eq('role', role)
  const { data } = await query
  return data ?? []
}

// Partial update for admin-managed users (name/email/mobile/role/company/status/otp).
export async function updateUser(id, updates) {
  const supabase = getSupabase()
  const patch = {}
  if ('name' in updates) patch.name = updates.name
  if ('email' in updates) patch.email = updates.email ? updates.email.toLowerCase().trim() : null
  if ('mobile' in updates) patch.mobile = updates.mobile || null
  if ('role' in updates) patch.role = updates.role
  if ('companyId' in updates) patch.company_id = updates.companyId
  if ('isActive' in updates) patch.is_active = updates.isActive
  if ('otpEnabled' in updates) patch.otp_enabled = updates.otpEnabled
  if ('address1' in updates) patch.address1 = updates.address1 || null
  if ('address2' in updates) patch.address2 = updates.address2 || null
  if ('addressCity' in updates) patch.address_city = updates.addressCity || null
  if ('addressState' in updates) patch.address_state = updates.addressState || null
  if ('addressCountry' in updates) patch.address_country = updates.addressCountry || null
  if ('addressPincode' in updates) patch.address_pincode = updates.addressPincode || null
  if ('businessName' in updates) patch.company_name = updates.businessName || null
  if ('gstNumber' in updates) patch.gst_number = updates.gstNumber || null
  if ('walletCreditsTotal' in updates) patch.wallet_credits_total = updates.walletCreditsTotal
  if ('walletCreditsUsed' in updates) patch.wallet_credits_used = updates.walletCreditsUsed
  patch.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteUser(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('users').delete().eq('id', id)
  if (error) throw error
}

// ─── OTP (separate table with 60s auto-delete via pg trigger) ─────────────────

export async function createOTP({ identifier, type, otpCode, purpose = 'reset_password' }) {
  const supabase = getSupabase()
  // Delete any existing OTP for this identifier + purpose first (doesn't touch
  // a pending OTP for a different purpose, e.g. login vs password reset)
  await supabase.from('user_otp').delete().eq('identifier', identifier).eq('purpose', purpose)
  const expiresAt = new Date(Date.now() + 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('user_otp')
    .insert({ identifier, type, otp_code: otpCode, purpose, expires_at: expiresAt })
    .select()
    .single()
  if (error) throw error
  return data
}

// Single point of truth for the OTP bypass — every OTP-gated route (login,
// change-password, verify-contact-change, verify-otp) calls verifyOTP()
// rather than checking user_otp itself, so gating it here disables OTP
// enforcement everywhere at once without touching each route individually.
const OTP_DISABLED = process.env.NEXT_PUBLIC_IS_OTP_Verifications_Disable === 'true'

export async function verifyOTP({ identifier, otpCode, purpose = 'reset_password' }) {
  if (OTP_DISABLED) return true
  const supabase = getSupabase()
  const { data } = await supabase
    .from('user_otp')
    .select('*')
    .eq('identifier', identifier)
    .eq('otp_code', otpCode)
    .eq('purpose', purpose)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single()
  if (!data) return false
  // Mark as used
  await supabase.from('user_otp').update({ used: true }).eq('id', data.id)
  return true
}

export async function deleteOTP(identifier) {
  const supabase = getSupabase()
  await supabase.from('user_otp').delete().eq('identifier', identifier)
}

// ─── Companies ────────────────────────────────────────────────────────────────

function toCompanySlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

export async function getCompanyByEmail(email) {
  const supabase = getSupabase()
  const { data } = await supabase.from('companies').select('*').eq('email', email.toLowerCase().trim()).single()
  return data ?? null
}

export async function getCompanyById(id) {
  const supabase = getSupabase()
  const { data } = await supabase.from('companies').select('*').eq('id', id).single()
  return data ?? null
}

export async function getCompanyBySlug(slug) {
  const supabase = getSupabase()
  const { data } = await supabase.from('companies').select('*').eq('slug', slug).single()
  return data ?? null
}

export async function getAllCompanies() {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('companies')
    .select('id,name,slug,email,phone,website,folder_id,is_active,created_at')
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getUsersByCompany(companyId) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('users')
    .select('id,name,email,mobile,role,is_active,created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  return data ?? []
}

// Creates a company row. folderId must already be reserved before calling this.
export async function createCompany({ name, email, phone, website, address, folderId }) {
  const supabase = getSupabase()
  const slug = name ? toCompanySlug(name) : null
  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: name || null,
      slug,
      email: email.toLowerCase().trim(),
      phone: phone || null,
      website: website || null,
      address: address || null,
      folder_id: folderId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Updates company details. If name changes, updates slug + folder_id.
// Returns { company, folderChanged, oldFolderId, newFolderId }
export async function updateCompany(id, updates) {
  const supabase = getSupabase()
  const current = await getCompanyById(id)
  if (!current) throw new Error('Company not found')

  const patch = {}
  if ('name' in updates) {
    patch.name = updates.name || null
    patch.slug = updates.name ? toCompanySlug(updates.name) : null
    // rename folder only when name changes and a new slug can be derived
    if (patch.slug && patch.slug !== current.slug) {
      patch.folder_id = patch.slug
    }
  }
  if ('email' in updates) patch.email = updates.email.toLowerCase().trim()
  if ('phone' in updates) patch.phone = updates.phone || null
  if ('website' in updates) patch.website = updates.website || null
  if ('address' in updates) patch.address = updates.address || null
  if ('is_active' in updates) patch.is_active = updates.is_active
  patch.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('companies')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  const folderChanged = patch.folder_id && patch.folder_id !== current.folder_id
  return {
    company: data,
    folderChanged: !!folderChanged,
    oldFolderId: current.folder_id,
    newFolderId: patch.folder_id ?? current.folder_id,
  }
}

export async function deleteCompany(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('companies').delete().eq('id', id)
  if (error) throw error
}

// ─── User Settings (per-user tools access, one row per user) ──────────────────

export async function getUserSettings(userId) {
  const supabase = getSupabase()
  const { data } = await supabase.from('user_settings').select('*').eq('user_id', userId).single()
  return data ?? null
}

export async function getAllUserSettingsMap() {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('user_settings').select('user_id, tools_access')
  if (error) throw error
  const map = {}
  for (const row of data ?? []) map[row.user_id] = row.tools_access
  return map
}

export async function upsertUserToolsAccess(userId, toolsAccess) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: userId, tools_access: toolsAccess, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) throw error
  return toolsAccess
}

// Creates the default user_settings row for a newly created user, granting
// every tool available to their role (see data/tools.js defaultToolsAccessByRole).
export async function createUserSettings(userId, role = 'user') {
  const { defaultToolsAccessByRole } = await import('@/data/tools')
  const toolsAccess = defaultToolsAccessByRole[role] || defaultToolsAccessByRole.user
  return upsertUserToolsAccess(userId, toolsAccess)
}

// ─── Files Expiry (separate table) ───────────────────────────────────────────

export async function getAllFilesExpiry() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('files_expiry')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function insertManyFilesExpiry(items) {
  const { nanoid } = await import('nanoid')
  const supabase = getSupabase()
  const rows = items.map(({ name, expiryAt }) => ({
    id: nanoid(),
    name,
    expiry_at: expiryAt,
  }))
  const { data, error } = await supabase
    .from('files_expiry')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: false })
    .select()
  if (error) throw error
  return data ?? []
}

export async function deleteManyFilesExpiry(ids) {
  const supabase = getSupabase()
  const { error } = await supabase.from('files_expiry').delete().in('id', ids)
  if (error) throw error
}

export async function editOneFilesExpiry(id, { name, expiryAt }) {
  const supabase = getSupabase()
  const patch = {}
  if (name !== undefined) patch.name = name
  if (expiryAt !== undefined) patch.expiry_at = expiryAt
  const { data, error } = await supabase
    .from('files_expiry')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function editManyFilesExpiryDate(ids, expiryAt) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('files_expiry')
    .update({ expiry_at: expiryAt })
    .in('id', ids)
    .select()
  if (error) throw error
  return data ?? []
}

// ─── SKU Master & Mappings (per-user — 'pdf-cropper') ────────────────────────
// Backs GET/POST/DELETE /api/sku/{master,map} (mirrors arshanemi-admin-pannels'
// lib/db.js — see scripts/sku_mapping_migration.sql). Each function returns
// the caller's fresh full list, matching the shape the tool's client-side
// skuStore already expects.

export async function getMasterSkusForUser(userId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('sku_masters')
    .select('sku')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => r.sku)
}

export async function addMasterSkuForUser(userId, sku) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('sku_masters')
    .upsert({ user_id: userId, sku }, { onConflict: 'user_id,sku', ignoreDuplicates: true })
  if (error) throw error
  return getMasterSkusForUser(userId)
}

// Renames the master row, then cascades into every mapping that pointed at
// the old name.
export async function renameMasterSkuForUser(userId, oldSku, newSku) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('sku_masters')
    .update({ sku: newSku })
    .eq('user_id', userId)
    .eq('sku', oldSku)
  if (error) throw error

  const { error: mapError } = await supabase
    .from('sku_mappings')
    .update({ master_sku: newSku, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('master_sku', oldSku)
  if (mapError) throw mapError

  return getMasterSkusForUser(userId)
}

export async function deleteMasterSkuForUser(userId, sku) {
  const supabase = getSupabase()
  const { error } = await supabase.from('sku_masters').delete().eq('user_id', userId).eq('sku', sku)
  if (error) throw error
  return getMasterSkusForUser(userId)
}

export async function getSkuMappingsForUser(userId) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('sku_mappings')
    .select('sku, master_sku')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({ sku: r.sku, masterSku: r.master_sku }))
}

export async function upsertSkuMappingForUser(userId, sku, masterSku) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('sku_mappings')
    .upsert(
      { user_id: userId, sku, master_sku: masterSku, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,sku' }
    )
  if (error) throw error
  return getSkuMappingsForUser(userId)
}

export async function deleteSkuMappingForUser(userId, sku) {
  const supabase = getSupabase()
  const { error } = await supabase.from('sku_mappings').delete().eq('user_id', userId).eq('sku', sku)
  if (error) throw error
  return getSkuMappingsForUser(userId)
}

// ─── Tools (dedicated table — was a single JSONB blob under layout_settings)──
//
// The rich marketing content (features/hero/stats/steps/advantages/faqs) is
// only ever set at seed time — the admin CRUD form (ToolsAdminClient.jsx)
// only edits the flat fields below — so it's bundled into one `content`
// JSONB column instead of being split into more columns/tables. Every
// function here returns/accepts the same flattened shape the old
// getCollection('tools') items had, so no consuming page or API route needs
// to change how it reads a tool object.

const TOOLS_CONTENT_FIELDS = ['features', 'hero', 'stats', 'steps', 'advantages', 'faqs']

function toolRowToItem(row) {
  if (!row) return null
  const { content, short_desc, tool_url, requires_login, created_at, updated_at, ...rest } = row
  return {
    ...rest,
    shortDesc: short_desc,
    toolUrl: tool_url,
    requiresLogin: requires_login,
    ...(content || {}),
  }
}

function toolItemToRow(data) {
  const row = {}
  if ('slug' in data) row.slug = data.slug
  if ('title' in data) row.title = data.title
  if ('icon' in data) row.icon = data.icon ?? null
  if ('shortDesc' in data) row.short_desc = data.shortDesc ?? null
  if ('category' in data) row.category = data.category ?? null
  if ('badge' in data) row.badge = data.badge ?? null
  if ('toolUrl' in data) row.tool_url = data.toolUrl ?? null
  if ('requiresLogin' in data) row.requires_login = !!data.requiresLogin

  const content = {}
  let hasContent = false
  for (const key of TOOLS_CONTENT_FIELDS) {
    if (key in data) { content[key] = data[key]; hasContent = true }
  }
  if (hasContent) row.content = content

  return row
}

export async function getAllToolsFromDB() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toolRowToItem)
}

export async function getToolByIdFromDB(id) {
  const supabase = getSupabase()
  const { data } = await supabase.from('tools').select('*').eq('id', id).single()
  return toolRowToItem(data)
}

export async function getToolBySlugFromDB(slug) {
  const supabase = getSupabase()
  const { data } = await supabase.from('tools').select('*').eq('slug', slug).single()
  return toolRowToItem(data)
}

export async function createTool(data) {
  const { nanoid } = await import('nanoid')
  const supabase = getSupabase()
  const row = { id: nanoid(), ...toolItemToRow(data) }
  const { data: created, error } = await supabase.from('tools').insert(row).select().single()
  if (error) throw error
  return toolRowToItem(created)
}

export async function updateTool(id, data) {
  const supabase = getSupabase()
  const patch = { ...toolItemToRow(data), updated_at: new Date().toISOString() }

  // A partial content update (e.g. only `features` sent) must merge into the
  // existing JSONB blob, not replace it — otherwise hero/stats/steps/etc not
  // present in `data` would be silently wiped from the column.
  if (patch.content) {
    const { data: existing } = await supabase.from('tools').select('content').eq('id', id).single()
    patch.content = { ...(existing?.content || {}), ...patch.content }
  }

  const { data: updated, error } = await supabase
    .from('tools')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error || !updated) return null
  return toolRowToItem(updated)
}

export async function deleteTool(id) {
  const supabase = getSupabase()
  const { error } = await supabase.from('tools').delete().eq('id', id)
  if (error) throw error
}
