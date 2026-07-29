import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getAdminFromRequest } from '@/lib/auth'
import { getAllCompanies, createCompany, getCompanyByEmail } from '@/lib/db'
import { initCompanyFolders } from '@/lib/media'
import { IS_CONNECT, proxyAdminCall, authHeaderFrom } from '@/lib/connect'

export async function GET(req) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall('/api/admin/companies', { authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const companies = await getAllCompanies()
  return NextResponse.json({ companies })
}

export async function POST(req) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall('/api/admin/companies', { method: 'POST', body, authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const { name, email, phone, website, address } = body

  if (!email?.trim()) {
    return NextResponse.json({ error: 'Company email is required' }, { status: 400 })
  }

  // Unique email check
  const existing = await getCompanyByEmail(email)
  if (existing) {
    return NextResponse.json({ error: 'A company with this email already exists' }, { status: 409 })
  }

  // Derive folder_id from name or random
  let folderId
  if (name?.trim()) {
    folderId = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
    if (!folderId) folderId = `co_${nanoid(8)}`
  } else {
    folderId = `co_${nanoid(8)}`
  }

  try {
    const company = await createCompany({ name: name?.trim() || null, email, phone, website, address, folderId })
    await initCompanyFolders(folderId)
    return NextResponse.json({ company }, { status: 201 })
  } catch (err) {
    console.error('Create company error:', err)
    return NextResponse.json({ error: err.message || 'Could not create company' }, { status: 500 })
  }
}
