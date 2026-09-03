// Listing Tools storage — no relational DB in this app (see lib/db.js's own
// header comment), so template metadata, full sheet content, and the SKU
// registry are each their own JSON file in Dropbox (lib/storage/dropbox.js's
// readJsonFile/writeJsonFile), under DATA_FOLDER. Independent of lib/db.js's
// `sku_masters`/`sku_mappings` (those stay scoped to the 'pdf-cropper' tool)
// — this feature owns its own storage end to end, per the confirmed product
// decision. Moved off Vercel Blob (lib/blobStore.js, still used by lib/db.js
// for users/companies/theme) after that store was suspended account-wide —
// Dropbox was already this feature's provider for uploaded files (source
// workbook, product images), so its JSON "database" moved onto the same
// provider rather than waiting on Vercel to restore the suspended store.
import { nanoid } from 'nanoid'
import { readJsonFile, writeJsonFile, uploadFile as uploadToDropbox } from './storage/dropbox'

const TEMPLATES_KEY = 'listing_templates'
// "Optional" (a 4th group) was retired — every template's own Optional headers/rows were
// migrated into Compulsory (see scripts/migrate_optional_to_brand_details.mjs, already run
// against every template that existed at the time), and PATCH/[templateId]'s own structure-edit
// handler rewrites `content.sheets` from exactly this list on every save — so a group left out of
// it here isn't just hidden from the UI, its stored data would be dropped the next time any
// template's structure is edited. Never remove a group from this list without confirming nothing
// still has real data under it (re-run that migration script's dry mode to check).
const GROUPS = ['design_system', 'compulsory', 'prefill']
const SHEET_LABELS = {
  design_system: 'Product details',
  compulsory: 'Compulsory',
  prefill: 'Brand Details',
}

function now() {
  return new Date().toISOString()
}

const DATA_FOLDER = '/tools/listing-tools-template/template-data'
const SOURCE_FILE_FOLDER = '/tools/listing-tools-template/template-sheets'

// `key` is one of TEMPLATES_KEY / contentKey(id) / skuKey(id) below — all of
// them plain slash-separated strings, so they double as a Dropbox sub-path
// (e.g. DATA_FOLDER + "/listing-templates/abc123.json") with no translation.
function dataPath(key) {
  return `${DATA_FOLDER}/${key}.json`
}

function contentKey(templateId) {
  return `listing-templates/${templateId}`
}

const TEMPLATE_NUMBER_REGISTRY_KEY = 'listing_template_number_registry'

// Sequential, human-readable, unique-per-template identifier ("TPL-0001", "TPL-0002", ...) —
// assigned once at creation and never editable afterward (createTemplateMeta is the only caller;
// updateTemplateMeta's callers never include it in their patch). A plain read-then-write counter,
// not a transaction — same non-atomic-increment pattern this file's own SKU registry
// (getSkuRegistry/computeSku) already uses, acceptable here for the same reason: template
// creation is a low-frequency admin action, not a high-concurrency write path.
async function nextTemplateNumber() {
  const registry = await readJsonFile(dataPath(TEMPLATE_NUMBER_REGISTRY_KEY), { counter: 0 })
  const next = (registry.counter || 0) + 1
  await writeJsonFile(dataPath(TEMPLATE_NUMBER_REGISTRY_KEY), { counter: next })
  return `TPL-${String(next).padStart(4, '0')}`
}

// Stores the raw uploaded workbook verbatim (not JSON — the actual .xlsx
// bytes) so it can later be re-opened with full styling by
// lib/exports/excelTemplateEngine.js. Lives in Dropbox (lib/storage/dropbox.js)
// under SOURCE_FILE_FOLDER, same provider already used for Listing Tools
// product images — moved off Vercel Blob after that store's files were
// deleted, which was breaking every new upload with a 500.
export async function uploadTemplateSourceFile(file) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const uploaded = await uploadToDropbox(
    SOURCE_FILE_FOLDER,
    `${nanoid()}.xlsx`,
    buffer,
    file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  return uploaded.url
}

function skuKey(templateId) {
  return `listing-sku-registry/${templateId}`
}

