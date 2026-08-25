import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import {
  getTemplateMeta, getTemplateContent, saveTemplateContent, updateTemplateMeta,
  ensureTrailingEmptyRow, upsertRowsByOwner, GROUPS, canAccessTemplate,
} from '@/lib/listingTemplates'
import {
  recordTemplateHistory, syncProductDetailsHistory, syncPrefillDetailsHistory,
  deleteProductDetailsHistory, deletePrefillDetailsHistory, toLabelKeyedRow,
} from '@/lib/listingHistory'

// `aiFilled`/bookkeeping aside, the set of this user's own key-header values (Product Number for
// design_system, Brand for prefill) currently present across `rowsToScan` — used both before and
// after this request's own write to spot a key that existed before but not after (see PATCH's own
// comment on why that needs a real hub delete, not just letting upsert silently ignore it).
function ownKeyValues(rowsToScan, userId, keyHeaderId) {
  return new Set(
    rowsToScan
      .filter((r) => r.userId === userId)
      .map((r) => String(r[keyHeaderId] ?? '').trim())
      .filter(Boolean)
  )
}

async function authorizeForTemplate(req, templateId) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const meta = await getTemplateMeta(templateId)
  if (!meta) return { error: NextResponse.json({ error: 'Template not found' }, { status: 404 }) }
  if (!canAccessTemplate(meta, payload)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  return { payload, meta }
}

// `aiFilled` (plan §14) is a bookkeeping key, not a header id — excluded so
// it can never make an otherwise-blank row count as "filled".
function countFilledRows(rows) {
  return rows.filter((r) => Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim())).length
}

// Debounced autosave target — one PATCH per sheet group (design_system /
// compulsory / prefill / optional). Body: { headers, rows }. Bulk upserts by
// whichever header is flagged isUniqueKeyPart in that group (Product Number
// for design_system, Brand for prefill): a submitted row whose key matches
// an already-saved row **owned by the same user** updates that row in
// place; anything else is created new — never rejected with a 409. See
// upsertRowsByOwner's own comment for the per-user scoping rules.
export async function PATCH(req, { params }) {
  const { templateId, group } = await params
  if (!GROUPS.includes(group)) {
    return NextResponse.json({ error: 'Unknown sheet group' }, { status: 400 })
  }
  const { error, meta, payload } = await authorizeForTemplate(req, templateId)
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const headers = Array.isArray(body.headers) ? body.headers : null
  const rows = Array.isArray(body.rows) ? body.rows : null
  if (!rows) return NextResponse.json({ error: 'rows[] is required' }, { status: 400 })

  const content = await getTemplateContent(templateId)
  const existing = content.sheets.find((s) => s.group === group)
  const effectiveHeaders = headers || existing?.headers || []

  // Snapshotted before the write below overwrites `existing` — only for the two groups the hub
  // mirrors to Postgres (design_system/prefill). Compared against the same user's key values
  // after the write (below) to find any key that's gone missing from this request — a row
  // deleted outright, or one whose key field got edited to a new value — so the now-orphaned hub
  // history record for it can be removed too, instead of lingering forever as a ghost only
  // upsert (never delete) ever touched.
  const historyKeyHeader = (group === 'design_system' || group === 'prefill')
    ? effectiveHeaders.find((h) => h.isUniqueKeyPart)
    : null
  const beforeOwnKeys = historyKeyHeader ? ownKeyValues(existing?.rows || [], payload.userId, historyKeyHeader.id) : null

  const upserted = upsertRowsByOwner(payload.userId, effectiveHeaders, rows)
  const normalizedRows = ensureTrailingEmptyRow(effectiveHeaders, upserted)
  const sheetIndex = content.sheets.findIndex((s) => s.group === group)
  const nextSheet = { ...(existing || {}), sheetName: existing?.sheetName, group, headers: effectiveHeaders, rows: normalizedRows }
  if (sheetIndex === -1) content.sheets.push(nextSheet)
  else content.sheets[sheetIndex] = nextSheet

  await saveTemplateContent(templateId, content)
  const updatedMeta = await updateTemplateMeta(templateId, {
    version: (meta.version || 1) + 1,
    rowCounts: { ...meta.rowCounts, [group]: countFilledRows(normalizedRows) },
  })

  await recordTemplateHistory(req, {
    templateId, templateName: meta.templateName, sheetGroup: group, action: 'save',
    snapshotMeta: { rowCount: countFilledRows(normalizedRows) },
  })

  // Mirror this request's own rows into the hub's real Product Details /
  // Prefill Details history tables (see lib/listingHistory.js) — only for
  // the two groups those tables exist for, and only rows owned by this
  // request's user (never a teammate's, even though they may sit in the
  // same submitted/merged array).
  if (historyKeyHeader) {
    const ownRows = normalizedRows.filter((r) => r.userId === payload.userId && String(r[historyKeyHeader.id] ?? '').trim())
    if (group === 'design_system') {
      const groupHeader = effectiveHeaders.find((h) => h.isProductGroupField)
      await syncProductDetailsHistory(req, {
        templateId, templateName: meta.templateName,
        rows: ownRows.map((r) => ({
          productNumber: r[historyKeyHeader.id],
          rowData: toLabelKeyedRow(effectiveHeaders, r),
          groupName: groupHeader ? r[groupHeader.id] : undefined,
        })),
      })
    } else {
      await syncPrefillDetailsHistory(req, {
        templateId, templateName: meta.templateName,
        rows: ownRows.map((r) => ({ brand: r[historyKeyHeader.id], rowData: r })),
      })
    }

    // Any key this user had before this write but doesn't anymore — deleted outright, or renamed
    // via its own key field — needs its stale hub history record removed, not just left behind
    // (see beforeOwnKeys' own comment above for why upsert alone can't cover this).
    const afterOwnKeys = ownKeyValues(normalizedRows, payload.userId, historyKeyHeader.id)
    const removedKeys = [...beforeOwnKeys].filter((k) => !afterOwnKeys.has(k))
    for (const key of removedKeys) {
      if (group === 'design_system') await deleteProductDetailsHistory(req, { templateId, productNumber: key })
      else await deletePrefillDetailsHistory(req, { templateId, brand: key })
    }
  }

  return NextResponse.json({ sheet: nextSheet, template: updatedMeta })
}
