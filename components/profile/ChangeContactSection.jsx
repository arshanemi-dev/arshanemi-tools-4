'use client'
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import FormField from '@/components/admin/FormField'
import OtpDigitsInput from '@/components/admin/OtpDigitsInput'

const OTP_SECONDS = 60
const OTP_DISABLED = process.env.NEXT_PUBLIC_IS_OTP_Verifications_Disable === 'true'

// Always-open "change email/mobile" column — no expand/collapse. Enter the
// new value, send an OTP to THAT new value (proving ownership of it), enter
// the code, Save verifies + applies in one step. When
// NEXT_PUBLIC_IS_OTP_Verifications_Disable=true, the send-code step is
// skipped entirely — Save calls verify-contact-change directly with a dummy
// code, which the backend's bypassed verifyOTP() accepts unconditionally.
export default function ChangeContactSection({ type, label, currentValue, onUpdated }) {
  const [newValue, setNewValue] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [codeSent, setCodeSent] = useState(false)
  const [timer, setTimer] = useState(0)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const intervalRef = useRef(null)

  useEffect(() => {
    if (timer <= 0) { clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [timer])

  async function handleSendCode() {
    setError(''); setSuccess('')
    if (!newValue.trim()) { setError(`Enter a new ${label.toLowerCase()}`); return }
    setSending(true)
    try {
      const res = await fetch('/api/auth/send-contact-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value: newValue.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to send code'); return }
      setCodeSent(true)
      setOtp(['', '', '', '', '', ''])
      setTimer(OTP_SECONDS)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSending(false)
    }
  }

  async function handleSave() {
    setError(''); setSuccess('')
    const code = otp.join('')
    if (!OTP_DISABLED) {
      if (!newValue.trim()) { setError(`Enter a new ${label.toLowerCase()}`); return }
      if (!codeSent) { setError('Send a verification code first'); return }
      if (code.length < 6) { setError('Enter all 6 digits'); return }
    } else if (!newValue.trim()) {
      setError(`Enter a new ${label.toLowerCase()}`); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/verify-contact-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value: newValue.trim(), otpCode: OTP_DISABLED ? '000000' : code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid or expired code'); return }
      onUpdated(data)
      setSuccess(`${label} updated successfully`)
      setNewValue('')
      setOtp(['', '', '', '', '', ''])
      setCodeSent(false)
      setTimer(0)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField
        label={`Old ${label}`} name={`old-${type}`} disabled
        value={currentValue || ''} onChange={() => {}}
        placeholder={`Old ${label.toLowerCase()}`}
      />
      <FormField
        label={`New ${label}`} name={`new-${type}`}
        type={type === 'email' ? 'email' : 'text'}
        value={newValue} onChange={(e) => setNewValue(e.target.value)}
        placeholder={`New ${label.toLowerCase()}`}
      />

      {!OTP_DISABLED && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted">Send verification code</label>
          <OtpDigitsInput value={otp} onChange={setOtp} />
          {codeSent && (
            <p className="text-xs text-subtle">
              {timer > 0 ? `Code expires in ${timer}s` : 'Code expired — send a new one'}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-green-600">{success}</p>}

      <div className="flex items-center gap-3">
        {!OTP_DISABLED && (
          <button
            onClick={handleSendCode}
            disabled={sending}
            className="flex items-center gap-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50"
          >
            {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Send Code
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || (!OTP_DISABLED && !codeSent)}
          className="flex items-center gap-2 rounded-lg border border-divider-light text-foreground text-sm font-semibold px-4 py-2 hover:bg-surface transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
        </button>
      </div>
    </div>
  )
}