// ─── Template metadata (listing_templates collection) ─────────────────────

async function getTemplateRows() {
  const data = await readJsonFile(dataPath(TEMPLATES_KEY), [])
  return Array.isArray(data) ? data : []
}

async function writeTemplateRows(rows) {
  await writeJsonFile(dataPath(TEMPLATES_KEY), rows)
}

export async function listTemplates({ ownerUserId, companyId } = {}) {
  const rows = await getTemplateRows()
  let filtered = rows
  if (ownerUserId) filtered = filtered.filter((r) => r.ownerUserId === ownerUserId)
  // Nullish, not falsy — companyId: null is a legitimate scope (templates
  // with no company) and must stay distinguishable from "no filter passed".
  if (companyId !== undefined) filtered = filtered.filter((r) => (r.companyId ?? null) === (companyId ?? null))
  return [...filtered].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

// Single source of truth for "can this viewer see/open/fill this template" —
// used both by listVisibleTemplatesForViewer (list endpoint) AND by every
// per-template route's own authorization check (GET/PATCH/DELETE/sheets/
// ai-fill/ai-fill-bulk/images/skus), so a template that's visible in a list
// is *always* openable, never a 403 the list itself didn't predict. Rule:
// master_admin — everything. Own template — always, any isAllowedToShow
// state. An admin — also every one of its own sub-users' templates,
// unconditionally (an admin manages its whole company's drafts, toggled-on
// or not). Everyone else — master_admin's templates and (for a plain
// 'user') its own admin's templates, but only once isAllowedToShow is true.
// Peer 'user' accounts under the same admin never see each other's own
// templates.
export function canAccessTemplate(template, { userId, role, companyId }) {
  if (role === 'master_admin') return true
  if (template.ownerUserId === userId) return true
  const scopedCompanyId = companyId ?? null
  if (role === 'admin' && template.ownerRole === 'user' && (template.companyId ?? null) === scopedCompanyId) return true
  if (!template.isAllowedToShow) return false
  if (template.ownerRole === 'master_admin') return true
  if (role === 'user' && template.ownerRole === 'admin' && (template.companyId ?? null) === scopedCompanyId) return true
  return false
}

export async function listVisibleTemplatesForViewer({ userId, role, companyId }) {
  const all = await listTemplates({})
  return all.filter((t) => canAccessTemplate(t, { userId, role, companyId }))
}

const ROLE_LABEL = { master_admin: 'Master Admin', admin: 'Admin', user: 'User' }

// Badge detail scales with the viewer's own role — least-privilege on who
// gets to see who made what:
//  - Own template → always 'self', for every viewer role (outranks
//    everything else — master_admin/admin viewing their own still gets
//    'self', not 'default'/an identity).
//  - master_admin viewer → full transparency: every other template shows
//    the real creator's name + role ('identity').
//  - admin viewer → master_admin's templates are abstracted to 'default';
//    a sub-user's template shows that sub-user's real name + role
//    ('identity') since the admin manages that user directly.
//  - user viewer (least privilege) → never a name or role, ever. Only the
//    two abstract categories: master_admin's templates are 'default', its
//    own admin's templates are 'main'.
// Templates created before ownerRole existed have it undefined/null, which
// falls through to no badge for anyone but their own owner.
export function templateBadgeFor(template, viewer) {
  if (template.ownerUserId === viewer.userId) return { type: 'self', label: 'Self' }

  const identity = { type: 'identity', label: `${template.ownerUserName || 'Unknown'} · ${ROLE_LABEL[template.ownerRole] || 'Unknown'}` }

  if (viewer.role === 'master_admin') return identity

  if (viewer.role === 'admin') {
    if (template.ownerRole === 'master_admin') return { type: 'default', label: 'Default' }
    return identity
  }

  // viewer.role === 'user'
  if (template.ownerRole === 'master_admin') return { type: 'default', label: 'Default' }
  if (template.ownerRole === 'admin') return { type: 'main', label: 'Main' }
  return null
}

export async function getTemplateMeta(templateId) {
  const rows = await getTemplateRows()
  return rows.find((r) => r.id === templateId) ?? null
}

// templateName is a real, independently-typed field (the wizard's own "Template Name" input —
// no longer derived from marketplaceName/category1/exportVersion, see finalName below).
// templateNumber is assigned here, once, and never appears in updateTemplateMeta's own callers'
// patches — it's permanent for the life of the template. marketplaceName/category1-4/
// exportVersion/finalName come from Template Settings' "Preset & Export Configuration" section —
// purely descriptive metadata for telling similarly-named templates apart (e.g. the same design
// re-exported for Meesho vs Amazon, or organized under different category trees); nothing
// downstream reads category2-4 yet. aiRules is the "AI Rules & Template Generation" section's
// prompt bundle — also just stored as-is, no generation step consumes it yet.
export async function createTemplateMeta({
  templateName, description, companyId, ownerUserId, ownerUserName, ownerRole, sourceFileName,
  sourceFileUrl, sourceSheetName,
  marketplaceName, category1, category2, category3, category4, category5, category6,
  exportVersion, finalName, aiRules, rowCounts,
}) {
  const rows = await getTemplateRows()
  const meta = {
    id: nanoid(10),
    templateNumber: await nextTemplateNumber(),
    templateName: templateName?.trim() || 'Untitled Template',
    description: description?.trim() || '',
    companyId: companyId ?? null,
    ownerUserId: ownerUserId ?? null,
    ownerUserName: ownerUserName ?? null,
    // Stamped from the creator's role at create time — powers the
    // Default/Admin/Self visibility rule and badge in listVisibleTemplatesForViewer/
    // templateBadgeFor above. Never recomputed after creation (a role change
    // later doesn't retroactively relabel old templates).
    ownerRole: ownerRole ?? null,
    version: 1,
    // Accepts the real counts up front (route.js computes them from the
    // sheets in the same request) so a brand-new template never needs an
    // immediate follow-up updateTemplateMeta() call — see route.js POST for
    // why that follow-up used to race Blob's read-after-write consistency.
    rowCounts: rowCounts || { design_system: 0, compulsory: 0, prefill: 0 },
    sourceFileName: sourceFileName ?? null,
    // The raw uploaded .xlsx, kept verbatim in Blob storage so exports can
    // fill data back into it (preserving its real styling) instead of
    // generating a plain sheet from scratch, and so the Excel Formats tab
    // can show it exactly as uploaded. `.xls` uploads and templates created
    // before this existed have both null — both features degrade to their
    // old/plain behavior rather than breaking (see excelTemplateEngine.js
    // and ExcelFormatsView.jsx).
    sourceFileUrl: sourceFileUrl ?? null,
    // Which sheet inside sourceFileUrl is the Product Data Sheet every
    // header's sourceColIndex is relative to — needed at export time to
    // find the right sheet to clone/fill.
    sourceSheetName: sourceSheetName ?? null,
    marketplaceName: marketplaceName?.trim() || '',
    category1: category1?.trim() || '',
    category2: category2?.trim() || '',
    category3: category3?.trim() || '',
    category4: category4?.trim() || '',
    category5: category5?.trim() || '',
    category6: category6?.trim() || '',
    exportVersion: exportVersion?.trim() || '',
    // Informational only ("what would this export be named") — never the actual filename used by
    // any Download/Export path (those use templateName directly, see lib/exports/listingExport.js),
    // and independent of templateName itself now that it's a real typed field. Uses the caller's
    // explicit finalName when given (New Design's composed preview), else the marketplace/
    // category1/version default.
    finalName: (typeof finalName === 'string' && finalName.trim())
      ? finalName.trim()
      : [marketplaceName, category1, exportVersion].map((s) => s?.trim()).filter(Boolean).join('_'),
    aiRules: aiRules ?? null,
    // Off by default — a brand-new template stays out of Auto Listing /
    // Choose Your Template until someone explicitly flips it on from the
    // Template Settings list, so a template mid-setup never shows up as
    // "ready" before it actually is.
    isAllowedToShow: false,
    createdAt: now(),
    updatedAt: now(),
  }
  rows.unshift(meta)
  await writeTemplateRows(rows)
  return meta
}

export async function updateTemplateMeta(templateId, patch) {
  const rows = await getTemplateRows()
  const idx = rows.findIndex((r) => r.id === templateId)
  if (idx === -1) throw new Error('Template not found')
  rows[idx] = { ...rows[idx], ...patch, updatedAt: now() }
  await writeTemplateRows(rows)
  return rows[idx]
}

export async function deleteTemplate(templateId) {
  const rows = await getTemplateRows()
  await writeTemplateRows(rows.filter((r) => r.id !== templateId))
  // Content + SKU registry JSON files are left in place (no bulk
  // rename/delete-by-prefix in this app's Dropbox helpers) — harmless
  // orphaned storage rather than risking a partial delete surfacing as an
  // error.
}

// ─── Full sheet content (one JSON file per template) ───────────────────────

function emptySheet(group) {
  return { sheetName: SHEET_LABELS[group], sheetIndex: GROUPS.indexOf(group), group, headers: [], rows: [] }
}

export async function getTemplateContent(templateId) {
  const fallback = {
    templateId,
    sheets: GROUPS.map(emptySheet),
    unmappedHeaders: [],
    dropdownReference: { sheetName: null, columns: {} },
  }
  const data = await readJsonFile(dataPath(contentKey(templateId)), fallback)
  // Backfill any group missing from an older/partial save so callers can
  // always index sheets by group without a null check.
  for (const group of GROUPS) {
    if (!data.sheets.some((s) => s.group === group)) data.sheets.push(emptySheet(group))
  }
  return data
}

export async function saveTemplateContent(templateId, content) {
  await writeJsonFile(dataPath(contentKey(templateId)), content)
  return content
}

// ─── Row / header helpers ───────────────────────────────────────────────────

export function detectDataType(label) {
  return /image|photo|img/i.test(label || '') ? 'image' : 'text'
}

// `aiFilled` (plan §14 — tracks which header ids currently hold AI-generated
// values) is a bookkeeping key, not a header id — it must never be read as
// if it were one of the row's own cell values here or in any of the
// Object.values/keys(row)-style checks below, or a row that's genuinely
// blank (all real headers cleared) could get miscounted as non-empty just
// because a stale `aiFilled` entry is still sitting on it.
function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || v === undefined || v === null || String(v).trim() === '')
}

