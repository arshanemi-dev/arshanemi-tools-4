'use client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from '@/components/admin/Modal'
import FormField from '@/components/admin/FormField'

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
]

function emptyForm(companies) {
  return {
    name: '', email: '', mobile: '', password: '',
    role: 'user', companyId: companies[0]?.id || '',
    otpEnabled: false, isActive: true,
    walletCreditsTotal: 0, walletCreditsUsed: 0,
  }
}

export default function UserFormModal({ open, mode, viewer, companies, initial, onClose, onSaved }) {
  const isMaster = viewer?.role === 'master_admin'
  const [form, setForm] = useState(() => emptyForm(companies))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (mode === 'edit' && initial) {
      setForm({
        name: initial.name || '', email: initial.email || '', mobile: initial.mobile || '',
        password: '',
        role: initial.role, companyId: initial.company_id || '',
        otpEnabled: !!initial.otp_enabled, isActive: !!initial.is_active,
        walletCreditsTotal: initial.wallet_credits_total ?? 0,
        walletCreditsUsed: initial.wallet_credits_used ?? 0,
      })
    } else {
      setForm(emptyForm(companies))
    }
  }, [open, mode, initial, companies])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setError('')
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.email.trim() && !form.mobile.trim()) { setError('Provide at least an email or mobile number'); return }
    if (mode === 'create' && !form.password) { setError('Password is required'); return }
    if (isMaster && !form.companyId) { setError('Please select a company'); return }

    setSaving(true)
    try {
      const url = mode === 'create' ? '/api/admin/users' : `/api/admin/users/${initial.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const body = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        mobile: form.mobile.trim() || null,
        otpEnabled: form.otpEnabled,
        isActive: form.isActive,
        walletCreditsTotal: Math.max(0, +form.walletCreditsTotal || 0),
        walletCreditsUsed: Math.max(0, +form.walletCreditsUsed || 0),
      }
      if (mode === 'create') body.password = form.password
      if (isMaster) {
        body.role = form.role
        body.companyId = form.companyId
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save'); return }
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
      title={mode === 'create' ? 'New User' : 'Edit User'}
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

      <FormField label="Name" name="name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
      <FormField label="Email" name="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      <FormField label="Mobile" name="mobile" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />

      {mode === 'create' && (
        <FormField
          label="Password" name="password" type="password" required
          value={form.password} onChange={(e) => set('password', e.target.value)}
          hint="Min 8 characters, 1 uppercase letter, 1 number, 1 special character"
        />
      )}

      {isMaster && (
        <>
          <FormField
            label="Role" name="role" type="select" options={ROLE_OPTIONS}
            value={form.role} onChange={(e) => set('role', e.target.value)}
          />
          <FormField
            label="Company" name="companyId" type="select"
            options={companies.map((c) => ({ value: c.id, label: c.name || c.email }))}
            value={form.companyId} onChange={(e) => set('companyId', e.target.value)}
          />
        </>
      )}

      {mode === 'edit' && (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Wallet Credits (Total)" name="walletCreditsTotal" type="number" min={0}
            value={form.walletCreditsTotal} onChange={(e) => set('walletCreditsTotal', e.target.value)}
          />
          <FormField
            label="Wallet Credits (Used)" name="walletCreditsUsed" type="number" min={0}
            value={form.walletCreditsUsed} onChange={(e) => set('walletCreditsUsed', e.target.value)}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted">Require OTP on login</label>
        <FormField name="otpEnabled" type="toggle" value={form.otpEnabled} onChange={(e) => set('otpEnabled', e.target.value)} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted">Active</label>
        <FormField name="isActive" type="toggle" value={form.isActive} onChange={(e) => set('isActive', e.target.value)} />
      </div>
    </Modal>
  )
}
