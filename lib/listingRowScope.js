// Whose rows are whose inside one template's sheets.
//
// A template's rows all live in one stored list per group, shared by every
// user allowed to fill that template (a master admin's default template is
// filled by users of every company). Each saved row carries its owner's
// `userId` (stamped server-side by lib/listingTemplates.js's
// upsertRowsByOwner); rows saved before ownership existed have none and stay
// common to everyone, exactly as they always were.
//
// The rule every listing-tools route follows:
//  - what LEAVES the server is scoped to the caller — own rows plus the
//    ownerless ones, never another user's;
//  - what ARRIVES is only ever the caller's own rows: the server keeps every
//    other user's rows itself instead of trusting the browser to send them
//    back (it can't — it never received them), and a row arriving under
//    someone else's `userId` is dropped rather than believed.
//
// Plain functions, no storage access — safe to import anywhere.

export function isOtherUsersRow(row, userId) {
  return !!row?.userId && row.userId !== userId
}

// The rows of a stored list that `userId` may see, in stored order.
export function visibleRows(rows, userId) {
  return (rows || []).filter((row) => !isOtherUsersRow(row, userId))
}

// Where each of those visible rows really sits in the stored list — the
// caller's row index (always into its own, scoped view) → the stored index.
export function visibleRowIndexes(rows, userId) {
  const indexes = []
  ;(rows || []).forEach((row, i) => { if (!isOtherUsersRow(row, userId)) indexes.push(i) })
  return indexes
}

// One sheet / a whole template content, as `userId` is allowed to see it.
export function scopeSheetTo(sheet, userId) {
  return sheet ? { ...sheet, rows: visibleRows(sheet.rows, userId) } : sheet
}
export function scopeContentTo(content, userId) {
  return content ? { ...content, sheets: (content.sheets || []).map((sheet) => scopeSheetTo(sheet, userId)) } : content
}

// Rows a caller submitted, reduced to the ones it may write: anything
// claiming another user's id is dropped.
export function ownSubmittedRows(rows, userId) {
  return (rows || []).filter((row) => !isOtherUsersRow(row, userId))
}

// The stored list after `userId` saved `submitted` (its complete view of the
// group, already folded/stamped by upsertRowsByOwner): every other user's
// stored rows, untouched and still first, then the caller's rows as sent.
// Whatever the caller could see but didn't send back is thereby deleted —
// that's its own rows and the ownerless ones, same as before.
export function mergeSubmittedRows(storedRows, submitted, userId) {
  return [...(storedRows || []).filter((row) => isOtherUsersRow(row, userId)), ...ownSubmittedRows(submitted, userId)]
}