// Strips every fully-blank row, then appends exactly one — the always-one-
// trailing-empty-row behavior every grid in this feature relies on.
export function ensureTrailingEmptyRow(headers, rows) {
  const nonEmpty = (rows || []).filter((r) => !isRowEmpty(r))
  nonEmpty.push(Object.fromEntries(headers.map((h) => [h.id, ''])))
  return nonEmpty
}

function normKey(...parts) {
  return parts.map((p) => String(p ?? '').trim().toLowerCase()).join('::')
}

// Design-System uniqueness is designNumber, Prefill is brandName — in both
// cases the "unique key" header is whichever one in the sheet is flagged
// isUniqueKeyPart (set by the mapping wizard), so this stays generic instead
// of hardcoding header ids.
//
// Bulk upsert, scoped per user: `rows` is always existing (already-saved) +
// this session's new rows, concatenated by the caller (see
// auto-details/page.js's mergedRowsFor / product-details & prefill-details'
// direct sheet.rows edits) — folds that combined array down to at most one
// row per (owner, key) pair. The later occurrence always wins, which is
// always the freshly-submitted row since callers append new rows after
// existing ones — so this doubles as "update if the key already exists,
// create if it doesn't," with no 409 rejection. New rows without a `userId`
// yet are stamped with `currentUserId` here (server-authenticated from the
// request, never trusted from the client body). Rows saved before this
// existed have no `userId` — bucketed under 'unowned' so they keep folding
// with each other (preserves the old shared-pool dedup behavior for old
// data) but never collide with a specific user's new entries, keeping one
// user's history/uniqueness fully independent of another's.
export function upsertRowsByOwner(currentUserId, headers, rows) {
  const keyHeaders = headers.filter((h) => h.isUniqueKeyPart)
  const stamped = rows.map((row) => (isRowEmpty(row) || row.userId ? row : { ...row, userId: currentUserId }))
  if (keyHeaders.length === 0) return stamped
  const indexByKey = new Map()
  const result = []
  for (const row of stamped) {
    if (isRowEmpty(row)) { result.push(row); continue } // the trailing blank row is never folded
    const hasValue = keyHeaders.some((h) => String(row[h.id] ?? '').trim())
    if (!hasValue) { result.push(row); continue }
    const key = (row.userId ?? 'unowned') + '::' + normKey(...keyHeaders.map((h) => row[h.id]))
    if (indexByKey.has(key)) result[indexByKey.get(key)] = row
    else { indexByKey.set(key, result.length); result.push(row) }
  }
  return result
}

