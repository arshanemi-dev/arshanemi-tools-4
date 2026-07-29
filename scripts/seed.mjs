/**
 * Arshanemi Tools Dashboard — PostgreSQL Seed Script
 * Seeds the theme and company singletons into the Supabase layout_settings
 * table (or as a JSON file in Vercel Blob when NEXT_PUBLIC_IS_JSON_SAVED_DATA
 * =true — see lib/blobStore.js), plus the default tenant company and admin
 * accounts.
 *
 * This app only manages Companies/Users/Theme, so unlike the main Arshanemi
 * site's seed script it only seeds what this app's data/ folder actually
 * has: theme, company, companies, and the default accounts.
 *
 * Usage:
 *   node --env-file=.env scripts/seed.mjs
 *   npm run seed
 */

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath, pathToFileURL } from 'url'
import path from 'path'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href)

// ─── Supabase client ─────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
    process.exit(1)
  }
  return createClient(url, key)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Mirrors lib/db.js's readSetting/writeSetting branch — this script writes
// directly to Supabase rather than importing lib/db.js, so it needs its own
// copy of the same NEXT_PUBLIC_IS_JSON_SAVED_DATA check to stay in sync with
// whichever backend the running app is actually reading from.
const IS_JSON_SAVED_DATA = process.env.NEXT_PUBLIC_IS_JSON_SAVED_DATA === 'true'

