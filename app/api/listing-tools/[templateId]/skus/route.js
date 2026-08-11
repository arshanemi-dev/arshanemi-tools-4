import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { getTemplateMeta, getTemplateContent, saveTemplateContent, assignSkusToRows, canAccessTemplate } from '@/lib/listingTemplates'

function guessKeyHeaderIds(headers) {
  const find = (re) => headers.find((h) => re.test(h.label || ''))?.id
  return {
    design: headers.find((h) => h.isUniqueKeyPart)?.id || find(/design/i),
    brand: find(/brand/i),
    size: find(/size/i),
  }
}

// Assigns SKUs to any row missing one in the given sheet group — called
// client-side right before export (Download Sheet / Download Final Sheet),
// ahead of the billing gate, per the confirmed export flow.
export async function POST(req, { params }) {
  const { templateId } = await params
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = await getTemplateMeta(templateId)
  if (!meta) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  if (!canAccessTemplate(meta, payload)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const group = body.group || 'design_system'

  const content = await getTemplateContent(templateId)
  const sheet = content.sheets.find((s) => s.group === group)
  if (!sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })

  const { rows, changed } = await assignSkusToRows(templateId, sheet.rows, guessKeyHeaderIds(sheet.headers))
  if (changed) {
    sheet.rows = rows
    await saveTemplateContent(templateId, content)
  }

  return NextResponse.json({ sheet })
}
