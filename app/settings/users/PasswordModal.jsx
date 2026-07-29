'use client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from '@/components/admin/Modal'
import FormField from '@/components/admin/FormField'

export default function PasswordModal({ open, user, onClose, onSaved }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setPassword(''); setError('') }
  }, [open])

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to update password'); return }
      onSaved()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Change Password${user ? ` — ${user.name}` : ''}`}
      footer={(
        <>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-divider-light text-sm font-medium text-muted py-2.5 hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !password}
            className="flex-1 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</> : 'Update Password'}
          </button>
        </>
      )}
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
      )}
      <FormField
        label="New Password" name="password" type="password" required
        value={password} onChange={(e) => setPassword(e.target.value)}
        hint="Min 8 characters, 1 uppercase letter, 1 number, 1 special character"
      />
    </Modal>
  )
}
