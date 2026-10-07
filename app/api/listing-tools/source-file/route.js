import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { uploadTemplateSourceFile } from '@/lib/listingTemplates'
import { requestMayUseTemplateSettings, TEMPLATE_SETTINGS_DENIED } from '@/lib/listingTemplateAccess'

// Marketplace upload sheets are a few MB at most; this is only a ceiling.
const MAX_SOURCE_MB = 25

// An .xlsx is a zip archive — its first four bytes are "PK\x03\x04".
async function looksLikeXlsx(file) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
}

// Stores a template's original marketplace workbook (kept verbatim so the
// export can fill it back in — see lib/exports/excelTemplateEngine.js). A
// Template Settings action, so it takes that section's permission, not just a
// login; and since the file is kept and later re-opened in other users'
// browsers, only a real .xlsx within the size ceiling is accepted.
export async function POST(req) {
  try {
    const payload = await getAuthPayload(req)
    if (!payload?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await requestMayUseTemplateSettings(req, payload))) {
      return NextResponse.json({ error: TEMPLATE_SETTINGS_DENIED }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!/\.xlsx$/i.test(file.name || '')) {
      return NextResponse.json({ error: 'Only an .xlsx workbook can be kept as a template’s original sheet.' }, { status: 400 })
    }
    if (file.size > MAX_SOURCE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `The sheet must be under ${MAX_SOURCE_MB}MB.` }, { status: 400 })
    }
    if (!(await looksLikeXlsx(file))) {
      return NextResponse.json({ error: 'That file is not a real .xlsx workbook.' }, { status: 400 })
    }

    const url = await uploadTemplateSourceFile(file)
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to upload source file' }, { status: 500 })
  }
}
