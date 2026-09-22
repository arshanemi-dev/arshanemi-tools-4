// Hub-backed implementation of lib/listingTemplates.js's storage functions —
// selected over the Dropbox-JSON default by NEXT_PUBLIC_LISTING_STORE=hub
// (see lib/listingStore.js, which is the only module that imports this one).
//
// SERVER-ONLY. Uses next/headers to read the caller's own token off the
// in-flight request and forward it to arshanemi-tools-dashboard's per-user
// /api/listing-tools/templates/** endpoints, so every template row the hub
// stores is scoped to that user (owner_id). lib/listingTemplates.js stays
// 100% Dropbox and client-safe; nothing here is ever imported by a client
// component.

import { headers } from 'next/headers'

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || ''

// design_system | compulsory | prefill — mirrors lib/listingTemplates.js's
// GROUPS / SHEET_LABELS (kept local so this file has no import cycle with it).
const GROUPS = ['design_system', 'compulsory', 'prefill']
const SHEET_LABELS = { design_system: 'Product details', compulsory: 'Compulsory', prefill: 'Brand Details' }

// The caller's own identity, forwarded to the hub. tools-4's client calls
// its listing-tools API with the httpOnly session cookie (barmeto-token, or
// admin-token from the iframe SSO handoff) and no Authorization header, so
// the cookie is the usual source here. Requires the hub to verify with the
// same JWT_SECRET — i.e. NEXT_PUBLIC_LISTING_STORE=hub goes together with
// connected mode / shared secrets.
async function authHeader() {
  const h = await headers()
  const bearer = h.get('authorization')
  if (bearer && bearer.startsWith('Bearer ')) return bearer
  const cookie = h.get('cookie') || ''
  const m = cookie.match(/(?:^|;\s*)(?:barmeto-token|arshanemi-token|admin-token)=([^;]+)/)
  return m ? `Bearer ${decodeURIComponent(m[1])}` : undefined
}

