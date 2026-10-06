// Default row indices & marketplace-specific sheet detection rules.
//
// Per-brand defaults for reading an uploaded marketplace template (bulk
// page, BulkTemplateDesign.jsx). Every number is 1-based, exactly as Excel
// counts sheets/rows/columns — same as the brand table this came from:
//
//              ────────────── INPUT SHEET ──────────────   ─────── VALIDATIONS SHEET ───────
//   BRAND      Sheet  Group  Header  I sec  Dropdown  Start   Sheet  Type        Header  Value  Start
//   Meesho       2      2      3      3       5        4       4    Vertical      1      2      4
//   Flipkart     3      0      1      4       5        4       2    Vertical      2      3      4
//   Amazon       5      3      4      6       8        1       7    Horizontal    2      3      2
//   Myntra       2      –      3      –       4        1       –
//
// - Group 0 / blank = the sheet has no group row; I sec blank = no I section
//   row (both stored as null here, shown as an empty input).
// - Header = I sec (Meesho) means "headers on that row, I section notes on
//   the very next one" — see extractSessionSheet.
// - Dropdown = the first input row of the fill sheet (where the input-rows
//   dropdown source starts reading).
// - Start = the first column reading begins at; every column before it is
//   skipped (Meesho/Flipkart: headers from column D). On the Validations
//   sheet it's the first column when Vertical, the first ROW when
//   Horizontal (Amazon: field names from row 2 down).
// - Validations Header/Value are ROWS when Vertical, COLUMNS when
//   Horizontal (Amazon: field names down column 2, values from column 3).
//   Myntra has no Validations sheet.
// - A listed brand's whole row is filled in at upload exactly as written
//   and read as-is — Validations side included. Only "Re-detect" switches
//   that side to auto-detect (lib/dropdownExtraction.js), where these
//   values are the tie-winning hint.
// Any other brand falls back to `default` (the old generic rule), whose
// Validations sheet is auto-detected from the start — its position is a guess.

export const DEFAULT_SHEET_ROWS = {
  GROUP_ROW: 1,
  HEADER_ROW: 2,
  ISECTION: 2,
  DROPDOWN_HEADER_ROW: 1,
  DROPDOWN_VALUES_ROW: 3,
  // Where a Product fill sheet's own input rows start (input-rows dropdown
  // source, lib/dropdownExtraction.js) when the brand's rule doesn't say —
  // each brand rule below carries its own dropdownDataStartRow.
  DROPDOWN_DATA_START_ROW: 5,
}

export const MARKETPLACE_SHEET_RULES = {
  meesho: {
    dataSheetNo: 2,
    dataGroupRow: 2,
    dataHeaderRow: 3,
    dataIsectionRow: 3,
    dropdownDataStartRow: 5,
    dataStartCol: 4,

    validationSheetNo: 4,
    dropdownOrientation: 'vertical',
    dropdownHeaderRow: 1,
    dropdownValuesRow: 2,
    dropdownStartCol: 4,
  },
  flipkart: {
    dataSheetNo: 3,
    dataGroupRow: null, // 0 in the brand table — no group row
    dataHeaderRow: 1,
    dataIsectionRow: 4,
    dropdownDataStartRow: 5,
    dataStartCol: 4,

    validationSheetNo: 2,
    dropdownOrientation: 'vertical',
    dropdownHeaderRow: 2,
    dropdownValuesRow: 3,
    dropdownStartCol: 4,
  },
  amazon: {
    dataSheetNo: 5,
    dataGroupRow: 3,
    dataHeaderRow: 4,
    dataIsectionRow: 6,
    dropdownDataStartRow: 8,
    dataStartCol: 1,

    validationSheetNo: 7,
    dropdownOrientation: 'horizontal',
    dropdownHeaderRow: 2, // column B
    dropdownValuesRow: 3, // column C onwards
    dropdownStartCol: 2, // row 2 onwards (Horizontal)
  },
  myntra: {
    dataSheetNo: 2,
    dataGroupRow: null,
    dataHeaderRow: 3,
    dataIsectionRow: null,
    dropdownDataStartRow: 4,
    dataStartCol: 1,

    validationSheetNo: null, // no Validations sheet
    dropdownOrientation: 'vertical',
    dropdownHeaderRow: null,
    dropdownValuesRow: null,
    dropdownStartCol: null,
  },
  // Any brand not listed above. Unlike the brand rules, a sheet NAMED like
  // a fill/validations sheet wins over the position here, since an unknown
  // brand's sheet order is a guess.
  default: {
    keywordFirst: true,
    dataSheetNo: 3,
    dataGroupRow: 1,
    dataHeaderRow: 1,
    dataIsectionRow: 3,
    dropdownDataStartRow: DEFAULT_SHEET_ROWS.DROPDOWN_DATA_START_ROW,
    dataStartCol: 1,

    validationSheetNo: 2,
    dropdownOrientation: 'vertical',
    dropdownHeaderRow: 2,
    dropdownValuesRow: 3,
    dropdownStartCol: 1,
  },
}

