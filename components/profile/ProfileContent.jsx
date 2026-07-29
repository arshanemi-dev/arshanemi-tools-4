'use client'
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Loader2, CreditCard, Wallet, CheckCircle2, XCircle } from 'lucide-react'
import { TableSkeleton, LoadError } from '@/components/admin/Skeleton'
import { useToast } from '@/components/admin/Toast'
import FormField from '@/components/admin/FormField'
import ChangeContactSection from './ChangeContactSection'
import ChangePasswordSection from './ChangePasswordSection'
import ProfileBanner from './ProfileBanner'
import { COUNTRIES, DEFAULT_COUNTRY, INDIA_STATES } from '@/data/geoIndia'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'setting', label: 'Setting' },
  // { id: 'tokenUse', label: 'Subscription' },
]

const SUBSCRIPTION_STATUS_STYLES = {
  active: 'bg-green-50 text-green-700',
  trialing: 'bg-blue-50 text-blue-700',
  past_due: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-700',
  inactive: 'bg-surface text-subtle',
}

function formFromProfile(p) {
  return {
    name: p.name || '',
    businessName: p.businessName || '',
    gstNumber: p.gstNumber || '',
    address1: p.address1 || '',
    address2: p.address2 || '',
    addressCity: p.addressCity || '',
    addressState: p.addressState || '',
    addressCountry: p.addressCountry || DEFAULT_COUNTRY,
    addressPincode: p.addressPincode || '',
  }
}

