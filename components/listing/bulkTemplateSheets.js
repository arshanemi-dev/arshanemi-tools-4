// The bulk mapping page's (BulkTemplateDesign.jsx) conversion between its
// working list of mapped headers and a template's saved sheets — both
// directions, no React, so the saved shape can be exercised on its own.
//
// A mapped header ("Our Header") can stand for several of the marketplace
// sheet's own columns at once ("Product Name" ← "Title" + "Product Title").
// That mapping is saved ON each header, because headers are the one part of
// a template both storage backends (Dropbox JSON, hub Postgres — see
// lib/listingStore.js) keep exactly as sent:
//   sheetHeaders   — the marketplace column names mapped onto this header
//   sourceColumns  — [{ label, colIndex }] where each of those sits in the
//                    original sheet (0-based column)
//   sourceColIndex — the first of them, for readers that only know one
//   sourceRows     — { header, dataStart }: 1-based Excel rows of that
//                    sheet's header row and its first product row
//   ourHeaderId    — the Our Header (dictionary entry) it was made from
//
// One more thing a header can carry: `multiValueSeparator`, on a Multi
// Select the SHEET made (a column its marketplace fills with several values
// in one cell — on Flipkart, a list that's only on a reference sheet with no
// dropdown on the input sheet, joined by "::"). A download writes
// such a field's picks into one cell joined by it; a Multi Select someone
// set by hand has none and still makes one row per pick
// (lib/exports/expandMultiSelectRows.js).
// The Auto Listing page shows one field per header; the export
// (lib/exports/excelTemplateEngine.js) writes that one value into every
// column listed here.

export const REAL_GROUPS = ['design_system', 'compulsory', 'prefill']
export const SHEET_LABELS = { design_system: 'Product details', compulsory: 'Compulsory', prefill: 'Brand Details' }
// defaultHeaders.json's own label for the header whose cell drives Auto
// Listing's Product Group auto-load (`isProductGroupField`). This page has
// no control for that flag, so a Product details header with this name gets it.
const PRODUCT_GROUP_LABEL = 'product group'

function slugify(label) {
  return String(label || 'col').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'col'
}

export function seedFromExistingContent(content) {
  const out = []
  for (const sheet of content.sheets || []) {
    for (const h of sheet.headers || []) {
      out.push({
        ourHeaderId: h.id,
        ourHeaderLabel: h.label,
        dataType: h.dataType || 'text',
        isUniqueKeyPart: !!h.isUniqueKeyPart,
        // A header saved before its mapping was stored only has its own
        // label to show as "mapped from".
        sheetHeaders: Array.isArray(h.sheetHeaders) && h.sheetHeaders.length ? [...h.sheetHeaders] : [h.label],
        group: h.group || sheet.group,
        position: h.order ?? 0,
        existingId: h.id,
        // The header exactly as saved — buildGroupedSheets starts from it,
        // so a re-save keeps whatever this page has no control for (Product
        // Group flag, where the header came from, its columns in the
        // original sheet).
        saved: h,
        description: h.description || '',
        // Carried through so re-saving without touching the Header Settings
        // modal doesn't wipe what was already configured there (same
        // "preserve on save" fix as description above).
        dropdownValues: h.dropdownSource?.values ? [...h.dropdownSource.values] : [],
        multiValueSeparator: h.multiValueSeparator || '',
        formula: h.formula || '',
        disabled: !!h.disabled,
        linkedGroup: h.linkedGroup || null,
        linkedHeaderId: h.linkedHeaderId || null,
        linkedHeaderIds: Array.isArray(h.linkedHeaderIds) ? h.linkedHeaderIds : [],
        uiBucket: h.uiBucket || null,
      })
    }
  }
  return out
}

// Where a header's value goes in the original sheet. With a sheet open
// (`sheetSource`, see extractSessionSheet) every position is read fresh off
// it — a header none of whose columns exist there ends up with none. With
// no sheet open, the header keeps the columns it was saved with, minus any
// whose mapping was removed since.
function sourceFieldsFor(m, sheetSource) {
  if (sheetSource) {
    const found = m.sheetHeaders.filter((sh) => sheetSource.cols[sh] != null)
    const sourceColumns = found.map((sh) => ({ label: sh, colIndex: sheetSource.cols[sh] }))
    return {
      sheetHeaders: found.length ? found : [...m.sheetHeaders],
      sourceColumns,
      sourceColIndex: sourceColumns[0]?.colIndex,
      sourceRows: sourceColumns.length ? { header: sheetSource.headerRow, dataStart: sheetSource.dataStartRow } : undefined,
    }
  }
  const saved = m.saved
  // Mapped this session with nothing to read positions from.
  if (!saved) return { sheetHeaders: [...m.sheetHeaders], sourceColumns: [], sourceColIndex: undefined, sourceRows: undefined }
  const savedColumns = Array.isArray(saved.sourceColumns) && saved.sourceColumns.length
    ? saved.sourceColumns
    // A header the older wizard saved: one column, named by its own label.
    : (saved.sourceColIndex != null ? [{ label: saved.label, colIndex: saved.sourceColIndex }] : [])
  const sourceColumns = savedColumns.filter((c) => m.sheetHeaders.includes(c.label))
  return {
    // Only a header that was saved with real column names keeps a list —
    // the label stand-in seedFromExistingContent shows is never written back.
    sheetHeaders: Array.isArray(saved.sheetHeaders) ? [...m.sheetHeaders] : undefined,
    sourceColumns,
    sourceColIndex: sourceColumns[0]?.colIndex,
    sourceRows: sourceColumns.length ? saved.sourceRows : undefined,
  }
}

