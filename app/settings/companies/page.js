'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Plus, Pencil, Trash2, Loader2, Users, FolderOpen, CheckCircle, XCircle,
} from 'lucide-react'
import Modal from '@/components/admin/Modal'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import FormField from '@/components/admin/FormField'

function Badge({ active }) {
  return active
    ? <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5"><CheckCircle className="w-3 h-3" />Active</span>
    : <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5"><XCircle className="w-3 h-3" />Inactive</span>
}

const EMPTY_FORM = { name: '', email: '', phone: '', website: '', address: '', is_active: true }

export default function CompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)  // null | 'create' | 'edit'
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/companies')
    const data = await res.json()
    setCompanies(data.companies ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setError('')
    setSelected(null)
    setModal('create')
  }

  function openEdit(c) {
    setSelected(c)
    setForm({
      name: c.name ?? '', email: c.email ?? '', phone: c.phone ?? '',
      website: c.website ?? '', address: c.address ?? '', is_active: c.is_active ?? true,
    })
    setError('')
    setModal('edit')
  }

  function closeModal() { setModal(null); setSelected(null); setError('') }

  async function handleSave() {
    setError('')
    if (!form.email.trim()) { setError('Company email is required'); return }
    setSaving(true)
    try {
      const url = modal === 'create' ? '/api/admin/companies' : `/api/admin/companies/${selected.id}`
      const method = modal === 'create' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save'); return }
      closeModal()
      load()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/admin/companies/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Companies</h1>
            <p className="text-sm text-subtle">{companies.length} registered</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> New Company
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-subtle">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20 text-subtle">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No companies yet. Create the first one.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-divider overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-divider">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted">Company</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Folder</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{c.name || <span className="text-subtle italic">Unnamed</span>}</p>
                        {c.slug && <p className="text-xs text-subtle">{c.slug}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs bg-surface text-muted rounded-md px-2 py-0.5 font-mono">
                      <FolderOpen className="w-3 h-3" />{c.folder_id}
                    </span>
                  </td>
                  <td className="px-4 py-3"><Badge active={c.is_active} /></td>
                  <td className="px-4 py-3 text-subtle text-xs">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => router.push(`/settings/companies/${c.id}`)}
                        className="p-1.5 text-subtle hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                        title="View users"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-subtle hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 text-subtle hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal — create / edit */}
      <Modal
        open={!!modal}
        onClose={closeModal}
        title={modal === 'create' ? 'New Company' : 'Edit Company'}
        footer={(
          <>
            <button
              onClick={closeModal}
              className="flex-1 rounded-xl border border-divider-light text-sm font-medium text-muted py-2.5 hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save'}
            </button>
          </>
        )}
      >
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <FormField
          label="Company Name" name="name" value={form.name} placeholder="Acme Corp"
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <FormField
          label="Company Email" name="email" type="email" required value={form.email} placeholder="contact@acme.com"
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <FormField
          label="Phone" name="phone" value={form.phone} placeholder="+91 98765 43210"
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <FormField
          label="Website" name="website" value={form.website} placeholder="https://acme.com"
          onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
        />
        <FormField
          label="Address" name="address" type="textarea" rows={2} value={form.address} placeholder="123 Main St, City, State"
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-muted">Active</label>
          <FormField
            name="is_active" type="toggle" value={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value }))}
          />
        </div>

        {modal === 'edit' && selected && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            Changing the company name will update the blob folder path to match the new slug.
            Existing files remain at the old path — they are still accessible via their URLs.
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete company?"
        description={deleteTarget ? `Delete company "${deleteTarget.name || deleteTarget.email}"? Users linked to it will lose their company association.` : ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