async function hubFetch(path, { method = 'GET', body } = {}) {
  const auth = await authHeader()
  const res = await fetch(`${ADMIN_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Hub request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

function emptySheet(group, i) {
  return { sheetName: SHEET_LABELS[group], sheetIndex: i, group, headers: [], rows: [] }
}

function withAllGroups(sheets) {
  const out = Array.isArray(sheets) ? [...sheets] : []
  GROUPS.forEach((g, i) => {
    if (!out.some((s) => s.group === g)) out.push(emptySheet(g, i))
  })
  return out
}

function metaBody(input) {
  // Owner (owner_id / owner_name / owner_role / company_id) is derived by the
  // hub from the forwarded token — never sent from here.
  const b = {}
  for (const k of ['templateName', 'description', 'sourceFileName', 'sourceFileUrl', 'sourceSheetName',
    'marketplaceName', 'category1', 'category2', 'category3', 'category4', 'category5', 'category6',
    'exportVersion', 'finalName', 'aiRules']) {
    if (input[k] !== undefined) b[k] = input[k]
  }
  return b
}

// ─── Storage functions (same names/shapes as lib/listingTemplates.js) ────────

export async function listTemplates(filter = {}) {
  const { templates } = await hubFetch('/api/listing-tools/templates?scope=all')
  let out = templates || []
  if (filter.ownerUserId) out = out.filter((t) => t.ownerUserId === filter.ownerUserId)
  if (filter.companyId !== undefined) out = out.filter((t) => (t.companyId ?? null) === (filter.companyId ?? null))
  return out
}

// Hub scopes the list to the caller already (own templates, or every
// template for master_admin) — that IS the visible set under the per-owner
// model, so no extra canAccessTemplate pass is needed here.
export async function listVisibleTemplatesForViewer() {
  return listTemplates({})
}

export async function getTemplateMeta(templateId) {
  try {
    const { template } = await hubFetch(`/api/listing-tools/templates/${templateId}`)
    return template || null
  } catch (err) {
    if (err.status === 404 || err.status === 403) return null
    throw err
  }
}

export async function getTemplateContent(templateId) {
  const { content } = await hubFetch(`/api/listing-tools/templates/${templateId}`)
  return {
    templateId,
    sheets: withAllGroups(content?.sheets),
    unmappedHeaders: content?.unmappedHeaders || [],
    dropdownReference: content?.dropdownReference || { sheetName: null, columns: {} },
  }
}

// Two-step on the hub: create the row (with empty sheets so the required
// non-empty sheets[] check passes), then the caller's own saveTemplateContent
// populates each group. Returns the hub template object, same shape
// lib/listingTemplates.js's createTemplateMeta returns.
export async function createTemplateMeta(input) {
  const { template } = await hubFetch('/api/listing-tools/templates', {
    method: 'POST',
    body: {
      ...metaBody(input),
      sheets: GROUPS.map((g, i) => emptySheet(g, i)),
      dropdownReference: { sheetName: null, columns: {} },
    },
  })
  return template
}

export async function updateTemplateMeta(templateId, patch) {
  const { template } = await hubFetch(`/api/listing-tools/templates/${templateId}`, { method: 'PATCH', body: patch })
  return template
}

export async function deleteTemplate(templateId) {
  await hubFetch(`/api/listing-tools/templates/${templateId}`, { method: 'DELETE' })
}

export async function saveTemplateContent(templateId, content) {
  for (const sheet of content?.sheets || []) {
    if (!GROUPS.includes(sheet.group)) continue
    await hubFetch(`/api/listing-tools/templates/${templateId}/sheets/${sheet.group}`, {
      method: 'PATCH',
      body: { headers: sheet.headers || [], rows: sheet.rows || [] },
    })
  }
  await hubFetch(`/api/listing-tools/templates/${templateId}`, {
    method: 'PATCH',
    body: {
      dropdownReference: content?.dropdownReference ?? { sheetName: null, columns: {} },
      unmappedHeaders: content?.unmappedHeaders ?? [],
    },
  })
  return content
}

// ─── SKU registry (hub only persists the counter map) ───────────────────────

function slugPart(value, len) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, len)
}

function computeSku(counters, { brand, design, size }) {
  const baseKey = [slugPart(brand, 6), slugPart(design, 8), slugPart(size, 4)].filter(Boolean).join('-') || 'ITEM'
  const seq = (counters[baseKey] ?? 0) + 1
  counters[baseKey] = seq
  return `${baseKey}-${String(seq).padStart(2, '0')}`
}

function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || k === 'userId' || v === undefined || v === null || String(v).trim() === '')
}

export async function assignSkusToRows(templateId, rows, keyHeaderIds = {}) {
  const { counters } = await hubFetch(`/api/listing-tools/templates/${templateId}/skus`)
  let changed = false
  const nextRows = rows.map((row) => {
    if (row.sku || isRowEmpty(row)) return row
    const sku = computeSku(counters, {
      brand: keyHeaderIds.brand ? row[keyHeaderIds.brand] : undefined,
      design: keyHeaderIds.design ? row[keyHeaderIds.design] : undefined,
      size: keyHeaderIds.size ? row[keyHeaderIds.size] : undefined,
    })
    changed = true
    return { ...row, sku }
  })
  if (changed) {
    await hubFetch(`/api/listing-tools/templates/${templateId}/skus`, { method: 'PUT', body: { counters } })
  }
  return { rows: nextRows, changed }
}

// ─── AI-fill grounding — "previous filled rows" retrieval ───────────────────
// Same shape/logic as lib/listingTemplates.js's findSimilarRows, but sourced
// from the hub. Scope is the caller's own templates (or every template for
// master_admin) rather than "same company" — consistent with per-owner
// isolation.
export async function findSimilarRows({ group, matchLabels, matchValues, limit = 3 }) {
  if (!matchLabels?.length) return []
  const templates = await listTemplates({})
  const candidates = []
  for (const meta of templates) {
    let content
    try {
      content = await getTemplateContent(meta.id)
    } catch {
      continue
    }
    const sheet = content.sheets.find((s) => s.group === group)
    if (!sheet) continue
    const labelToId = Object.fromEntries((sheet.headers || []).map((h) => [String(h.label || '').toLowerCase(), h.id]))
    for (const row of sheet.rows || []) {
      if (isRowEmpty(row)) continue
      let score = 0
      for (const label of matchLabels) {
        const hid = labelToId[String(label).toLowerCase()]
        if (hid && row[hid] && String(row[hid]).toLowerCase() === String(matchValues[label] ?? '').toLowerCase()) score++
      }
      if (score > 0) candidates.push({ score, row, headers: sheet.headers, templateId: meta.id, templateName: meta.templateName })
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, limit)
}
