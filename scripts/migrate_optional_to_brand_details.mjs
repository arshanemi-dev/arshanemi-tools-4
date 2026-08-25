/**
 * Listing Tools — retire the "Optional" group + rename "Prefill" → "Brand Details"
 *
 * One-time data migration for every existing template's stored content
 * (Dropbox JSON, see lib/listingTemplates.js):
 *   1. Any real headers in a template's "optional" sheet (i.e. anything beyond
 *      the default disabled Product Number mirror, which Compulsory already
 *      has its own copy of) move into that same template's "compulsory" sheet.
 *      Row data merges by position — row i in Optional is the same product as
 *      row i in Compulsory, the same invariant Auto Listing's own session
 *      state relies on everywhere else in this feature. The optional sheet is
 *      left in place but emptied (headers: [], rows: []), not deleted, so
 *      nothing downstream needs a null check.
 *   2. Any "prefill" sheet still on its original default sheetName ("Prefill",
 *      or none at all) is renamed to "Brand Details" — a template someone
 *      already custom-renamed (via the Kanban column's click-to-rename) is
 *      left alone.
 *
 * Safe to re-run: a template with nothing left to move/rename is skipped.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate_optional_to_brand_details.mjs           # dry run (default) — reports only, writes nothing
 *   node --env-file=.env scripts/migrate_optional_to_brand_details.mjs --apply   # actually writes the changes
 */

import { fileURLToPath, pathToFileURL } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href)

const APPLY = process.argv.includes('--apply')

const OLD_PREFILL_DEFAULT_LABELS = new Set(['', 'Prefill'])

// `aiFilled` (plan §14) is a bookkeeping key, not a header id.
function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || v === undefined || v === null || String(v).trim() === '')
}
function countFilledRows(rows) {
  return rows.filter((r) => Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim())).length
}

async function planTemplate(meta, lib) {
  const content = await lib.getTemplateContent(meta.id)
  const compulsory = content.sheets.find((s) => s.group === 'compulsory')
  const optional = content.sheets.find((s) => s.group === 'optional')
  const prefill = content.sheets.find((s) => s.group === 'prefill')

  // Optional's own default header (defaultHeaders.json) is a disabled mirror of design_system's
  // Product Number — Compulsory already carries an identical one of its own, so it's dropped
  // rather than duplicated; only headers a template creator actually added/mapped there move.
  const movableHeaders = (optional?.headers || []).filter(
    (h) => !(h.disabled && h.linkedGroup === 'design_system' && h.isUniqueKeyPart)
  )
  const hasOptionalToMigrate = movableHeaders.length > 0 && !!compulsory
  const needsPrefillRename = !!prefill && OLD_PREFILL_DEFAULT_LABELS.has((prefill.sheetName || '').trim())

  if (!hasOptionalToMigrate && !needsPrefillRename) return null

  let nextCompulsoryHeaders = compulsory?.headers || []
  let nextCompulsoryRows = compulsory?.rows || []

  if (hasOptionalToMigrate) {
    const maxOrder = Math.max(-1, ...nextCompulsoryHeaders.map((h) => h.order ?? 0))
    const movedHeaders = movableHeaders.map((h, i) => ({ ...h, group: 'compulsory', order: maxOrder + 1 + i }))
    nextCompulsoryHeaders = [...nextCompulsoryHeaders, ...movedHeaders]

    const rowCount = Math.max(nextCompulsoryRows.length, optional.rows.length)
    const merged = Array.from({ length: rowCount }, (_, i) => {
      const cRow = nextCompulsoryRows[i] || {}
      const oRow = optional.rows[i] || {}
      const row = { ...cRow }
      for (const h of movableHeaders) row[h.id] = oRow[h.id]
      return row
    }).filter((r) => !isRowEmpty(r))
    nextCompulsoryRows = lib.ensureTrailingEmptyRow(nextCompulsoryHeaders, merged)
  }

  const nextSheets = content.sheets.map((s) => {
    if (s.group === 'compulsory' && hasOptionalToMigrate) return { ...s, headers: nextCompulsoryHeaders, rows: nextCompulsoryRows }
    if (s.group === 'optional' && hasOptionalToMigrate) return { ...s, headers: [], rows: [] }
    if (s.group === 'prefill' && needsPrefillRename) return { ...s, sheetName: 'Brand Details' }
    return s
  })

  return {
    templateId: meta.id,
    templateName: meta.templateName,
    hasOptionalToMigrate,
    needsPrefillRename,
    movedHeaderCount: movableHeaders.length,
    movedRowCount: hasOptionalToMigrate ? countFilledRows(nextCompulsoryRows) : 0,
    nextContent: { ...content, sheets: nextSheets },
    metaPatch: hasOptionalToMigrate
      ? { version: (meta.version || 1) + 1, rowCounts: { ...meta.rowCounts, compulsory: countFilledRows(nextCompulsoryRows), optional: 0 } }
      : null,
  }
}

async function main() {
  console.log(`\n🔄  Listing Tools — retire "Optional" + rename "Prefill" → "Brand Details" ${APPLY ? '(APPLY)' : '(DRY RUN — pass --apply to write)'}\n`)

  const lib = await imp('lib/listingTemplates.js')
  const templates = await lib.listTemplates({})
  console.log(`Found ${templates.length} template(s).\n`)

  let migratedCount = 0
  let renamedCount = 0
  let failedCount = 0

  for (const meta of templates) {
    try {
      const plan = await planTemplate(meta, lib)
      if (!plan) continue

      const parts = []
      if (plan.hasOptionalToMigrate) parts.push(`move ${plan.movedHeaderCount} header(s) from Optional into Compulsory (${plan.movedRowCount} filled row(s) after merge)`)
      if (plan.needsPrefillRename) parts.push('rename Prefill sheet to "Brand Details"')
      console.log(`${APPLY ? '✓' : '→'} ${plan.templateName} (${plan.templateId}) — ${parts.join('; ')}`)

      if (APPLY) {
        await lib.saveTemplateContent(plan.templateId, plan.nextContent)
        if (plan.metaPatch) await lib.updateTemplateMeta(plan.templateId, plan.metaPatch)
      }

      if (plan.hasOptionalToMigrate) migratedCount++
      if (plan.needsPrefillRename) renamedCount++
    } catch (err) {
      failedCount++
      console.error(`✗ ${meta.templateName} (${meta.id}) failed:`, err.message)
    }
  }

  console.log(`\nDone. ${migratedCount} template(s) had Optional headers migrated, ${renamedCount} template(s) had their Prefill sheet renamed${failedCount ? `, ${failedCount} failed` : ''}.`)
  if (!APPLY) console.log('This was a dry run — nothing was written. Re-run with --apply to commit these changes.\n')
  else console.log('')
}

main().catch((err) => { console.error(err); process.exit(1) })
