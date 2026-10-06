// Search-box matching for the fill pages' grids (Auto Listing, Product
// Details, Brand Details).
//
// The rule every one of those pages follows: a grid is always given a
// group's WHOLE row list, plus a predicate saying which rows to hide
// (SheetGrid's `isRowVisible`) — never a filtered copy of the rows. Every
// edit hands the page back the list the grid was given, and the page stores
// (and, on Product/Brand Details, saves to the server) exactly that list, so
// a row left out of it is not just hidden: it is deleted. Keeping the full
// list also keeps every row index the real one, which is what the pages'
// own handlers (linked fills, image → AI fill, the boxes under a product)
// index by.

// `query` is already trimmed and lower-cased. `aiFilled` (plan §14) is a
// bookkeeping key, not a header id — same exclusion as every isRowEmpty copy.
export function rowMatchesSearch(row, query) {
  return Object.entries(row || {}).some(([k, v]) => k !== 'aiFilled' && String(v ?? '').toLowerCase().includes(query))
}