async function upsertSetting(supabase, key, value) {
  if (IS_JSON_SAVED_DATA) {
    const { writeBlobJson } = await imp('lib/blobStore.js')
    await writeBlobJson(key, value)
    const count = Array.isArray(value) ? `${value.length} items` : 'singleton'
    console.log(`  ✓ ${key} (${count}) [Blob JSON]`)
    return
  }
  const { error } = await supabase
    .from('layout_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`Failed to upsert ${key}: ${error.message}`)
  const count = Array.isArray(value) ? `${value.length} items` : 'singleton'
  console.log(`  ✓ ${key} (${count})`)
}

async function seedSingleton(supabase, name, obj) {
  await upsertSetting(supabase, name, obj)
}

function toCompanySlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  Arshanemi Tools Dashboard — PostgreSQL Seed\n')

  const supabase = getSupabase()

  // ── Import data files ───────────────────────────────────────────────────────
  const { defaultToolsAccessByRole } = await imp('data/tools.js')
  const {
    COMPANY_EMAIL, COMPANY_PHONE_PRIMARY, COMPANY_PHONE_SECONDARY,
    COMPANY_WHATSAPP, COMPANY_ADDRESS, COMPANY_HOURS, COMPANY_NAME,
  } = await imp('data/company.js')
  const { DEFAULT_COMPANY, MASTER_ADMIN, DEFAULT_COMPANY_ADMIN } = await imp('data/default.js')
  const { defaultTheme } = await imp('data/defaultTheme.js')

  // ── Singletons ──────────────────────────────────────────────────────────────
  console.log('\n⚙️   Seeding singletons...\n')

  await seedSingleton(supabase, 'company', {
    name: COMPANY_NAME,
    email: COMPANY_EMAIL,
    phonePrimary: COMPANY_PHONE_PRIMARY,
    phoneSecondary: COMPANY_PHONE_SECONDARY,
    whatsapp: COMPANY_WHATSAPP,
    address: COMPANY_ADDRESS,
    hours: COMPANY_HOURS,
  })

  await seedSingleton(supabase, 'theme', defaultTheme)

  // ── Default tenant company ──────────────────────────────────────────────────
  // This is the multi-tenant `companies` row (users/roles/companies system) —
  // distinct from the `company` singleton seeded above, which is the site's
  // own public contact-info block.
  console.log('\n🏢  Seeding default company...\n')

  const defaultCompanyEmail = DEFAULT_COMPANY.email.toLowerCase().trim()
  let { data: defaultCompany } = await supabase
    .from('companies')
    .select('*')
    .eq('email', defaultCompanyEmail)
    .single()

  if (!defaultCompany) {
    const slug = toCompanySlug(DEFAULT_COMPANY.name)
    const folderId = slug || `co_${nanoid(8)}`
    const { data: createdCompany, error: companyErr } = await supabase
      .from('companies')
      .insert({
        name: DEFAULT_COMPANY.name,
        slug,
        email: defaultCompanyEmail,
        phone: DEFAULT_COMPANY.phone || null,
        website: DEFAULT_COMPANY.website || null,
        address: DEFAULT_COMPANY.address || null,
        folder_id: folderId,
      })
      .select()
      .single()
    if (companyErr) {
      console.warn('  ⚠ Default company:', companyErr.message)
    } else {
      defaultCompany = createdCompany
      console.log(`  ✓ Created company "${defaultCompany.name}" (${defaultCompany.email})`)
      try {
        const { initCompanyFolders } = await imp('lib/media.js')
        await initCompanyFolders(folderId)
        console.log(`  ✓ Initialised blob storage folders for "${folderId}"`)
      } catch (err) {
        console.warn('  ⚠ Could not initialise blob storage folders (Vercel Blob not configured?):', err.message)
      }
    }
  } else {
    console.log(`  ✓ Company "${defaultCompany.name}" already exists (${defaultCompany.email})`)
  }

  // ── Default master admin + company admin ────────────────────────────────────
  // master_admin has full platform access; the company admin is scoped to
  // DEFAULT_COMPANY (role 'admin'). Regular 'user' accounts are created
  // through Admin → Users instead.
  console.log('\n👤  Seeding default admin accounts...\n')

  const SALT_ROUNDS = 10
  const masterAdminHash = await bcrypt.hash(MASTER_ADMIN.password, SALT_ROUNDS)

  const { data: masterAdmin, error: masterAdminErr } = await supabase.from('users').upsert(
    {
      name: MASTER_ADMIN.name,
      email: MASTER_ADMIN.email.toLowerCase().trim(),
      mobile: null,
      password_hash: masterAdminHash,
      role: 'master_admin',
      is_active: true,
    },
    { onConflict: 'email', ignoreDuplicates: false }
  ).select().single()
  if (masterAdminErr) console.warn('  ⚠ Master admin:', masterAdminErr.message)
  else console.log(`  ✓ ${masterAdmin.email}  (${MASTER_ADMIN.password})`)

  let companyAdmin = null
  if (defaultCompany) {
    const companyAdminHash = await bcrypt.hash(DEFAULT_COMPANY_ADMIN.password, SALT_ROUNDS)
    const { data: createdCompanyAdmin, error: companyAdminErr } = await supabase.from('users').upsert(
      {
        name: DEFAULT_COMPANY_ADMIN.name,
        email: DEFAULT_COMPANY_ADMIN.email.toLowerCase().trim(),
        mobile: null,
        password_hash: companyAdminHash,
        role: 'admin',
        company_id: defaultCompany.id,
        is_active: true,
        // otp_enabled intentionally omitted — defaults to FALSE once
        // scripts/otp_enabled_migration.sql has been run; omitting it keeps
        // this script working before that migration too.
      },
      { onConflict: 'email', ignoreDuplicates: false }
    ).select().single()
    if (companyAdminErr) console.warn('  ⚠ Company admin:', companyAdminErr.message)
    else {
      companyAdmin = createdCompanyAdmin
      console.log(`  ✓ ${companyAdmin.email}  (${DEFAULT_COMPANY_ADMIN.password})  — role: admin, company: ${defaultCompany.name}`)
    }
  }

  // ── Default user_settings (tools access) ───────────────────────────────────
  console.log('\n🔧  Seeding default user_settings...\n')

  async function seedUserSettings(user, role) {
    if (!user) return
    const toolsAccess = defaultToolsAccessByRole[role] || defaultToolsAccessByRole.user
    const { error } = await supabase.from('user_settings').upsert(
      { user_id: user.id, tools_access: toolsAccess, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    if (error) console.warn(`  ⚠ user_settings for ${user.email}:`, error.message)
    else console.log(`  ✓ user_settings for ${user.email} (${toolsAccess.length} tools)`)
  }

  await seedUserSettings(masterAdmin, 'master_admin')
  await seedUserSettings(companyAdmin, 'admin')

  console.log('\n✅  Seed complete — all data is live in PostgreSQL!\n')
}

main().catch((err) => {
  console.error('\n❌  Seed failed:', err)
  process.exit(1)
})
