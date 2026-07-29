'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2, ArrowLeft, FolderOpen, Users, Globe, Phone, Mail,
  MapPin, Loader2, CheckCircle, XCircle, User,
} from 'lucide-react'

export default function CompanyDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/companies/${id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-subtle">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  if (!data?.company) {
    return <div className="p-6 text-red-600">Company not found.</div>
  }

  const { company, users } = data
  const companyFolder = `companies/${company.folder_id}`
  const toolsFolder   = `tools/${company.folder_id}`

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-subtle hover:text-foreground mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Companies
      </button>

      {/* Company header card */}
      <div className="bg-card rounded-2xl border border-divider p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{company.name || <span className="italic text-subtle">Unnamed Company</span>}</h1>
              {company.slug && <p className="text-sm text-subtle">@{company.slug}</p>}
            </div>
          </div>
          {company.is_active
            ? <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-1"><CheckCircle className="w-3 h-3" />Active</span>
            : <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 rounded-full px-2.5 py-1"><XCircle className="w-3 h-3" />Inactive</span>
          }
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {company.email && (
            <div className="flex items-center gap-2 text-muted">
              <Mail className="w-4 h-4 text-subtle flex-shrink-0" /> {company.email}
            </div>
          )}
          {company.phone && (
            <div className="flex items-center gap-2 text-muted">
              <Phone className="w-4 h-4 text-subtle flex-shrink-0" /> {company.phone}
            </div>
          )}
          {company.website && (
            <div className="flex items-center gap-2 text-muted">
              <Globe className="w-4 h-4 text-subtle flex-shrink-0" />
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate">
                {company.website}
              </a>
            </div>
          )}
          {company.address && (
            <div className="flex items-start gap-2 text-muted sm:col-span-2">
              <MapPin className="w-4 h-4 text-subtle flex-shrink-0 mt-0.5" /> {company.address}
            </div>
          )}
        </div>
      </div>

      {/* Folder paths */}
      <div className="bg-card rounded-2xl border border-divider p-5 mb-6">
        <h2 className="text-sm font-semibold text-muted mb-3 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-accent" /> Storage Folders
        </h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-subtle w-24 flex-shrink-0">Media</span>
            <code className="text-xs bg-surface text-muted rounded-md px-2.5 py-1 font-mono">{companyFolder}/</code>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-subtle w-24 flex-shrink-0">Tools</span>
            <code className="text-xs bg-surface text-muted rounded-md px-2.5 py-1 font-mono">{toolsFolder}/</code>
          </div>
        </div>
        <p className="text-xs text-subtle mt-3">
          All files uploaded by this company live under these Vercel Blob prefixes.
        </p>
      </div>

      {/* Users */}
      <div className="bg-card rounded-2xl border border-divider overflow-hidden">
        <div className="px-5 py-4 border-b border-divider flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-muted">Users ({users.length})</h2>
        </div>
        {users.length === 0 ? (
          <div className="px-5 py-10 text-center text-subtle text-sm">No users linked to this company yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Email / Mobile</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <span className="font-medium text-foreground">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{u.email || u.mobile}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs rounded-full px-2 py-0.5 font-medium ${
                      u.role === 'master_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-subtle text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
