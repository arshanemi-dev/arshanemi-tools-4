// What an uploaded marketplace sheet's FILE NAME says about its template —
// its marketplace and its categories — for the bulk mapping page
// (BulkTemplateDesign.jsx). Plain functions, no imports.
//
// Convention: a name can START with its marketplace
// ("Meesho_Blouse_Cotton_Women.xlsx"); every word after that is a category,
// the LAST one always Category 6, whatever sits between filling Category 1-5
// in order. A name that doesn't start with a marketplace has none — every
// word is a category. Amazon names its sheets by product type alone
// ("KURTA.xlsx", "SAREE.xlsx"), so reading that first word as the marketplace
// turned one Amazon batch into four "different marketplaces". The caller
// falls back to the brand it's working in for those files.

const CATEGORY_STOPWORDS = new Set([
  'file', 'files', 'sheet', 'sheets', 'template', 'templates', 'final', 'draft', 'copy',
  'xlsx', 'xls', 'csv', 'fill', 'this', 'data', 'master', 'new', 'old', 'updated',
  'list', 'listing', 'upload', 'uploaded', 'export', 'import', 'v1', 'v2', 'v3',
])
export const KNOWN_MARKETPLACES = [
  'Meesho', 'Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Nykaa', 'Tata CLiQ', 'Jiomart', 'eBay', 'Shopify',
]

const wordsOf = (text) => String(text || '').split(/[_\-\s]+/).map((t) => t.trim()).filter(Boolean)

// The marketplace a file name starts with, if any → { name, used } (`used` =
// how many of the name's words it took: "Tata_CLiQ_Kurta" uses two). Case is
// ignored; the longest match wins; `name` is the list's own spelling.
function leadingMarketplace(tokens, marketplaces) {
  let best = null
  for (const name of marketplaces) {
    const parts = wordsOf(name)
    if (!parts.length || parts.length > tokens.length || (best && parts.length <= best.used)) continue
    if (parts.every((p, i) => p.toLowerCase() === tokens[i].toLowerCase())) best = { name, used: parts.length }
  }
  return best
}

// Returns { brand, categories }. `brand` is the marketplace the name starts
// with, '' when it starts with none. `marketplaces` — every name that counts
// as one (the caller adds the brands its user created). `categories` is a
// fixed 6-slot array (category1..category6, '' for an unused slot) —
// categories[5] (Category 6) is always the name's last word, never wherever
// it happens to fall in sequence, so "Meesho_Women.xlsx" and "KURTA.xlsx"
// both put their one category word in Category 6, not Category 1.
export function extractBrandAndCategories(filename, marketplaces = KNOWN_MARKETPLACES) {
  const base = String(filename || '').replace(/\.[a-z0-9]+$/i, '')
  const tokens = wordsOf(base)
  const market = leadingMarketplace(tokens, marketplaces)

  // Lowercased — a filename token carries whatever case its seller typed
  // (often ALL CAPS), and that used to bleed straight into the composed
  // Template Name / Save Final Name; category text is lowercase everywhere
  // now, same idea as a URL slug.
  const catTokens = tokens.slice(market ? market.used : 0)
    .filter((t) => !CATEGORY_STOPWORDS.has(t.toLowerCase()) && !/^\d+$/.test(t))
    .map((t) => t.toLowerCase())

  const categories = new Array(6).fill('')
  if (catTokens.length > 0) {
    categories[5] = catTokens[catTokens.length - 1]
    catTokens.slice(0, -1).slice(0, 5).forEach((t, i) => { categories[i] = t })
  }

  return { brand: market ? market.name : '', categories }
}
