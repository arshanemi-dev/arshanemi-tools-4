'use client'
import { useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import Modal from './Modal'
import FormField from './FormField'

const OTP_SECONDS = 60
const OTP_DISABLED = process.env.NEXT_PUBLIC_IS_OTP_Verifications_Disable === 'true'

// Self-service, OTP-gated password reset — reuses the existing
// send-otp / verify-otp / reset-password endpoints unchanged.
// Pass `identifier` when the caller already knows the user's email (e.g. the
// Profile page's "Change Password" button) to skip straight to the OTP step;
// omit it to ask the visitor for their email/mobile first (login page's
// "Forgot password?" flow). When NEXT_PUBLIC_IS_OTP_Verifications_Disable is
// true, the 'otp' step is skipped entirely — identifier goes straight to
// verify-otp with a dummy code (the backend's verifyOTP() bypasses
// unconditionally) to fetch the resetToken and land on 'password'.
export default function OtpPasswordResetModal({ open, identifier: fixedIdentifier, onClose, onDone }) {
  const [step, setStep] = useState('identifier') // identifier | otp | password | done
  const [identifier, setIdentifier] = useState(fixedIdentifier || '')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [timer, setTimer] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef(null)
  const inputRefs = useRef([])

  useEffect(() => {
    if (!open) return
    setError('')
    setOtp(['', '', '', '', '', ''])
    setResetToken('')
    setPassword('')
    setConfirm('')
    if (fixedIdentifier) {
      setIdentifier(fixedIdentifier)
      sendOtp(fixedIdentifier)
    } else {
      setIdentifier('')
      setStep('identifier')
    }
    // Only re-run when the modal is opened — sendOtp is intentionally excluded
    // to avoid re-firing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (timer <= 0) { clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [timer])

  async function sendOtp(id) {
    if (!id?.trim()) return
    setError('')
    setLoading(true)

    if (OTP_DISABLED) {
      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: id.trim(), otpCode: '000000' }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Could not verify identity'); return }
        setResetToken(data.resetToken)
        setStep('password')
      } catch {
        setError('Network error — please try again')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const type = id.includes('@') ? 'email' : 'mobile'
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: id.trim(), type }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to send OTP'); return }
      setStep('otp')
      setOtp(['', '', '', '', '', ''])
      setTimer(OTP_SECONDS)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  function handleOtpChange(val, idx) {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]
    next[idx] = val
    setOtp(next)
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus()
  }

  function handleOtpKeyDown(e, idx) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputRefs.current[idx - 1]?.focus()
  }

  async function handleVerifyOtp() {
    const code = otp.join('')
    if (code.length < 6) { setError('Enter all 6 digits'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otpCode: code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid or expired OTP'); return }
      setResetToken(data.resetToken)
      setStep('password')
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetPassword() {
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to reset password'); return }
      setStep('done')
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const titles = { identifier: 'Reset Password', otp: 'Verify OTP', password: 'Set New Password', done: 'Password Updated' }

  return (
    <Modal open={open} onClose={onClose} title={titles[step]}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {step === 'identifier' && (
        <>
          <FormField
            label="Email or Mobile" name="identifier" value={identifier}
            onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com"
          />
          <button
            onClick={() => sendOtp(identifier)}
            disabled={loading || !identifier.trim()}
            className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {OTP_DISABLED ? 'Continuing…' : 'Sending…'}</>
              : OTP_DISABLED ? 'Continue' : 'Send OTP'}
          </button>
        </>
      )}

      {step === 'otp' && (
        <>
          <p className="text-sm text-subtle -mt-1">
            A 6-digit code was sent to <strong className="text-foreground">{identifier}</strong>.
          </p>
          <div className={`text-sm font-semibold ${timer > 0 ? 'text-accent' : 'text-red-500'}`}>
            {timer > 0 ? `Code expires in ${timer}s` : 'Code expired'}
          </div>
          <div className="flex gap-2 justify-center">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text" inputMode="numeric" maxLength={1} value={digit}
                onChange={(e) => handleOtpChange(e.target.value, i)}
                onKeyDown={(e) => handleOtpKeyDown(e, i)}
                className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-divider-light bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            ))}
          </div>
          <button
            onClick={handleVerifyOtp}
            disabled={loading || timer === 0}
            className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : 'Verify Code'}
          </button>
          {timer === 0 && (
            <button onClick={() => sendOtp(identifier)} disabled={loading} className="w-full text-accent hover:underline text-sm font-medium">
              Resend code
            </button>
          )}
        </>
      )}

      {step === 'password' && (
        <>
          <FormField
            label="New Password" name="password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="Min 8 characters, 1 uppercase letter, 1 number, 1 special character"
          />
          <FormField
            label="Confirm Password" name="confirm" type="password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            onClick={handleSetPassword}
            disabled={loading || !password || !confirm}
            className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Change Password'}
          </button>
        </>
      )}

      {step === 'done' && (
        <>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm text-muted">Your password has been changed successfully.</p>
          </div>
          <button
            onClick={() => { onDone?.(); onClose() }}
            className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            Done
          </button>
        </>
      )}
    </Modal>
  )
}
