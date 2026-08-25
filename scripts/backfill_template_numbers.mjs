/**
 * Listing Tools — backfill templateNumber on templates created before it existed
 *
 * createTemplateMeta now assigns a unique, sequential `templateNumber` (e.g. "TPL-0001") to
 * every new template. This one-time script assigns one to any existing template that doesn't
 * have one yet, oldest-created first, so the numbering reads in creation order. Safe to re-run:
 * a template that already has a templateNumber is left untouched.
 *
 * Usage:
 *   node --env-file=.env --experimental-loader=./scripts/_ext_resolve_hook.mjs scripts/backfill_template_numbers.mjs           # dry run (default)
 *   node --env-file=.env --experimental-loader=./scripts/_ext_resolve_hook.mjs scripts/backfill_template_numbers.mjs --apply   # actually writes
 */

import { fileURLToPath, pathToFileURL } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href)

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(`\n🔢  Listing Tools — backfill templateNumber ${APPLY ? '(APPLY)' : '(DRY RUN — pass --apply to write)'}\n`)

  const lib = await imp('lib/listingTemplates.js')
  const templates = await lib.listTemplates({})
  const missing = templates
    .filter((t) => !t.templateNumber)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  console.log(`Found ${templates.length} template(s), ${missing.length} missing a templateNumber.\n`)

  for (const meta of missing) {
    if (APPLY) {
      const updated = await lib.updateTemplateMeta(meta.id, { templateNumber: await lib.nextTemplateNumber() })
      console.log(`✓ ${updated.templateName} (${meta.id}) — assigned ${updated.templateNumber}`)
    } else {
      console.log(`→ ${meta.templateName} (${meta.id}) — would assign the next number`)
    }
  }

  console.log(`\nDone.${!APPLY ? ' This was a dry run — nothing was written. Re-run with --apply to commit these changes.' : ''}\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
