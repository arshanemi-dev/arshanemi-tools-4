import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import {
  getTemplateMeta, getTemplateContent, saveTemplateContent, updateTemplateMeta,
  ensureTrailingEmptyRow, upsertRowsByOwner, assignSkusToRows, canAccessTemplate, GROUPS,
} from '@/lib/listingTemplates'
import { recordTemplateHistory, syncProductDetailsHistory, syncPrefillDetailsHistory } from '@/lib/listingHistory'
import { runServerBillingGate } from '@/lib/serverBilling'

// One request for the entire Download/Save action: (1) merge + persist any
// caller-supplied `sessionRows` (Auto Listing only — Product Details/Prefill
// Details already persist per-cell via sheets/[group]/route.js's own PATCH,
// so they never send this) onto the server's own current sheets, (2) bill
// for the resulting real row count, (3) assign SKUs to any design_system row
// still missing one, all server-side in one round trip, returning the final
// content so the caller can generate the file locally with no further
// requests. Replaces what used to be up to ~8 separate requests for a single
// Auto Listing download (a GET, four parallel PATCHes, a dry-run, the real
// bill, a SKU POST) — the repeated round trips were the actual latency
// problem, not any one call being slow on its own.
//
// No confirm-before-charge step (that was tried and reverted — the extra
// dry-run round trip it required is exactly the kind of thing this endpoint
// exists to cut) — bills immediately; a `blocked` response is the only thing
// the client ever surfaces to the user (BillingGateModal), success proceeds
// straight to file generation.

// `aiFilled` (plan §14) is a bookkeeping key, not a header id.
function isRowEmpty(row) {
  return Object.entries(row || {}).every(([k, v]) => k === 'aiFilled' || v === undefined || v === null || String(v).trim() === '')
}
function countFilledRows(rows) {
  return rows.filter((r) => Object.entries(r).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim())).length
}

function guessKeyHeaderIds(headers) {
  const find = (re) => headers.find((h) => re.test(h.label || ''))?.id
  return {
    design: headers.find((h) => h.isUniqueKeyPart)?.id || find(/design/i),
    brand: find(/brand/i),
    size: find(/size/i),
  }
}

