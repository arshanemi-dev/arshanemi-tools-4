import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { getTemplateMeta, getTemplateContent, deleteTemplate, canAccessTemplate, canManageTemplate } from '@/lib/listingStore'
import { templateBadgeFor } from '@/lib/listingTemplates'
import { scopeContentTo } from '@/lib/listingRowScope'
import { requestMayUseTemplateSettings, TEMPLATE_SETTINGS_DENIED } from '@/lib/listingTemplateAccess'
import { recordTemplateHistory, recordTemplateLog } from '@/lib/listingHistory'
import { proxyAdminCall, authHeaderFrom } from '@/lib/connect'
import { updateOneTemplate } from '@/lib/listingTemplateOps'
import { buildTemplateDeleteLog } from '@/lib/templateLogDiff'

async function authorizeForTemplate(req, templateId) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const meta = await getTemplateMeta(templateId)
  if (!meta) return { error: NextResponse.json({ error: 'Template not found' }, { status: 404 }) }
  if (!canAccessTemplate(meta, payload)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  return { payload, meta }
}

// Being able to open and fill a template is not being allowed to change or
// delete it — see canManageTemplate. Every user can open a master admin's
// shared template; none of them may rename, restructure or remove it.
const NOT_MANAGER = "Only this template's owner or a master admin can change or delete it."

// The viewer only ever gets its own rows (plus ownerless ones) out of a
// template other users fill too — see lib/listingRowScope.js.
// `viewerCanManage` tells the UI whether to offer edit/delete at all.
export async function GET(req, { params }) {
  try {
    const { templateId } = await params
    const { error, meta, payload } = await authorizeForTemplate(req, templateId)
    if (error) return error
    const content = scopeContentTo(await getTemplateContent(templateId), payload.userId)
    return NextResponse.json({
      template: { ...meta, viewerBadge: templateBadgeFor(meta, payload), viewerUserId: payload.userId, viewerCanManage: canManageTemplate(meta, payload) },
      content,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to load template' }, { status: 500 })
  }
}

// Body from the simple rename case (AutoListingRow etc.): { templateName,
// description }. Body from Template Settings' wizard editing a template's
// structure: also includes marketplaceName, category, exportVersion,
// aiRules, sheets: [{group, sheetName, sheetIndex, headers}] (no rows — the
// wizard never touches row data). Actual patch/save logic (shared with
// bulk-update-template) lives in lib/listingTemplateOps.js's
// updateOneTemplate.
export async function PATCH(req, { params }) {
  try {
    const { templateId } = await params
    const { error, payload, meta } = await authorizeForTemplate(req, templateId)
    if (error) return error
    if (!canManageTemplate(meta, payload)) return NextResponse.json({ error: NOT_MANAGER }, { status: 403 })
    // Editing a template (name, rules, visibility, headers) is a Template
    // Settings action — the section's page gate never stopped a direct call.
    if (!(await requestMayUseTemplateSettings(req, payload))) {
      return NextResponse.json({ error: TEMPLATE_SETTINGS_DENIED }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { template, content } = await updateOneTemplate(req, payload, templateId, body)
    return NextResponse.json({ template, ...(content ? { content } : {}) })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  try {
    const { templateId } = await params
    const { error, meta, payload } = await authorizeForTemplate(req, templateId)
    if (error) return error
    if (!canManageTemplate(meta, payload)) return NextResponse.json({ error: NOT_MANAGER }, { status: 403 })

    await deleteTemplate(templateId)

    // "My Template" assignments live on the hub in their own table with no
    // FK back to this template — clean them up here so a deleted template
    // doesn't linger in anyone's sidebar/picker. Best-effort: the template
    // is already gone at this point regardless of whether this succeeds,
    // and Choose Your Template already only renders assignments that match
    // a still-existing template, so a failed cleanup here just leaves a
    // harmless orphan row rather than a broken page.
    try {
      await proxyAdminCall(`/api/listing-tools/assignments?templateId=${encodeURIComponent(templateId)}`, {
        method: 'DELETE',
        authHeader: authHeaderFrom(req),
      })
    } catch { /* non-fatal, see comment above */ }

    await recordTemplateHistory(req, { templateId, templateName: meta.templateName, sheetGroup: 'template', action: 'delete' })
    await recordTemplateLog(req, templateId, buildTemplateDeleteLog(meta))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to delete template' }, { status: 500 })
  }
}