function SubscriptionCard({ subscription }) {
  if (!subscription) return null
  const plan = subscription.planDetails
  const status = subscription.status || 'inactive'

  return (
    <div className="bg-card rounded-2xl border border-divider p-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-foreground">Subscription</h2>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-foreground truncate">{plan?.name || subscription.plan || 'No plan'}</p>
          {plan && (
            <p className="text-xs text-subtle mt-0.5">
              {plan.price === 0 ? 'Free' : `₹${plan.price} / ${plan.interval}`}
            </p>
          )}
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize flex-shrink-0 ${SUBSCRIPTION_STATUS_STYLES[status] || SUBSCRIPTION_STATUS_STYLES.inactive}`}>
          {status.replace('_', ' ')}
        </span>
      </div>
      {subscription.currentPeriodEnd && (
        <p className="text-xs text-subtle mt-3">
          {subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'} on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-subtle uppercase tracking-wide">{label}</span>
      <span className={value ? 'text-sm font-medium text-foreground' : 'text-sm text-subtle italic'}>
        {value || 'Not provided'}
      </span>
    </div>
  )
}

function WalletCard({ profile }) {
  const total = profile.walletCreditsTotal ?? 0
  const used = profile.walletCreditsUsed ?? 0
  const remaining = profile.walletCreditsRemaining ?? Math.max(0, total - used)
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0

  return (
    <div className="bg-card rounded-2xl border border-divider p-6">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-foreground">Token Use</h2>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center mb-4">
        <div>
          <p className="text-xl font-bold text-foreground">{total}</p>
          <p className="text-[11px] text-subtle mt-0.5">Total</p>
        </div>
        <div>
          <p className="text-xl font-bold text-foreground">{used}</p>
          <p className="text-[11px] text-subtle mt-0.5">Used</p>
        </div>
        <div>
          <p className="text-xl font-bold text-accent">{remaining}</p>
          <p className="text-[11px] text-subtle mt-0.5">Remaining</p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-surface overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-subtle mt-2">{pct}% of credits used</p>
    </div>
  )
}

// Shared profile experience — rendered at both /settings/profile (staff,
// inside the admin shell) and /profile (plain 'user' role, inside the
// public dashboard shell with DashboardTopbar). Fully self-contained:
// fetches its own data via /api/auth/me (cookie or Bearer auth), so it
// doesn't care which shell it's mounted in — only needs a ToastProvider
// ancestor for the save/update toasts.
export default function ProfileContent() {
  const { addToast } = useToast()
  const [profile, setProfile] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('profile')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [pincodeStatus, setPincodeStatus] = useState('idle') // idle | checking | valid | invalid
  const [pincodeMessage, setPincodeMessage] = useState('')

  async function load() {
    setError(false)
    try {
      const [profileRes, subRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/admin/subscription').catch(() => null),
      ])
      if (!profileRes.ok) throw new Error()
      const data = await profileRes.json()
      setProfile(data)
      setForm(formFromProfile(data))
      setSubscription(subRes?.ok ? await subRes.json() : null)
    } catch {
      setError(true)
    }
  }

  useEffect(() => { load() }, [])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function startEdit() {
    setForm(formFromProfile(profile))
    setFormError('')
    setPincodeStatus('idle')
    setPincodeMessage('')
    setEditing(true)
  }

  function cancelEdit() {
    setForm(formFromProfile(profile))
    setFormError('')
    setPincodeStatus('idle')
    setPincodeMessage('')
    setEditing(false)
  }

  // Debounced pincode → state/city lookup while editing.
  useEffect(() => {
    if (!editing) return
    const code = form?.addressPincode?.trim()
    if (!code || code.length !== 6) { setPincodeStatus('idle'); setPincodeMessage(''); return }

    setPincodeStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geo/pincode/${code}`)
        const data = await res.json()
        if (data.valid) {
          setPincodeStatus('valid')
          setPincodeMessage('')
          setForm((f) => ({
            ...f,
            addressState: data.state || f.addressState,
            addressCity: data.city || f.addressCity,
          }))
        } else {
          setPincodeStatus('invalid')
          setPincodeMessage(data.message || 'Invalid pincode')
        }
      } catch {
        setPincodeStatus('invalid')
        setPincodeMessage('Could not verify pincode')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [form?.addressPincode, editing])

  const stateOptions = useMemo(() => {
    const names = new Set(INDIA_STATES)
    if (form?.addressState) names.add(form.addressState)
    return [{ value: '', label: 'Select state' }, ...[...names].sort().map((s) => ({ value: s, label: s }))]
  }, [form])

  const cityOptions = useMemo(() => {
    const names = new Set()
    if (form?.addressCity) names.add(form.addressCity)
    return [{ value: '', label: 'Select city' }, ...[...names].map((c) => ({ value: c, label: c }))]
  }, [form])

  const countryOptions = COUNTRIES.map((c) => ({ value: c.name, label: c.name }))

  async function handleSaveProfile() {
    setFormError('')
    if (!form.name.trim()) { setFormError('Name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          businessName: form.businessName.trim() || null,
          gstNumber: form.gstNumber.trim() || null,
          address1: form.address1.trim() || null,
          address2: form.address2.trim() || null,
          addressCity: form.addressCity.trim() || null,
          addressState: form.addressState.trim() || null,
          addressCountry: form.addressCountry.trim() || null,
          addressPincode: form.addressPincode.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error || 'Failed to save'); return }
      setProfile(data)
      setForm(formFromProfile(data))
      setEditing(false)
      addToast('Profile updated')
    } catch {
      setFormError('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <LoadError onRetry={load} />
  if (!profile || !form) return <TableSkeleton rows={6} />

  return (
    <div className="flex flex-col gap-6">
      <ProfileBanner profile={profile} />

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-divider">
        <div className="flex items-center gap-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 text-lg font-bold transition-colors border-b-2 -mb-px ${
                tab === t.id ? 'text-foreground border-foreground' : 'text-subtle border-transparent hover:text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'profile' && (
        <div className="flex flex-col gap-6">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{formError}</div>
          )}

          {/* Basic information */}
          <div className="bg-card rounded-2xl border border-divider p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
              {!editing && (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 rounded-xl border border-divider-light px-4 py-2 text-sm font-medium text-muted hover:bg-surface hover:text-accent hover:border-accent/30 transition-colors flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              )}
            </div>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <FormField label="Name" name="name" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Your name" />
                <FormField label="Company Name (Optional)" name="businessName" value={form.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="Company Name" />
                <FormField label="GST Number (Optional)" name="gstNumber" value={form.gstNumber} onChange={(e) => set('gstNumber', e.target.value)} placeholder="GST Number" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <InfoRow label="Full Name" value={profile.name} />
                <InfoRow label="Company Name" value={profile.businessName} />
                <InfoRow label="GST Number" value={profile.gstNumber} />
              </div>
            )}
          </div>

          {/* Address */}
          <div className="bg-card rounded-2xl border border-divider p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Address <span className="font-normal text-subtle">(Optional)</span></h3>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <FormField label="Line 1" name="address1" value={form.address1} onChange={(e) => set('address1', e.target.value)} placeholder="Line 1" />
                <FormField label="Line 2" name="address2" value={form.address2} onChange={(e) => set('address2', e.target.value)} placeholder="Line 2" />

                <div className="flex flex-col gap-1.5">
                  <FormField
                    label="Pin code / Zip code" name="addressPincode"
                    value={form.addressPincode}
                    onChange={(e) => set('addressPincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit pincode"
                  />
                  {pincodeStatus === 'checking' && (
                    <p className="text-xs text-subtle flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking pincode…</p>
                  )}
                  {pincodeStatus === 'valid' && (
                    <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Pincode found — state &amp; city filled below</p>
                  )}
                  {pincodeStatus === 'invalid' && (
                    <p className="text-xs text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3" /> {pincodeMessage || 'Invalid pincode'}</p>
                  )}
                </div>

                <FormField
                  label="Country" name="addressCountry" type="select"
                  options={countryOptions} value={form.addressCountry}
                  onChange={(e) => set('addressCountry', e.target.value)}
                />
                <FormField
                  label="State" name="addressState" type="select"
                  options={stateOptions} value={form.addressState}
                  onChange={(e) => set('addressState', e.target.value)}
                />
                <FormField
                  label="City" name="addressCity" type="select"
                  options={cityOptions} value={form.addressCity}
                  onChange={(e) => set('addressCity', e.target.value)}
                />
              </div>
            ) : [profile.address1, profile.address2, profile.addressCity, profile.addressState, profile.addressPincode, profile.addressCountry].some(Boolean) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <InfoRow label="Line 1" value={profile.address1} />
                <InfoRow label="Line 2" value={profile.address2} />
                <InfoRow label="Pin code / Zip code" value={profile.addressPincode} />
                <InfoRow label="Country" value={profile.addressCountry} />
                <InfoRow label="State" value={profile.addressState} />
                <InfoRow label="City" value={profile.addressCity} />
              </div>
            ) : (
              <p className="text-sm text-subtle">No address on file. Click Edit to add one.</p>
            )}
          </div>

          {editing && (
            <div className="flex gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-6 py-2.5 transition-colors disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
              <button
                onClick={cancelEdit}
                className="rounded-xl border border-divider-light text-muted text-sm font-medium px-6 py-2.5 hover:bg-surface transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'setting' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ChangeContactSection
            type="mobile" label="Mobile Number" currentValue={profile.mobile}
            onUpdated={(updated) => { setProfile(updated); setForm(formFromProfile(updated)); addToast('Mobile number updated') }}
          />
          <ChangeContactSection
            type="email" label="Email ID" currentValue={profile.email}
            onUpdated={(updated) => { setProfile(updated); setForm(formFromProfile(updated)); addToast('Email address updated') }}
          />
          <ChangePasswordSection
            email={profile.email} mobile={profile.mobile}
            onDone={() => addToast('Password changed successfully')}
          />
        </div>
      )}

      {tab === 'tokenUse' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <SubscriptionCard subscription={subscription} />
          <WalletCard profile={profile} />
        </div>
      )}
    </div>
  )
}
