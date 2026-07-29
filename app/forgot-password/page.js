'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Mail, Phone, ArrowLeft, CheckCircle2 } from 'lucide-react'

const OTP_SECONDS = 60
const OTP_DISABLED = process.env.NEXT_PUBLIC_IS_OTP_Verifications_Disable === 'true'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState('method')   // 'method' | 'otp' | 'done'
  const [method, setMethod] = useState('email') // 'email' | 'mobile'
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [timer, setTimer] = useState(0)
  const intervalRef = useRef(null)
  const inputRefs = useRef([])

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) { clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [timer])

  async function sendOTP() {
    setError('')
    if (!identifier.trim()) { setError('Please enter your ' + (method === 'email' ? 'email address' : 'mobile number')); return }
    setLoading(true)

    // OTP disabled — skip straight to a bypassed verify-otp call for the
    // resetToken (backend's verifyOTP() accepts any code unconditionally)
    // instead of showing the 'otp' step at all.
    if (OTP_DISABLED) {
      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: identifier.trim(), otpCode: '000000' }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Could not verify identity'); return }
        router.push(`/reset-password?token=${data.resetToken}`)
      } catch {
        setError('Network error — please try again')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), type: method }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to send OTP'); return }
      setStep('otp')
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

  async function verifyOTP() {
    const code = otp.join('')
    if (code.length < 6) { setError('Enter all 6 digits'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), otpCode: code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid or expired OTP'); return }
      // Pass to reset-password page via query params
      router.push(`/reset-password?token=${data.resetToken}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
            <span className="text-white font-bold">A</span>
          </div>
          <span className="font-bold text-foreground text-lg">Arshanemi</span>
        </div>

        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to login
        </Link>

        {/* Step 1: Choose method & enter identifier */}
        {step === 'method' && (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-2">Reset your password</h1>
            <p className="text-muted text-sm mb-8">
              We&apos;ll send a 6-digit OTP valid for 60 seconds to verify your identity.
            </p>

            {/* Method toggle */}
            <div className="flex gap-3 mb-5">
              <MethodBtn
                active={method === 'email'}
                icon={<Mail size={16} />}
                label="Email"
                onClick={() => { setMethod('email'); setIdentifier('') }}
              />
              <MethodBtn
                active={method === 'mobile'}
                icon={<Phone size={16} />}
                label="Mobile OTP"
                onClick={() => { setMethod('mobile'); setIdentifier('') }}
              />
            </div>

            {error && <ErrBanner msg={error} />}

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-sm font-medium text-muted">
                {method === 'email' ? 'Email Address' : 'Mobile Number'}
              </label>
              <input
                type={method === 'email' ? 'email' : 'tel'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={method === 'email' ? 'you@example.com' : '10-digit mobile number'}
                className="w-full rounded-xl border border-divider-light bg-card px-4 py-3 text-sm text-foreground placeholder-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
              />
            </div>

            <button
              onClick={sendOTP} disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="animate-spin" size={16} /> {OTP_DISABLED ? 'Continuing…' : 'Sending OTP…'}</>
                : OTP_DISABLED ? 'Continue' : 'Send OTP'}
            </button>
          </>
        )}

        {/* Step 2: Enter OTP */}
        {step === 'otp' && (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-2">Enter OTP</h1>
            <p className="text-muted text-sm mb-2">
              A 6-digit code was sent to <strong className="text-foreground">{identifier}</strong> via {method}.
            </p>

            {/* Countdown timer */}
            <div className={`inline-flex items-center gap-1.5 text-sm font-semibold mb-6 ${timer > 0 ? 'text-accent' : 'text-red-400'}`}>
              <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[10px] font-bold">
                {timer}
              </span>
              {timer > 0 ? `OTP expires in ${timer}s` : 'OTP expired'}
            </div>

            {error && <ErrBanner msg={error} />}

            {/* 6-digit OTP boxes */}
            <div className="flex gap-2 mb-6">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target.value, i)}
                  onKeyDown={(e) => handleOtpKeyDown(e, i)}
                  className="w-12 h-12 text-center text-xl font-bold rounded-xl border border-divider-light bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
                />
              ))}
            </div>

            <button
              onClick={verifyOTP} disabled={loading || timer === 0}
              className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mb-4"
            >
              {loading ? <><Loader2 className="animate-spin" size={16} /> Verifying…</> : 'Verify OTP'}
            </button>

            {timer === 0 && (
              <button
                onClick={() => { setOtp(['','','','','','']); setTimer(0); setStep('method'); setError('') }}
                className="w-full text-accent hover:underline text-sm font-medium"
              >
                Resend OTP
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MethodBtn({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors
        ${active
          ? 'bg-accent/10 border-accent text-accent'
          : 'border-divider-light text-muted hover:border-accent/40 hover:text-foreground bg-card'}`}
    >
      {icon} {label}
    </button>
  )
}

function ErrBanner({ msg }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
      {msg}
    </div>
  )
}
