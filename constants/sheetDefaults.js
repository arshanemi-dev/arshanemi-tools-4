// Default row indices & marketplace-specific sheet detection rules
// Meesho:
//  - Product Fill Sheet: 2nd sheet (or "Fill"), Header Row 2, I section Row 2
//  - Validation Sheet: 4th sheet (or "Validation"), Header Row 1, Dropdown Values Row 3
// Flipkart & Default / Other Brands:
//  - Product Fill Sheet: 3rd sheet (or "Fill"), Header Row 1, I section Row 3
//  - Validation Sheet: 2nd sheet (or "Validation"), Header Row 2, Dropdown Values Row 3

export const DEFAULT_SHEET_ROWS = {
  GROUP_ROW: 1,
  HEADER_ROW: 2,
  ISECTION: 2,
  DROPDOWN_HEADER_ROW: 1,
  DROPDOWN_VALUES_ROW: 3,
}

export const MARKETPLACE_SHEET_RULES = {
  meesho: {
    dataSheetIndex: 1, // 0-based: 2nd sheet
    dataKeyword: /fill/i,
    dataGroupRow: 1,
    dataHeaderRow: 2,
    dataIsectionRow: 2,

    validationSheetIndex: 3, // 0-based: 4th sheet
    validationKeyword: /valid/i,
    dropdownHeaderRow: 1,
    dropdownValuesRow: 3,
  },
  flipkart: {
    dataSheetIndex: 2, // 0-based: 3rd sheet
    dataKeyword: /fill/i,
    dataGroupRow: 1,
    dataHeaderRow: 1,
    dataIsectionRow: 3,

    validationSheetIndex: 1, // 0-based: 2nd sheet
    validationKeyword: /valid/i,
    dropdownHeaderRow: 2,
    dropdownValuesRow: 3,
  },
  default: {
    dataSheetIndex: 2, // 0-based: 3rd sheet
    dataKeyword: /fill/i,
    dataGroupRow: 1,
    dataHeaderRow: 1,
    dataIsectionRow: 3,

    validationSheetIndex: 1, // 0-based: 2nd sheet
    validationKeyword: /valid/i,
    dropdownHeaderRow: 2,
    dropdownValuesRow: 3,
  },
}

export function detectMarketplaceSheetDefaults(sheetNames = [], brandName = '') {
  const brandKey = (brandName || '').toLowerCase()
  const rule = MARKETPLACE_SHEET_RULES[brandKey] || MARKETPLACE_SHEET_RULES.default

  let dataSheetName = ''
  if (Array.isArray(sheetNames) && sheetNames.length > 0) {
    const keywordMatch = sheetNames.find((name) => rule.dataKeyword.test(name))
    if (keywordMatch) {
      dataSheetName = keywordMatch
    } else if (sheetNames[rule.dataSheetIndex]) {
      dataSheetName = sheetNames[rule.dataSheetIndex]
    } else {
      dataSheetName = sheetNames[0]
    }
  }

  let dropdownSheetName = ''
  if (Array.isArray(sheetNames) && sheetNames.length > 0) {
    const keywordMatch = sheetNames.find((name) => name !== dataSheetName && rule.validationKeyword.test(name))
    if (keywordMatch) {
      dropdownSheetName = keywordMatch
    } else if (sheetNames[rule.validationSheetIndex] && sheetNames[rule.validationSheetIndex] !== dataSheetName) {
      dropdownSheetName = sheetNames[rule.validationSheetIndex]
    } else {
      const remaining = sheetNames.find((name) => name !== dataSheetName)
      dropdownSheetName = remaining || ''
    }
  }

  return {
    dataSheetName,
    dataGroupRow: rule.dataGroupRow,
    dataHeaderRow: rule.dataHeaderRow,
    dataIsectionRow: rule.dataIsectionRow,
    dropdownSheetName,
    dropdownHeaderRow: rule.dropdownHeaderRow,
    dropdownValuesRow: rule.dropdownValuesRow,
  }
}
