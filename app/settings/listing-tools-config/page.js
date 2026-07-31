'use client'
import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { useToast } from '@/components/admin/Toast'

const ROLE_COPY = {
  admin: { label: 'Admin', desc: 'Company-scoped admins' },
  user: { label: 'User', desc: 'Regular user accounts' },
}

// master_admin-only role-gate toggle, mirroring app/settings/theme/page.js's
// singleton-edit pattern (backed by app/api/admin/listing-tools-config/route.js).
// master_admin itself is implicitly always allowed to create/edit templates
// and never appears here.
export default function ListingToolsConfigPage() {
  const { addToast } = useToast()
  const [config, setConfig] = useState({ allowCreateEdit: { admin: false, user: false } })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/listing-tools-config')
      .then((r) => r.json())
      .then((d) => setConfig(d))
      .finally(() => setLoading(false))
  }, [])

  function toggle(role) {
    setConfig((prev) => ({ allowCreateEdit: { ...prev.allowCreateEdit, [role]: !prev.allowCreateEdit[role] } }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/listing-tools-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Failed to save')
      addToast('Saved', 'success')
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
          <h1 className="text-xl font-bold text-foreground">Listing Tools — Create/Edit Access</h1>
          <p className="text-sm text-subtle mt-0.5">
            Control which roles can create new templates and edit template details. master_admin can always create and edit.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="bg-card rounded-xl border border-divider divide-y divide-divider">
        {Object.entries(ROLE_COPY).map(([role, copy]) => (
          <div key={role} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{copy.label}</p>
              <p className="text-xs text-subtle mt-0.5">{copy.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(role)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${config.allowCreateEdit[role] ? 'bg-accent' : 'bg-divider-light'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${config.allowCreateEdit[role] ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
