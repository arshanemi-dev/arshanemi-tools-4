import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { getTemplateMeta, getTemplateContent, updateTemplateMeta, deleteTemplate } from '@/lib/listingTemplates'
import { recordTemplateHistory } from '@/lib/listingHistory'

async function authorizeForTemplate(req, templateId) {
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const meta = await getTemplateMeta(templateId)
  if (!meta) return { error: NextResponse.json({ error: 'Template not found' }, { status: 404 }) }
  const inScope = payload.role === 'master_admin' || meta.companyId === (payload.companyId ?? null)
  if (!inScope) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  return { payload, meta }
}

export async function GET(req, { params }) {
  const { templateId } = await params
  const { error, meta } = await authorizeForTemplate(req, templateId)
  if (error) return error
  const content = await getTemplateContent(templateId)
  return NextResponse.json({ template: meta, content })
}

export async function PATCH(req, { params }) {
  const { templateId } = await params
  const { error, meta } = await authorizeForTemplate(req, templateId)
  if (error) return error

  const body = await req.json().catch(() => ({}))
  const patch = {}
  if ('templateName' in body) patch.templateName = body.templateName
  if ('description' in body) patch.description = body.description
  const updated = await updateTemplateMeta(templateId, patch)

  recordTemplateHistory(req, {
    templateId, templateName: updated.templateName, sheetGroup: 'template', action: 'save',
    snapshotMeta: { renamed: 'templateName' in body },
  })

  return NextResponse.json({ template: updated })
}

export async function DELETE(req, { params }) {
  const { templateId } = await params
  const { error, meta } = await authorizeForTemplate(req, templateId)
  if (error) return error

  await deleteTemplate(templateId)
  recordTemplateHistory(req, { templateId, templateName: meta.templateName, sheetGroup: 'template', action: 'delete' })
  return NextResponse.json({ ok: true })
}
