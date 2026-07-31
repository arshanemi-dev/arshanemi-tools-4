// Listing Tools storage — no relational DB in this app (see lib/db.js's own
// header comment), so template metadata, full sheet content, and the SKU
// registry are each their own Vercel Blob JSON file via lib/blobStore.js.
// Independent of lib/db.js's `sku_masters`/`sku_mappings` (those stay
// scoped to the 'pdf-cropper' tool) — this feature owns its own storage
// end to end, per the confirmed product decision.
import { nanoid } from 'nanoid'
import { readBlobJson, writeBlobJson } from './blobStore'

const TEMPLATES_KEY = 'listing_templates'
const GROUPS = ['design_system', 'compulsory', 'prefill', 'optional']
const SHEET_LABELS = {
  design_system: 'Design details',
  compulsory: 'Compulsory',
  prefill: 'Prefill',
  optional: 'Optional',
}

function now() {
  return new Date().toISOString()
}

function contentKey(templateId) {
  return `listing-templates/${templateId}`
}

function skuKey(templateId) {
  return `listing-sku-registry/${templateId}`
}

// ─── Template metadata (listing_templates collection) ─────────────────────

async function getTemplateRows() {
  const data = await readBlobJson(TEMPLATES_KEY, [])
  return Array.isArray(data) ? data : []
}

async function writeTemplateRows(rows) {
  await writeBlobJson(TEMPLATES_KEY, rows)
}

export async function listTemplates({ companyId } = {}) {
  const rows = await getTemplateRows()
  const filtered = companyId ? rows.filter((r) => r.companyId === companyId) : rows
  return [...filtered].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export async function getTemplateMeta(templateId) {
  const rows = await getTemplateRows()
  return rows.find((r) => r.id === templateId) ?? null
}

// marketplaceName/category/exportVersion/finalName come from Template
// Settings' "Preset & Export Configuration" section — purely descriptive
// metadata for telling similarly-named templates apart (e.g. the same
// design re-exported for Meesho vs Amazon); nothing downstream reads them
// yet. aiRules is the "AI Rules & Template Generation" section's prompt
// bundle — also just stored as-is, no generation step consumes it yet.
export async function createTemplateMeta({
  templateName, description, companyId, ownerUserId, ownerUserName, sourceFileName,
  marketplaceName, category, exportVersion, aiRules,
}) {
  const rows = await getTemplateRows()
  const meta = {
    id: nanoid(10),
    templateName: templateName?.trim() || 'Untitled Template',
    description: description?.trim() || '',
    companyId: companyId ?? null,
    ownerUserId: ownerUserId ?? null,
    ownerUserName: ownerUserName ?? null,
    version: 1,
    rowCounts: { design_system: 0, compulsory: 0, prefill: 0, optional: 0 },
    sourceFileName: sourceFileName ?? null,
    marketplaceName: marketplaceName?.trim() || '',
    category: category?.trim() || '',
    exportVersion: exportVersion?.trim() || '',
    finalName: [marketplaceName, category, exportVersion].map((s) => s?.trim()).filter(Boolean).join('_'),
    aiRules: aiRules ?? null,
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
  // Content + SKU registry blobs are left in place (Vercel Blob has no bulk
  // rename/delete-by-prefix in this app's helpers) — harmless orphaned
  // storage rather than risking a partial delete surfacing as an error.
}

// ─── Full sheet content (one Blob JSON per template) ───────────────────────

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
  const data = await readBlobJson(contentKey(templateId), fallback)
  // Backfill any group missing from an older/partial save so callers can
  // always index sheets by group without a null check.
  for (const group of GROUPS) {
    if (!data.sheets.some((s) => s.group === group)) data.sheets.push(emptySheet(group))
  }
  return data
}

export async function saveTemplateContent(templateId, content) {
  await writeBlobJson(contentKey(templateId), content)
  return content
}

// ─── Row / header helpers ───────────────────────────────────────────────────

export function detectDataType(label) {
  return /image|photo|img/i.test(label || '') ? 'image' : 'text'
}

function isRowEmpty(row) {
  return Object.values(row || {}).every((v) => v === undefined || v === null || String(v).trim() === '')
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

// Design-System uniqueness is templateName+designNumber, Prefill is
// templateName+brandName — in both cases the "unique key" header is
// whichever one in the sheet is flagged isUniqueKeyPart (set by the mapping
// wizard), so this stays generic instead of hardcoding header ids.
export function findDuplicateKeys(templateName, headers, rows) {
  const keyHeaders = headers.filter((h) => h.isUniqueKeyPart)
  if (keyHeaders.length === 0) return []
  const seen = new Map()
  const duplicates = []
  rows.forEach((row, index) => {
    const hasValue = keyHeaders.some((h) => String(row[h.id] ?? '').trim())
    if (!hasValue) return // the trailing blank row is never a duplicate
    const key = normKey(templateName, ...keyHeaders.map((h) => row[h.id]))
    if (seen.has(key)) {
      duplicates.push({ index, key, label: keyHeaders.map((h) => row[h.id]).join(' / ') })
    } else {
      seen.set(key, index)
    }
  })
  return duplicates
}

// ─── SKU registry (per template, independent of pdf-cropper's SKU tables) ──

async function getSkuRegistry(templateId) {
  return readBlobJson(skuKey(templateId), { counters: {} })
}

async function writeSkuRegistry(templateId, registry) {
  await writeBlobJson(skuKey(templateId), registry)
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

export { GROUPS, SHEET_LABELS }
