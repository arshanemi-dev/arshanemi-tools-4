import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { uploadUserToolMedia } from '@/lib/media'
import { getTemplateMeta } from '@/lib/listingTemplates'

const MAX_MB = 5

// Bulk image upload backing BulkImageDropZone.jsx — accepts N files in one
// multipart request and returns a url per filename so the client can match
// filename → row (by SKU/Design-number substring) and auto-fill the first
// empty Image N cell per matched row.
export async function POST(req, { params }) {
  const { templateId } = await params
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = await getTemplateMeta(templateId)
  if (!meta) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  const inScope = payload.role === 'master_admin' || meta.companyId === (payload.companyId ?? null)
  if (!inScope) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const formData = await req.formData()
  const files = formData.getAll('files').filter((f) => typeof f !== 'string')
  if (files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

  const results = []
  for (const file of files) {
    if (file.size > MAX_MB * 1024 * 1024) {
      results.push({ filename: file.name, error: `File exceeds ${MAX_MB}MB` })
      continue
    }
    const uploaded = await uploadUserToolMedia(
      file,
      payload.companyId || 'no-company',
      payload.userId,
      `listing-tools/${templateId}`
    )
    results.push({ filename: file.name, url: uploaded.url })
  }

  return NextResponse.json({ files: results })
}