// `aiFilled` (plan §14) is a bookkeeping key, not a header id — excluded so
// it can never make an otherwise-blank row count as "filled" (mirrors every
// other copy of this check across the app).
//
// Deliberately NOT expanded through expandMultiSelectRows here — that
// explodes one row into N rows (one per Multi Select option) for the
// *exported file*, which is correct for the file but wrong for billing:
// filling in one product row with a 4-option Multi Select field isn't 4
// billable products, it's 1. Billing counts what the user actually typed
// (real rows), not how many lines that expands to in the spreadsheet.
//
// Counted against Product Details (design_system) specifically, not
// whichever group has the most rows — design_system is the one sheet a SKU
// actually gets assigned against (see useTemplateExport.js) and the one every
// other comment in this codebase calls "the unit of a product row"; the other
// three groups are just extra columns *about* those same products. Taking the
// max across groups was tried and reverted — in practice the four groups
// drift out of the "row i is the same product in every group" alignment
// (stale/orphaned rows left in Compulsory/Prefill/Optional from earlier
// sessions, never cleaned up), so "max" ended up billing for whichever group
// had accumulated the most unrelated leftover rows, not the real product
// count. Falls back to whichever single group was requested when
// design_system isn't included (e.g. a Product Details/Prefill Details tab
// download of just one other group).
//
// Deduplicated by the sheet's unique-key header (Product Number for
// design_system, via isUniqueKeyPart) rather than raw row count — a product
// re-typed into a second row is still one billable product, not several. A
// filled row with no value in that header at all can't be deduped against
// anything, so it's counted on its own rather than silently dropped or
// merged into an unrelated row.
function countBillableRows(content, groups) {
  const primary = groups.includes('design_system') ? 'design_system' : groups[0]
  const sheet = (content.sheets || []).find((s) => s.group === primary)
  if (!sheet) return 0
  const filledRows = (sheet.rows || []).filter((row) => Object.entries(row).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').trim()))

  const keyHeader = (sheet.headers || []).find((h) => h.isUniqueKeyPart)
  if (!keyHeader) return filledRows.length

  const seenKeys = new Set()
  let count = 0
  for (const row of filledRows) {
    const key = String(row[keyHeader.id] ?? '').trim()
    if (!key) { count++; continue }
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    count++
  }
  return count
}

export async function POST(req, { params }) {
  const { templateId } = await params
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = await getTemplateMeta(templateId)
  if (!meta) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  if (!canAccessTemplate(meta, payload)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const groups = Array.isArray(body.groups) && body.groups.length
    ? body.groups
    : ['design_system', 'compulsory', 'prefill', 'optional']
  const sessionRows = body.sessionRows && typeof body.sessionRows === 'object' ? body.sessionRows : null

  const content = await getTemplateContent(templateId)

  // Merge + persist — mirrors sheets/[group]/route.js's own PATCH logic
  // (upsert-by-owner, keyed off isUniqueKeyPart; ensureTrailingEmptyRow) —
  // just inline for every group in one pass instead of one HTTP round trip
  // per group. "Existing" here is this same request's own fresh read of
  // `content` above, never a client-cached copy, so this can't resurrect a
  // row someone/something else already removed or changed.
  if (sessionRows) {
    const rowCountPatch = {}
    const historyJobs = []
    for (const group of GROUPS) {
      const incoming = Array.isArray(sessionRows[group]) ? sessionRows[group] : null
      if (!incoming) continue
      const sheetIndex = content.sheets.findIndex((s) => s.group === group)
      const existingSheet = content.sheets[sheetIndex]
      const effectiveHeaders = existingSheet?.headers || []
      const merged = [...(existingSheet?.rows || []).filter((r) => !isRowEmpty(r)), ...incoming.filter((r) => !isRowEmpty(r))]
      const upserted = upsertRowsByOwner(payload.userId, effectiveHeaders, merged)
      const normalizedRows = ensureTrailingEmptyRow(effectiveHeaders, upserted)
      const nextSheet = { ...(existingSheet || {}), sheetName: existingSheet?.sheetName, group, headers: effectiveHeaders, rows: normalizedRows }
      if (sheetIndex === -1) content.sheets.push(nextSheet)
      else content.sheets[sheetIndex] = nextSheet

      rowCountPatch[group] = countFilledRows(normalizedRows)
      historyJobs.push(recordTemplateHistory(req, {
        templateId, templateName: meta.templateName, sheetGroup: group, action: 'save',
        snapshotMeta: { rowCount: rowCountPatch[group] },
      }))

      if (group === 'design_system' || group === 'prefill') {
        const keyHeader = effectiveHeaders.find((h) => h.isUniqueKeyPart)
        if (keyHeader) {
          const ownRows = normalizedRows.filter((r) => r.userId === payload.userId && String(r[keyHeader.id] ?? '').trim())
          if (group === 'design_system') {
            historyJobs.push(syncProductDetailsHistory(req, {
              templateId, templateName: meta.templateName,
              rows: ownRows.map((r) => ({ productNumber: r[keyHeader.id], rowData: r })),
            }))
          } else {
            historyJobs.push(syncPrefillDetailsHistory(req, {
              templateId, templateName: meta.templateName,
              rows: ownRows.map((r) => ({ brand: r[keyHeader.id], rowData: r })),
            }))
          }
        }
      }
    }

    await saveTemplateContent(templateId, content)
    // One meta write for every touched group instead of one per group — same reasoning as
    // batching the four PATCH round trips: sequential read-modify-writes to the same row would
    // otherwise both be slower and risk one overwriting another's version bump.
    await updateTemplateMeta(templateId, { version: (meta.version || 1) + 1, rowCounts: { ...meta.rowCounts, ...rowCountPatch } })
    // Hub history logging is explicitly best-effort (see listingHistory.js) — run concurrently,
    // not one-after-another, so up to six external log calls can't stack into six times the
    // latency; still awaited (via allSettled) so they finish before this function returns rather
    // than racing a serverless freeze.
    await Promise.allSettled(historyJobs)
  }

  const quantity = countBillableRows(content, groups) || 1

  const gate = await runServerBillingGate(req, { toolSlug: 'listing-tools', featureApiIdentifier: 'listing-export', quantity })
  if (gate.status === 'blocked') {
    return NextResponse.json({ blocked: true, reason: gate.reason, data: gate.data }, { status: 402 })
  }

  // SKU assignment — inline, same as the old dedicated /skus route, folded in here so a download
  // never needs a second request for it.
  if (groups.includes('design_system')) {
    const sheet = content.sheets.find((s) => s.group === 'design_system')
    if (sheet) {
      const { rows, changed } = await assignSkusToRows(templateId, sheet.rows, guessKeyHeaderIds(sheet.headers))
      if (changed) {
        sheet.rows = rows
        await saveTemplateContent(templateId, content)
      }
    }
  }

  return NextResponse.json({ ok: true, quantity, content, ...gate.data })
}
