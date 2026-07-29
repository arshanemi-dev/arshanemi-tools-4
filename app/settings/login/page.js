'use client'
import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { saveAuthTokens } from '@/lib/tokenStore'
import OtpPasswordResetModal from '@/components/admin/OtpPasswordResetModal'

const OTP_SECONDS = 60

export default function LoginPage() {
  const [step, setStep] = useState('credentials') // 'credentials' | 'otp'
  const [form, setForm] = useState({ username: '', password: '' })
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [timer, setTimer] = useState(0)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const intervalRef = useRef(null)
  const inputRefs = useRef([])

  useEffect(() => {
    if (timer <= 0) { clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(intervalRef.current)
  }, [timer])

  function finishLogin(data) {
    saveAuthTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      user: data.user,
    })
    // Full navigation, not the client router: /settings is gated by a
    // server-side cookie check (middleware + layout), and the client Router
    // Cache can still be holding the pre-login "redirect to /settings/login"
    // response for this URL, which would bounce us straight back here.
    window.location.href = '/settings'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid credentials'); return }
      if (data.otpRequired) {
        setStep('otp')
        setOtp(['', '', '', '', '', ''])
        setTimer(OTP_SECONDS)
        return
      }
      finishLogin(data)
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, otpCode: code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid or expired OTP'); return }
      finishLogin(data)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to resend OTP'); return }
      setOtp(['', '', '', '', '', ''])
      setTimer(OTP_SECONDS)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-surface flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-accent-hover flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold">A</span>
          </div>
          <span className="text-white font-semibold text-lg">Arshanemi</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-snug mb-4">
            Manage your<br />tools &amp; content<br />from one place.
          </h1>
          <p className="text-white/70 text-base leading-relaxed">
            Update services, blogs, team, FAQs, testimonials, and more — all from a single, secure admin panel.
          </p>
        </div>

        <p className="text-white/50 text-sm">
          © {new Date().getFullYear()} Arshanemi. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-semibold text-foreground">Arshanemi</span>
          </div>

          {step === 'credentials' ? (
            <>
              <h2 className="text-2xl font-bold text-foreground mb-1">Welcome back</h2>
              <p className="text-subtle text-sm mb-8">Sign in to your admin panel</p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-muted">Username</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="admin"
                    required
                    autoComplete="username"
                    className="w-full rounded-xl border border-divider-light px-4 py-3 text-sm text-foreground placeholder-subtle bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-muted">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-divider-light px-4 py-3 pr-11 text-sm text-foreground placeholder-subtle bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-muted"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="self-end text-xs font-medium text-accent hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                  ) : 'Sign In'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5 text-accent" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-1">Verify it&apos;s you</h2>
              <p className="text-subtle text-sm mb-2">
                A 6-digit code was emailed to the address on file for <strong className="text-foreground">{form.username}</strong>.
              </p>

              <div className={`inline-flex items-center gap-1.5 text-sm font-semibold mb-6 ${timer > 0 ? 'text-accent' : 'text-red-500'}`}>
                <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[10px] font-bold">
                  {timer}
                </span>
                {timer > 0 ? `Code expires in ${timer}s` : 'Code expired'}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
                  {error}
                </div>
              )}

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
                onClick={handleVerifyOtp}
                disabled={loading || timer === 0}
                className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mb-4"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : 'Verify & Sign In'}
              </button>

              {timer === 0 ? (
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="w-full text-accent hover:underline text-sm font-medium"
                >
                  Resend code
                </button>
              ) : (
                <button
                  onClick={() => { setStep('credentials'); setError(''); setOtp(['','','','','','']) }}
                  className="w-full text-subtle hover:text-muted text-sm font-medium"
                >
                  Back to login
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <OtpPasswordResetModal
        open={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  )
}
