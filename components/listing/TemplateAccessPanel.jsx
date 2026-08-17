'use client'
import { useEffect, useMemo, useState } from 'react'
import { Save, Search } from 'lucide-react'
import { useToast } from '@/components/admin/Toast'

const ROLE_LABEL = { admin: 'Admin', user: 'User' }

// Master_admin manages a per-user grant of Listing Tools' Template Settings
// section (nav item + /listing-tools/template-settings/** pages) here —
// mirrors the hub's Settings Access feature (app/settings/settings-access),
// just a single boolean per user instead of an href array, and covering
// both 'admin' and 'user' roles (unlike /settings/*, Listing Tools' Template
// Settings is reachable by plain 'user' accounts too). Users/companies/access
// each proxy to the hub via app/api/admin/{users,companies,listing-template-access}.
// master_admin itself is implicitly always allowed and never appears below.
export default function TemplateAccessPanel() {
  const { addToast } = useToast()
  const [users, setUsers] = useState(null)
  const [companies, setCompanies] = useState({})
  const [access, setAccess] = useState({}) // { [userId]: boolean }
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    setError(false)
    setLoading(true)
    try {
      const [usersData, companiesData, accessData] = await Promise.all([
        fetch('/api/admin/users').then((r) => { if (!r.ok) throw new Error(); return r.json() }),
        fetch('/api/admin/companies').then((r) => { if (!r.ok) throw new Error(); return r.json() }),
        fetch('/api/admin/listing-template-access').then((r) => { if (!r.ok) throw new Error(); return r.json() }),
      ])
      setUsers(usersData)
      const companyMap = {}
      ;(companiesData.companies || []).forEach((c) => { companyMap[c.id] = c.name })
      setCompanies(companyMap)
      setAccess(accessData.access || {})
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function toggle(userId) {
    setAccess((prev) => ({ ...prev, [userId]: !prev[userId] }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/listing-template-access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(access),
      })
      if (!res.ok) throw new Error('Failed to save')
      addToast('Saved', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const filteredUsers = useMemo(() => {
    if (!users) return []
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  }, [users, search])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-6 py-10 text-center text-sm text-subtle">
        Couldn’t load users.{' '}
        <button type="button" onClick={load} className="text-accent font-medium hover:underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 space-y-6 pb-24">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Template Access</h1>
          <p className="text-sm text-subtle mt-0.5">
            Grant individual accounts access to Template Settings (create, edit, and manage templates). master_admin always has access and never needs a grant.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 text-subtle absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="w-full pl-9 pr-3 py-2 text-[13px] bg-card-hover rounded-lg focus:outline-none focus:ring-1 focus:ring-accent-light"
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-divider divide-y divide-divider">
        {filteredUsers.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-subtle">No users found.</div>
        )}
        {filteredUsers.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                <span className="inline-flex flex-shrink-0 items-center rounded-full bg-card-hover px-2 py-0.5 text-[11px] font-medium text-muted">
                  {ROLE_LABEL[u.role] || u.role}
                </span>
              </div>
              <p className="text-xs text-subtle mt-0.5 truncate">
                {u.email || u.mobile}
                {companies[u.company_id] ? ` · ${companies[u.company_id]}` : ''}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!access[u.id]}
              onClick={() => toggle(u.id)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${access[u.id] ? 'bg-accent' : 'bg-divider-light'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform ${access[u.id] ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-48 bg-card border-t border-divider px-6 py-4 flex items-center justify-end gap-3 z-10 shadow-sm">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