// ─── SKU registry (per template, independent of pdf-cropper's SKU tables) ──

async function getSkuRegistry(templateId) {
  return readJsonFile(dataPath(skuKey(templateId)), { counters: {} })
}

async function writeSkuRegistry(templateId, registry) {
  await writeJsonFile(dataPath(skuKey(templateId)), registry)
}

function slugPart(value, len) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, len)
}

function computeSku(registry, { brand, design, size }) {
  const baseKey = [slugPart(brand, 6), slugPart(design, 8), slugPart(size, 4)].filter(Boolean).join('-') || 'ITEM'
  const seq = (registry.counters[baseKey] ?? 0) + 1
  registry.counters[baseKey] = seq
  return `${baseKey}-${String(seq).padStart(2, '0')}`
}

export async function nextSku(templateId, params = {}) {
  const registry = await getSkuRegistry(templateId)
  const sku = computeSku(registry, params)
  await writeSkuRegistry(templateId, registry)
  return sku
}

// Batch-assigns SKUs to every non-blank row missing one — used at
// export/generate time (Decision: "assign SKUs to any row that doesn't have
// one yet" before billing). Single registry read/write for the whole batch
// so sequential suffixes stay correct without N round trips.
export async function assignSkusToRows(templateId, rows, keyHeaderIds = {}) {
  const registry = await getSkuRegistry(templateId)
  let changed = false
  const nextRows = rows.map((row) => {
    if (row.sku || isRowEmpty(row)) return row
    const sku = computeSku(registry, {
      brand: keyHeaderIds.brand ? row[keyHeaderIds.brand] : undefined,
      design: keyHeaderIds.design ? row[keyHeaderIds.design] : undefined,
      size: keyHeaderIds.size ? row[keyHeaderIds.size] : undefined,
    })
    changed = true
    return { ...row, sku }
  })
  if (changed) await writeSkuRegistry(templateId, registry)
  return { rows: nextRows, changed }
}

