'use client'
import { useEffect, useRef, useState } from 'react'
import { Loader2, Mail, Phone } from 'lucide-react'
import FormField from '@/components/admin/FormField'
import OtpDigitsInput from '@/components/admin/OtpDigitsInput'

const OTP_SECONDS = 60
const OTP_DISABLED = process.env.NEXT_PUBLIC_IS_OTP_Verifications_Disable === 'true'

// Always-open "change password" column — requires the current password
// (something you know) AND a fresh OTP to an on-file channel (something you
// have), verified and applied together via /api/auth/change-password. When
// NEXT_PUBLIC_IS_OTP_Verifications_Disable=true, the OTP step is skipped
// entirely — the backend's verifyOTP() bypasses regardless of the code sent,
// so this just stops showing UI for a check that no longer happens.
export default function ChangePasswordSection({ email, mobile, onDone }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [channel, setChannel] = useState(email ? 'email' : 'mobile')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [codeSent, setCodeSent] = useState(false)
  const [timer, setTimer] = useState(0)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const intervalRef = useRef(null)

  const identifier = channel === 'email' ? email : mobile

  useEffect(() => {
    if (timer <= 0) { clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [timer])

  async function handleSendCode() {
    setError(''); setSuccess('')
    setSending(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, type: channel }),
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
    if (!oldPassword) { setError('Enter your current password'); return }
    if (!newPassword) { setError('Enter a new password'); return }
    if (!OTP_DISABLED && (!codeSent || code.length < 6)) { setError('Send and enter the 6-digit code first'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword, otpCode: OTP_DISABLED ? '000000' : code, identifier: identifier || 'na' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to change password'); return }
      setSuccess('Password changed successfully')
      setOldPassword('')
      setNewPassword('')
      setOtp(['', '', '', '', '', ''])
      setCodeSent(false)
      setTimer(0)
      onDone?.()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField
        label="Old Password" name="old-password" type="password"
        value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
        placeholder="Old password"
      />
      <FormField
        label="New Password" name="new-password" type="password"
        value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
        placeholder="New password"
        hint="Min 8 characters, 1 uppercase letter, 1 number, 1 special character"
      />

      {!OTP_DISABLED && email && mobile && (
        <div className="flex items-center gap-1 p-1 bg-surface rounded-lg w-fit">
          <button
            type="button" onClick={() => setChannel('email')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              channel === 'email' ? 'bg-card text-foreground shadow-sm' : 'text-subtle hover:text-muted'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
          <button
            type="button" onClick={() => setChannel('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              channel === 'mobile' ? 'bg-card text-foreground shadow-sm' : 'text-subtle hover:text-muted'
            }`}
          >
            <Phone className="w-3.5 h-3.5" /> Mobile
          </button>
        </div>
      )}

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
            disabled={sending || !identifier}
            className="flex items-center gap-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50"
          >
            {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Send Code
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg border border-divider-light text-foreground text-sm font-semibold px-4 py-2 hover:bg-surface transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
        </button>
      </div>
    </div>
  )
}
