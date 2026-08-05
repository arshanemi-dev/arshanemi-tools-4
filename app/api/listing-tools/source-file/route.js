import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { uploadTemplateSourceFile } from '@/lib/listingTemplates'

// Uploads the raw master .xlsx a template was created from, ahead of the
// template itself being saved (Section 1 of TemplateSettingsWizard) — the
// returned url is threaded through Save as sourceFileUrl. Same shape as
// app/api/upload/route.js, just kept on this feature's own storage prefix.
export async function POST(req) {
  try {
    const payload = await getAuthPayload(req)
    if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const url = await uploadTemplateSourceFile(file)
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to upload source file' }, { status: 500 })
  }
}
