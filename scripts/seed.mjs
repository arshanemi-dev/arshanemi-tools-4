/**
 * Arshanemi Tools Dashboard — Seed Script
 * Seeds the theme and company singletons, the default tenant company, and
 * the default admin accounts into this app's own storage — no database.
 * Everything is written through lib/db.js, which itself only ever writes
 * flat JSON files to Vercel Blob (see lib/blobStore.js). Safe to re-run:
 * existing rows are updated in place rather than duplicated.
 *
 * Usage:
 *   node --env-file=.env scripts/seed.mjs
 *   npm run seed
 */

import { fileURLToPath, pathToFileURL } from 'url'
import path from 'path'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href)

function toCompanySlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

const SALT_ROUNDS = 10

async function main() {
  console.log('\n🌱  Arshanemi Tools Dashboard — Seed\n')

  const {
    updateSingleton,
    getCompanyByEmail, createCompany,
    getUserByEmail, createUser, updateUser, updateUserPassword,
    createUserSettings,
  } = await imp('lib/db.js')
  const { initCompanyFolders } = await imp('lib/media.js')
  const { defaultTheme } = await imp('data/defaultTheme.js')
  const {
    COMPANY_EMAIL, COMPANY_PHONE_PRIMARY, COMPANY_PHONE_SECONDARY,
    COMPANY_WHATSAPP, COMPANY_ADDRESS, COMPANY_HOURS, COMPANY_NAME,
  } = await imp('data/company.js')
  const { DEFAULT_COMPANY, MASTER_ADMIN, DEFAULT_COMPANY_ADMIN, ADDITIONAL_ADMINS } = await imp('data/default.js')

  // ── Singletons ──────────────────────────────────────────────────────────────
  console.log('⚙️   Seeding singletons...\n')

  await updateSingleton('company', {
    name: COMPANY_NAME,
    email: COMPANY_EMAIL,
    phonePrimary: COMPANY_PHONE_PRIMARY,
    phoneSecondary: COMPANY_PHONE_SECONDARY,
    whatsapp: COMPANY_WHATSAPP,
    address: COMPANY_ADDRESS,
    hours: COMPANY_HOURS,
  })
  console.log('  ✓ company')

  await updateSingleton('theme', defaultTheme)
  console.log('  ✓ theme')

  // ── Default tenant company ──────────────────────────────────────────────────
  // This is the multi-tenant `companies` row (users/roles/companies system) —
  // distinct from the `company` singleton seeded above, which is the site's
  // own public contact-info block.
  console.log('\n🏢  Seeding default company...\n')

  const defaultCompanyEmail = DEFAULT_COMPANY.email.toLowerCase().trim()
  let defaultCompany = await getCompanyByEmail(defaultCompanyEmail)

  if (!defaultCompany) {
    const slug = toCompanySlug(DEFAULT_COMPANY.name)
    const folderId = slug || `co_${nanoid(8)}`
    defaultCompany = await createCompany({
      name: DEFAULT_COMPANY.name,
      email: defaultCompanyEmail,
      phone: DEFAULT_COMPANY.phone,
      website: DEFAULT_COMPANY.website,
      address: DEFAULT_COMPANY.address,
      folderId,
    })
    console.log(`  ✓ Created company "${defaultCompany.name}" (${defaultCompany.email})`)
    try {
      await initCompanyFolders(folderId)
      console.log(`  ✓ Initialised blob storage folders for "${folderId}"`)
    } catch (err) {
      console.warn('  ⚠ Could not initialise blob storage folders (Vercel Blob not configured?):', err.message)
    }
  } else {
    console.log(`  ✓ Company "${defaultCompany.name}" already exists (${defaultCompany.email})`)
  }

  // ── Default master admin + company admin ────────────────────────────────────
  // master_admin has full platform access; the company admin is scoped to
  // DEFAULT_COMPANY (role 'admin'). Regular 'user' accounts are created
  // through Admin → Users instead. Re-running this script updates the
  // password/role/company on an existing row rather than creating a
  // duplicate — there's no DB-level UNIQUE(email) to lean on anymore.
  console.log('\n👤  Seeding default admin accounts...\n')

  const masterEmail = MASTER_ADMIN.email.toLowerCase().trim()
  const masterAdminHash = await bcrypt.hash(MASTER_ADMIN.password, SALT_ROUNDS)
  let masterAdmin = await getUserByEmail(masterEmail)
  if (masterAdmin) {
    await updateUser(masterAdmin.id, { name: MASTER_ADMIN.name, isActive: true })
    await updateUserPassword(masterAdmin.id, masterAdminHash)
    console.log(`  ✓ ${masterEmail} already exists — refreshed  (${MASTER_ADMIN.password})`)
  } else {
    masterAdmin = await createUser({
      name: MASTER_ADMIN.name,
      email: masterEmail,
      mobile: null,
      passwordHash: masterAdminHash,
      role: 'master_admin',
    })
    console.log(`  ✓ ${masterAdmin.email}  (${MASTER_ADMIN.password})`)
  }

  let companyAdmin = null
  if (defaultCompany) {
    const companyAdminEmail = DEFAULT_COMPANY_ADMIN.email.toLowerCase().trim()
    const companyAdminHash = await bcrypt.hash(DEFAULT_COMPANY_ADMIN.password, SALT_ROUNDS)
    companyAdmin = await getUserByEmail(companyAdminEmail)
    if (companyAdmin) {
      await updateUser(companyAdmin.id, { name: DEFAULT_COMPANY_ADMIN.name, isActive: true, companyId: defaultCompany.id })
      await updateUserPassword(companyAdmin.id, companyAdminHash)
      console.log(`  ✓ ${companyAdminEmail} already exists — refreshed  (${DEFAULT_COMPANY_ADMIN.password})  — role: admin, company: ${defaultCompany.name}`)
    } else {
      companyAdmin = await createUser({
        name: DEFAULT_COMPANY_ADMIN.name,
        email: companyAdminEmail,
        mobile: null,
        passwordHash: companyAdminHash,
        role: 'admin',
        companyId: defaultCompany.id,
        // otpEnabled intentionally omitted — defaults to false
      })
      console.log(`  ✓ ${companyAdmin.email}  (${DEFAULT_COMPANY_ADMIN.password})  — role: admin, company: ${defaultCompany.name}`)
    }
  }

  // ── Additional seeded accounts (ADDITIONAL_ADMINS) ──────────────────────────
  // Extra convenience accounts beyond the master admin + company admin above —
  // same refresh-else-create pattern, scoped to defaultCompany unless the
  // account's role is 'master_admin'.
  const additionalUsers = []
  if (ADDITIONAL_ADMINS?.length) {
    console.log('\n👥  Seeding additional accounts...\n')
    for (const acct of ADDITIONAL_ADMINS) {
      const email = acct.email.toLowerCase().trim()
      const passwordHash = await bcrypt.hash(acct.password, SALT_ROUNDS)
      const role = acct.role || 'user'
      const companyId = role === 'master_admin' ? null : (defaultCompany?.id ?? null)
      const companySuffix = defaultCompany && role !== 'master_admin' ? `, company: ${defaultCompany.name}` : ''

      let user = await getUserByEmail(email)
      if (user) {
        await updateUser(user.id, { name: acct.name, isActive: true, role, companyId })
        await updateUserPassword(user.id, passwordHash)
        console.log(`  ✓ ${email} already exists — refreshed  (${acct.password})  — role: ${role}${companySuffix}`)
      } else {
        user = await createUser({ name: acct.name, email, mobile: null, passwordHash, role, companyId })
        console.log(`  ✓ ${user.email}  (${acct.password})  — role: ${role}${companySuffix}`)
      }
      additionalUsers.push({ user, role })
    }
  }

  // ── Default user_settings (tools access) ───────────────────────────────────
  console.log('\n🔧  Seeding default user_settings...\n')

  await createUserSettings(masterAdmin.id, 'master_admin')
  console.log(`  ✓ user_settings for ${masterAdmin.email}`)
  if (companyAdmin) {
    await createUserSettings(companyAdmin.id, 'admin')
    console.log(`  ✓ user_settings for ${companyAdmin.email}`)
  }
  for (const { user, role } of additionalUsers) {
    await createUserSettings(user.id, role)
    console.log(`  ✓ user_settings for ${user.email}`)
  }

  console.log('\n✅  Seed complete!\n')
}

main().catch((err) => {
  console.error('\n❌  Seed failed:', err)
  process.exit(1)
})
