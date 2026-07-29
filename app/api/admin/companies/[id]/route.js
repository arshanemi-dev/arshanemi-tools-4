import { NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { getCompanyById, updateCompany, deleteCompany, getUsersByCompany, getCompanyByEmail } from '@/lib/db'
import { migrateCompanyFolder } from '@/lib/media'
import { IS_CONNECT, proxyAdminCall, authHeaderFrom } from '@/lib/connect'

export async function GET(req, { params }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall(`/api/admin/companies/${id}`, { authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const company = await getCompanyById(id)
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  const users = await getUsersByCompany(id)
  return NextResponse.json({ company, users })
}

export async function PATCH(req, { params }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const updates = await req.json()

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall(`/api/admin/companies/${id}`, { method: 'PATCH', body: updates, authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  // If email is being changed, enforce uniqueness
  if (updates.email) {
    const existing = await getCompanyByEmail(updates.email)
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: 'A company with this email already exists' }, { status: 409 })
    }
  }

  try {
    const { company, folderChanged, oldFolderId, newFolderId } = await updateCompany(id, updates)

    // When the company name changes, initialise new blob folder path
    if (folderChanged) {
      await migrateCompanyFolder(oldFolderId, newFolderId)
    }

    return NextResponse.json({ company, folderChanged, oldFolderId, newFolderId })
  } catch (err) {
    console.error('Update company error:', err)
    if (err.message?.includes('unique') || err.code === '23505') {
      return NextResponse.json({ error: 'Company slug or folder already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: err.message || 'Could not update company' }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  const admin = await getAdminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (IS_CONNECT) {
    const { status, data } = await proxyAdminCall(`/api/admin/companies/${id}`, { method: 'DELETE', authHeader: authHeaderFrom(req) })
    return NextResponse.json(data, { status })
  }

  const company = await getCompanyById(id)
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  await deleteCompany(id)
  return NextResponse.json({ ok: true })
}
