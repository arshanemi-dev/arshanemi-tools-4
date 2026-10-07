// Server-only storage facade for Listing Tools. Route handlers import the
// *storage* functions from here instead of from lib/listingTemplates.js
// directly; pure helpers (ensureTrailingEmptyRow, detectDataType,
// upsertRowsByOwner, templateBadgeFor, GROUPS) still come from
// lib/listingTemplates.js.
//
// NEXT_PUBLIC_LISTING_STORE=hub  → per-user Postgres in arshanemi-tools-dashboard
//   (lib/listingHubStore.js, forwards the caller's token).
// anything else (default)        → Dropbox JSON, unchanged (lib/listingTemplates.js).
//
// This file is never imported by a client component, so it's safe for it to
// pull in lib/listingHubStore.js (which imports next/headers).

import * as dropbox from './listingTemplates'
import * as hub from './listingHubStore'

export const LISTING_STORE_HUB = process.env.NEXT_PUBLIC_LISTING_STORE === 'hub'

const impl = LISTING_STORE_HUB ? hub : dropbox

export const listTemplates = impl.listTemplates
export const listVisibleTemplatesForViewer = impl.listVisibleTemplatesForViewer
export const getTemplateMeta = impl.getTemplateMeta
export const getTemplateContent = impl.getTemplateContent
export const createTemplateMeta = impl.createTemplateMeta
export const updateTemplateMeta = impl.updateTemplateMeta
export const deleteTemplate = impl.deleteTemplate
export const saveTemplateContent = impl.saveTemplateContent
export const assignSkusToRows = impl.assignSkusToRows
export const findSimilarRows = impl.findSimilarRows

// Source workbook (.xlsx bytes) always stays on Dropbox — the hub has no
// object storage for it.
export const uploadTemplateSourceFile = dropbox.uploadTemplateSourceFile

// In hub mode the hub already authorized the fetch (owner, master_admin, or
// an assignee) before getTemplateMeta returned anything, so a non-null meta
// is by definition accessible. In Dropbox mode, defer to the real rule.
export function canAccessTemplate(template, viewer) {
  if (LISTING_STORE_HUB) return !!template
  return dropbox.canAccessTemplate(template, viewer)
}

// Who may change a template's own settings/structure or delete it — never
// the same thing as being allowed to open and fill it (canAccessTemplate).
// In hub mode a template can also reach someone it was merely assigned to,
// so "the hub returned it" proves nothing here: only its owner or a master
// admin manages it. In Dropbox mode, see lib/listingTemplates.js's rule.
export function canManageTemplate(template, viewer) {
  if (!template || !viewer) return false
  if (LISTING_STORE_HUB) return viewer.role === 'master_admin' || template.ownerUserId === viewer.userId
  return dropbox.canManageTemplate(template, viewer)
}
