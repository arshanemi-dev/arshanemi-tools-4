'use client'
import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { useToast } from '@/components/admin/Toast'

const ROLE_COPY = {
  admin: { label: 'Admin', desc: 'Company-scoped admins' },
  user: { label: 'User', desc: 'Regular user accounts' },
}

// Moved here from app/settings/listing-tools-config/page.js so master_admin
// can manage this from inside the Listing Tools app itself (see
// app/listing-tools/template-access/page.js, which does the server-side
// master_admin gate before this ever mounts). Backed by the same singleton
// as before: app/api/admin/listing-tools-config/route.js. master_admin
// itself is implicitly always allowed to create/edit templates and never
// appears here.
export default function TemplateAccessPanel() {
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
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Template Access</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Control which roles can create new templates and edit template details. master_admin can always create and edit.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {Object.entries(ROLE_COPY).map(([role, copy]) => (
          <div key={role} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{copy.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{copy.desc}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(role)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${config.allowCreateEdit[role] ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${config.allowCreateEdit[role] ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