// `dropdownColumns` — this session's detected dropdown values (see
// extractSessionSheet / lib/dropdownExtraction.js), keyed directly by the
// raw sheetHeader label they belong to, so this is just a direct lookup
// (any cross-sheet Validations-sheet matching already happened). A match
// upgrades a plain 'text' dataType to 'dropdown'; an Our Header already
// configured as dropdown/multiselect keeps its own dataType and just gets
// the values. `rawHeaderNotes` — the I section row's text, keyed by raw
// label (see the combined extraction effect), carried through as each
// header's description. `sheetSource` — { cols: {[rawLabel]: colIndex},
// headerRow, dataStartRow } of the sheet these headers were mapped from, or
// null when none is open (see sourceFieldsFor).
export function buildGroupedSheets(mappedHeaders, dropdownColumns = {}, rawHeaderNotes = {}, sheetSource = null) {
  const byGroup = { design_system: [], compulsory: [], prefill: [] }
  for (const m of mappedHeaders) {
    if (!m.group || m.sheetHeaders.length === 0) continue
    byGroup[m.group]?.push(m)
  }
  for (const g of REAL_GROUPS) byGroup[g].sort((a, b) => a.position - b.position)

  // Every header's saved id, settled before any header is built: "Auto-Fill
  // From" is picked on this page by Our Header id, but the fill pages
  // (linkedHeaders.js) look a link up by the saved header's own id.
  const stamp = Date.now()
  const savedIdOf = new Map()
  const groupOfSavedId = new Map()
  for (const g of REAL_GROUPS) {
    byGroup[g].forEach((m, idx) => {
      let id = m.existingId
      if (!id) {
        const base = `hdr_${slugify(m.ourHeaderLabel)}_${idx}_${stamp}`
        id = base
        for (let n = 2; groupOfSavedId.has(id); n++) id = `${base}_${n}`
      }
      savedIdOf.set(m.ourHeaderId, id)
      groupOfSavedId.set(id, g)
    })
  }
  const placed = REAL_GROUPS.flatMap((g) => byGroup[g])
  const hasProductGroupFlag = placed.some((m) => m.saved?.isProductGroupField)

  return REAL_GROUPS.map((g, i) => {
    const headers = byGroup[g].map((m, idx) => {
      // Auto-detected column (own-column dropdown scan) vs. whatever the
      // Header Settings modal set by hand — manual dataType/dropdownValues
      // win when present, same precedence /new's own save-time logic uses.
      const autoCol = m.sheetHeaders.map((sh) => dropdownColumns[sh]).find(Boolean) || null
      // A type decided here comes off the sheet, same rule as the page's own
      // handleMap: Dropdown, or Multi Select for a several-values-in-one-cell
      // column (autoCol.multiSeparator).
      const typedHere = !(m.dataType && m.dataType !== 'text') && !!autoCol
      const dataType = typedHere ? (autoCol.multiSeparator ? 'multiselect' : 'dropdown') : (m.dataType || 'text')
      const multiValueSeparator = dataType === 'multiselect'
        ? m.multiValueSeparator || (typedHere ? autoCol.multiSeparator : '') || undefined
        : undefined
      const manualValues = Array.isArray(m.dropdownValues) && m.dropdownValues.length ? m.dropdownValues : null
      const note = m.sheetHeaders.map((sh) => rawHeaderNotes[sh]).find(Boolean) || m.description || ''
      // A link to a header that isn't placed any more has nothing to fill from.
      const linkedIds = (Array.isArray(m.linkedHeaderIds) && m.linkedHeaderIds.length
        ? m.linkedHeaderIds
        : (m.linkedHeaderId ? [m.linkedHeaderId] : [])
      ).map((id) => savedIdOf.get(id)).filter(Boolean)
      return {
        ...(m.saved || {}),
        // Which Our Header this field was made from — kept so "is this Our
        // Header already mapped?" (asked before one is deleted) still finds
        // the field after a rename. Only a header mapped in this session
        // knows it; one reopened from a saved template keeps whatever it
        // was saved with (its own `ourHeaderId` on this page is the saved
        // header's id, see seedFromExistingContent).
        ...(m.existingId ? {} : { ourHeaderId: m.ourHeaderId }),
        id: savedIdOf.get(m.ourHeaderId),
        label: m.ourHeaderLabel,
        description: note,
        order: idx,
        group: g,
        dataType,
        multiValueSeparator,
        isUniqueKeyPart: !!m.isUniqueKeyPart,
        isProductGroupField: !!m.saved?.isProductGroupField
          || (!hasProductGroupFlag && g === 'design_system' && m.ourHeaderLabel.trim().toLowerCase() === PRODUCT_GROUP_LABEL),
        linkedGroup: linkedIds.length ? groupOfSavedId.get(linkedIds[0]) : null,
        linkedHeaderId: linkedIds[0] || null,
        linkedHeaderIds: linkedIds,
        uiBucket: m.uiBucket || null,
        formula: m.formula || '',
        disabled: !!m.disabled,
        source: m.saved?.source || 'upload',
        dropdownSource: (dataType === 'dropdown' || dataType === 'multiselect')
          ? {
              sheetName: autoCol?.sheetName || m.saved?.dropdownSource?.sheetName || null,
              columnName: autoCol?.columnName || m.saved?.dropdownSource?.columnName || null,
              values: manualValues || autoCol?.values || [],
            }
          : null,
        ...sourceFieldsFor(m, sheetSource),
      }
    })

    const sampleRow = {}
    headers.forEach((h) => {
      sampleRow[h.label] = `${h.label} Sample`
    })

    return {
      sheetName: SHEET_LABELS[g],
      sheetIndex: i,
      group: g,
      headers,
      rows: headers.length > 0 ? [sampleRow] : [],
    }
  })
}