// ─── Historical-row retrieval (AI Auto-Fill grounding, plan §3b) ───────────

// Decision #5 — retrieval scope is every template owned by the same
// company, not just the current one ("give customers their previous filled
// data"), matched by label (Decision #4) since each template's headers are
// its own independently-shaped schema. Known v1 performance caveat: this is
// an O(templates) Blob-JSON read per AI-fill call, acceptable at today's
// per-company template counts but worth revisiting (e.g. a denormalized
// "recent rows by label" index) if a company accumulates hundreds of
// templates.
export async function findSimilarRows({ companyId, group, matchLabels, matchValues, limit = 3 }) {
  if (!matchLabels?.length) return []
  const templates = await listTemplates({ companyId })
  const candidates = []
  for (const meta of templates) {
    const content = await getTemplateContent(meta.id)
    const sheet = content.sheets.find((s) => s.group === group)
    if (!sheet) continue
    const labelToId = Object.fromEntries(sheet.headers.map((h) => [h.label.toLowerCase(), h.id]))
    for (const row of sheet.rows) {
      if (isRowEmpty(row)) continue
      let score = 0
      for (const label of matchLabels) {
        const hid = labelToId[label.toLowerCase()]
        if (hid && row[hid] && String(row[hid]).toLowerCase() === String(matchValues[label] ?? '').toLowerCase()) score++
      }
      if (score > 0) candidates.push({ score, row, headers: sheet.headers, templateId: meta.id, templateName: meta.templateName })
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, limit)
}

export { GROUPS, SHEET_LABELS, nextTemplateNumber }
