'use client'
import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { useToast } from '@/components/admin/Toast'

// Per-user template grants — mirrors the hub's settings-access grant model
// (pick a user, multi-select from existing templates). Grants themselves
// live in the hub via app/api/listing-tools/assignments/route.js proxying
// to admin-pannels; template metadata is fetched locally from this app's
// own /api/listing-tools. Same UI for every grantable role — admin can only
// ever see/grant within its own company's users (already enforced by
// /api/admin/users), master_admin sees everyone.
export default function ListingTemplatesAssignmentPage() {
  const { addToast } = useToast()
  const [templates, setTemplates] = useState([])
  const [users, setUsers] = useState([])
  const [access, setAccess] = useState({})
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/listing-tools').then((r) => r.json()),
      fetch('/api/admin/users').then((r) => r.json()),
      fetch('/api/listing-tools/assignments').then((r) => (r.ok ? r.json() : { access: {} })),
    ]).then(([templatesData, usersData, accessData]) => {
      setTemplates(templatesData.templates || [])
      setUsers(Array.isArray(usersData) ? usersData : (usersData.users || []))
      setAccess(accessData.access || {})
      setLoading(false)
    })
  }, [])

  const selectedTemplateIds = new Set((access[selectedUserId] || []).map((t) => t.templateId))

  function toggleTemplate(t) {
    if (!selectedUserId) return
    setAccess((prev) => {
      const current = prev[selectedUserId] || []
      const exists = current.some((x) => x.templateId === t.id)
      const next = exists
        ? current.filter((x) => x.templateId !== t.id)
        : [...current, { templateId: t.id, templateName: t.templateName }]
      return { ...prev, [selectedUserId]: next }
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/listing-tools/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(access),
      })
      if (!res.ok) throw new Error('Failed to save')
      addToast('Assignments saved', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Listing Templates — User Access</h1>
          <p className="text-sm text-subtle mt-0.5">Grant specific saved templates to specific user accounts.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !selectedUserId}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <div className="bg-card rounded-xl border border-divider divide-y divide-divider max-h-[60vh] overflow-y-auto">
          {users.length === 0 && <p className="px-4 py-6 text-sm text-subtle">No users found.</p>}
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedUserId(u.id)}
              className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                selectedUserId === u.id ? 'bg-accent/10 text-accent font-semibold' : 'text-foreground hover:bg-surface'
              }`}
            >
              <p className="truncate">{u.name}</p>
              <p className="text-xs text-subtle truncate">{u.email}</p>
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl border border-divider divide-y divide-divider">
          {!selectedUserId && <p className="px-4 py-6 text-sm text-subtle">Select a user to manage their template access.</p>}
          {selectedUserId && templates.length === 0 && <p className="px-4 py-6 text-sm text-subtle">No templates exist yet.</p>}
          {selectedUserId && templates.map((t) => (
            <label key={t.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface">
              <input
                type="checkbox"
                checked={selectedTemplateIds.has(t.id)}
                onChange={() => toggleTemplate(t)}
                className="w-4 h-4 rounded border-divider-light accent-accent"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.templateName}</p>
                {t.description && <p className="text-xs text-subtle truncate">{t.description}</p>}
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