const DATA_KEYWORD = /fill/i
const VALIDATION_KEYWORD = /valid/i

// A known brand's sheet sits at its configured position (sheetNo, 1-based);
// a name match is only the fallback when the workbook is shorter than that.
// `default` (keywordFirst) tries the name first.
function pickSheet(sheetNames, sheetNo, keyword, { keywordFirst = false, exclude = '' } = {}) {
  const byIndex = sheetNo ? sheetNames[sheetNo - 1] : ''
  const atIndex = byIndex && byIndex !== exclude ? byIndex : ''
  const byKeyword = sheetNames.find((name) => name !== exclude && keyword.test(name)) || ''
  return keywordFirst ? byKeyword || atIndex : atIndex || byKeyword
}

// Whether `brandName` has its own row in the table above (not `default`).
export function hasMarketplaceSheetRule(brandName = '') {
  const brandKey = String(brandName || '').trim().toLowerCase()
  return brandKey !== 'default' && Object.hasOwn(MARKETPLACE_SHEET_RULES, brandKey)
}

export function detectMarketplaceSheetDefaults(sheetNames = [], brandName = '') {
  const isBrandRule = hasMarketplaceSheetRule(brandName)
  const rule = isBrandRule ? MARKETPLACE_SHEET_RULES[String(brandName).trim().toLowerCase()] : MARKETPLACE_SHEET_RULES.default
  const names = Array.isArray(sheetNames) ? sheetNames : []

  const dataSheetName = names.length
    ? pickSheet(names, rule.dataSheetNo, DATA_KEYWORD, { keywordFirst: rule.keywordFirst }) || names[0]
    : ''
  const dropdownSheetName = names.length && rule.validationSheetNo
    ? pickSheet(names, rule.validationSheetNo, VALIDATION_KEYWORD, { keywordFirst: rule.keywordFirst, exclude: dataSheetName })
      || (rule.keywordFirst ? names.find((name) => name !== dataSheetName) || '' : '')
    : ''

  // null (no such row) → '' so the input shows empty.
  const asInput = (n) => (n == null ? '' : n)
  return {
    isBrandRule,
    dataSheetName,
    dataGroupRow: asInput(rule.dataGroupRow),
    dataHeaderRow: asInput(rule.dataHeaderRow),
    dataIsectionRow: asInput(rule.dataIsectionRow),
    dropdownDataStartRow: asInput(rule.dropdownDataStartRow),
    dataStartCol: asInput(rule.dataStartCol),
    dropdownSheetName,
    dropdownOrientation: rule.dropdownOrientation,
    dropdownHeaderRow: asInput(rule.dropdownHeaderRow),
    dropdownValuesRow: asInput(rule.dropdownValuesRow),
    dropdownStartCol: asInput(rule.dropdownStartCol),
  }
}
