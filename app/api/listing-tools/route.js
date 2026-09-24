import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { listTemplates, listVisibleTemplatesForViewer } from '@/lib/listingStore'
import { templateBadgeFor } from '@/lib/listingTemplates'
import { createOneTemplate } from '@/lib/listingTemplateOps'

async function authorize(req) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { payload }
}

// master_admin sees every template, from every user — the only role with a
// system-wide view. Every other role sees the union of: its own templates
// (any visibility state), master_admin's isAllowedToShow templates, and —
// for a plain 'user' — their own admin's isAllowedToShow templates. Peer
// 'user' templates under the same admin are never shared laterally. See
// listVisibleTemplatesForViewer for the exact rule. Every row also gets a
// viewerBadge (self/default/admin/null) for the UI to label who made it.
export async function GET(req) {
  try {
    const { payload, error } = await authorize(req)
    if (error) return error
    const templates = payload.role === 'master_admin'
      ? await listTemplates({})
      : await listVisibleTemplatesForViewer({ userId: payload.userId, role: payload.role, companyId: payload.companyId })
    const badged = templates.map((t) => ({ ...t, viewerBadge: templateBadgeFor(t, payload) }))
    return NextResponse.json({ templates: badged })
  } catch (err) {
    // Any unhandled throw here (e.g. a Blob storage/env issue) previously
    // reached the client as a body-less error response, which crashes
    // `res.json()` with "Unexpected end of JSON input" — always return JSON.
    return NextResponse.json({ error: err.message || 'Failed to load templates' }, { status: 500 })
  }
}

// Body comes from TemplateSettingsWizard: { templateName, description,
// sourceFileName, sheets: [{sheetName, group, headers, rows}], dropdownReference }
// — the actual create logic (shared with bulk-create-template) lives in
// lib/listingTemplateOps.js's createOneTemplate.
export async function POST(req) {
  try {
    const { payload, error } = await authorize(req)
    if (error) return error

    const body = await req.json().catch(() => null)
    const { template, content } = await createOneTemplate(req, payload, body)
    return NextResponse.json({ template, content })
  } catch (err) {
    // Same reasoning as GET — createTemplateMeta/saveTemplateContent hit
    // Vercel Blob directly with no try/catch of their own (writeBlobJson
    // isn't wrapped like readBlobJson is), so a storage hiccup here used to
    // surface as a body-less response and a confusing client-side crash.
    const status = /required/i.test(err.message || '') ? 400 : 500
    return NextResponse.json({ error: err.message || 'Failed to save template' }, { status })
  }
}
