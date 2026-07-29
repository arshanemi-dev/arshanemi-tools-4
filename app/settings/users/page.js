'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users as UsersIcon, Plus, Pencil, KeyRound, Trash2, Building2 } from 'lucide-react'
import DataTable from '@/components/admin/DataTable'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { useToast } from '@/components/admin/Toast'
import { TableSkeleton, LoadError } from '@/components/admin/Skeleton'
import UserFormModal from './UserFormModal'
import PasswordModal from './PasswordModal'

export default function UsersPage() {
  const { addToast } = useToast()
  const [viewer, setViewer] = useState(null)
  const [users, setUsers] = useState(null)
  const [companies, setCompanies] = useState([])
  const [error, setError] = useState(false)
  const [formModal, setFormModal] = useState(null) // null | 'create' | 'edit'
  const [selected, setSelected] = useState(null)
  const [passwordTarget, setPasswordTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setError(false)
    try {
      const meRes = await fetch('/api/auth/me')
      if (!meRes.ok) throw new Error()
      const me = await meRes.json()
      setViewer({ role: me.role, companyId: me.companyId })

      const usersRes = await fetch('/api/admin/users')
      if (!usersRes.ok) throw new Error()
      setUsers(await usersRes.json())

      if (me.role === 'master_admin') {
        const companiesRes = await fetch('/api/admin/companies')
        if (companiesRes.ok) setCompanies((await companiesRes.json()).companies ?? [])
      }
    } catch {
      setError(true)
    }
  }

  useEffect(() => { load() }, [])

  function openCreate() { setSelected(null); setFormModal('create') }
  function openEdit(u) { setSelected(u); setFormModal('edit') }
  function closeForm() { setFormModal(null); setSelected(null) }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { addToast(data.error || 'Delete failed', 'error'); return }
      addToast('User deleted')
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  function companyLabel(id) {
    const c = companies.find((c) => c.id === id)
    return c ? (c.name || c.email) : '—'
  }

  if (error) return <LoadError onRetry={load} />
  if (!users || !viewer) return <TableSkeleton rows={6} />

  const isMaster = viewer.role === 'master_admin'
  const noCompanies = isMaster && companies.length === 0

  const columns = [
    {
      key: 'name', label: 'User', sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-medium text-foreground">{v}</p>
          <p className="text-xs text-subtle">{row.email || row.mobile}</p>
        </div>
      ),
    },
    {
      key: 'role', label: 'Role', sortable: true,
      render: (v) => (
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          v === 'admin' ? 'bg-accent/10 text-accent-hover' : 'bg-surface text-muted'
        }`}>
          {v}
        </span>
      ),
    },
    ...(isMaster ? [{
      key: 'company_id', label: 'Company',
      render: (v) => <span className="text-sm text-muted">{companyLabel(v)}</span>,
    }] : []),
    {
      key: 'otp_enabled', label: 'OTP',
      render: (v) => v
        ? <span className="text-xs font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5">Enabled</span>
        : <span className="text-xs text-subtle">Off</span>,
    },
    {
      key: 'is_active', label: 'Status',
      render: (v) => v
        ? <span className="text-xs font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5">Active</span>
        : <span className="text-xs font-medium text-red-700 bg-red-50 rounded-full px-2 py-0.5">Inactive</span>,
    },
    {
      key: 'created_at', label: 'Created', sortable: true,
      render: (v) => new Date(v).toLocaleDateString(),
    },
    {
      key: '_actions', label: '',
      render: (_v, row) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(row)} title="Edit" className="p-1.5 text-subtle hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => setPasswordTarget(row)} title="Change password" className="p-1.5 text-subtle hover:text-accent hover:bg-accent/10 rounded-lg transition-colors">
            <KeyRound className="w-4 h-4" />
          </button>
          <button onClick={() => setDeleteTarget(row)} title="Delete" className="p-1.5 text-subtle hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <UsersIcon className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Users</h1>
            <p className="text-sm text-subtle">{users.length} {isMaster ? 'registered' : 'in your company'}</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          disabled={noCompanies}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> New User
        </button>
      </div>

      {noCompanies && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 flex-shrink-0" />
          No companies yet — <Link href="/settings/companies" className="font-semibold underline">create a company first</Link> before adding users.
        </div>
      )}

      <DataTable columns={columns} data={users} searchKeys={['name', 'email', 'mobile']} emptyText="No users yet." />

      <UserFormModal
        open={!!formModal}
        mode={formModal}
        viewer={viewer}
        companies={companies}
        initial={selected}
        onClose={closeForm}
        onSaved={() => {
          const wasCreate = formModal === 'create'
          closeForm()
          load()
          addToast(wasCreate ? 'User created' : 'User updated')
        }}
      />

      <PasswordModal
        open={!!passwordTarget}
        user={passwordTarget}
        onClose={() => setPasswordTarget(null)}
        onSaved={() => { setPasswordTarget(null); addToast('Password updated') }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete user?"
        description={deleteTarget ? `Delete "${deleteTarget.name}"? This cannot be undone.` : ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
