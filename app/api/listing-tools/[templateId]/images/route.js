import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getAuthPayload } from '@/lib/auth'
import { uploadFile } from '@/lib/storage/dropbox'
import { getTemplateMeta, canAccessTemplate } from '@/lib/listingTemplates'

const MAX_MB = 5

// Image upload backing ImageCell.jsx (one file per request) and
// BulkImageDropZone.jsx (one file per request, called sequentially by
// hooks/useListingImageUpload.js) — stores product images in Dropbox
// (not Vercel Blob — Vercel is used only for this app's own JSON
// "database" and unrelated general media, never Listing Tools product
// images) under /listing-tools/{companyId}/{userId}/{templateId}/, and
// returns a permanent direct-CDN url per filename so the client can match
// filename → row (by SKU/Design-number substring) and auto-fill the first
// empty Image N cell per matched row.
export async function POST(req, { params }) {
  const { templateId } = await params
  const payload = await getAuthPayload(req)
  if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = await getTemplateMeta(templateId)
  if (!meta) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  if (!canAccessTemplate(meta, payload)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const formData = await req.formData()
  const files = formData.getAll('files').filter((f) => typeof f !== 'string')
  if (files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

  const folderPath = `/listing-tools/${payload.companyId || 'no-company'}/${payload.userId}/${templateId}`

  const results = []
  for (const file of files) {
    if (file.size > MAX_MB * 1024 * 1024) {
      results.push({ filename: file.name, error: `File exceeds ${MAX_MB}MB` })
      continue
    }
    const ext = file.name.split('.').pop().toLowerCase()
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadFile(folderPath, `${nanoid()}.${ext}`, buffer, file.type)
    results.push({ filename: file.name, url: uploaded.url })
  }

  return NextResponse.json({ files: results })
}
