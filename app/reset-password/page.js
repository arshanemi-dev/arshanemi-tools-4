'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react'

function PasswordRule({ met, text }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-400' : 'text-subtle'}`}>
      {met ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {text}
    </li>
  )
}

function checkPassword(pw) {
  return {
    length:  pw.length >= 8,
    upper:   /[A-Z]/.test(pw),
    number:  /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  }
}

function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token  = params.get('token') || ''

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [showPw, setShowPw]  = useState(false)
  const [showCo, setShowCo]  = useState(false)
  const [error,  setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const rules   = checkPassword(form.password)
  const pwValid = Object.values(rules).every(Boolean)
  const pwMatch = form.password && form.confirm === form.password

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!pwValid)  { setError('Password does not meet all requirements'); return }
    if (!pwMatch)  { setError('Passwords do not match'); return }
    if (!token)    { setError('Invalid or missing reset token'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Reset failed'); return }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3500)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={32} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Password Reset!</h2>
        <p className="text-muted text-sm mb-6">
          Your password has been updated successfully.
          Redirecting to login in a moment…
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
        >
          Go to Login
        </Link>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-2">Set new password</h1>
      <p className="text-muted text-sm mb-8">
        Choose a strong password for your Arshanemi account.
      </p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-5">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted">New Password</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              required
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full rounded-xl border border-divider-light bg-card px-4 py-3 pr-11 text-sm text-foreground placeholder-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
            />
            <button type="button" onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-muted">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {form.password && (
            <ul className="mt-1.5 space-y-1">
              <PasswordRule met={rules.length}  text="At least 8 characters" />
              <PasswordRule met={rules.upper}   text="One uppercase letter (A-Z)" />
              <PasswordRule met={rules.number}  text="One number (0-9)" />
              <PasswordRule met={rules.special} text="One special character (!@#$…)" />
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted">Confirm New Password</label>
          <div className="relative">
            <input
              type={showCo ? 'text' : 'password'}
              required
              placeholder="Re-enter new password"
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
              className={`w-full rounded-xl border bg-card px-4 py-3 pr-11 text-sm text-foreground placeholder-subtle focus:outline-none focus:ring-2 focus:ring-accent transition-colors
                ${form.confirm && !pwMatch ? 'border-red-500/60' : 'border-divider-light focus:border-accent'}`}
            />
            <button type="button" onClick={() => setShowCo((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-muted">
              {showCo ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {form.confirm && !pwMatch && (
            <p className="text-red-400 text-xs mt-0.5">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
        >
          {loading ? <><Loader2 className="animate-spin" size={16} /> Resetting…</> : 'Reset Password'}
        </button>
      </form>

      <p className="text-center text-sm text-muted mt-6">
        <Link href="/login" className="text-accent hover:underline font-medium">Back to login</Link>
      </p>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
            <span className="text-white font-bold">A</span>
          </div>
          <span className="font-bold text-foreground text-lg">Arshanemi</span>
        </div>
        <Suspense fallback={<div className="text-muted text-sm">Loading…</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  )
}
