// Attempt limiting for the routes anyone can call without a session — sign-in,
// OTP send/verify, password reset, the public forms. Without it a 6-digit OTP
// can simply be guessed in a loop, a password list can be replayed, and the
// form routes can be used to flood the company inbox.
//
// Deliberately simple: fixed windows counted in this server process's memory.
// On a serverless host each instance counts on its own and forgets when it is
// recycled, so this slows abuse down sharply rather than guaranteeing a hard
// global cap — a shared store (Redis/DB) would be needed for that.
import { NextResponse } from 'next/server'

const windows = new Map() // key → { count, resetAt }
const MAX_KEYS = 5000

// The caller's address. Behind the platform's proxy the first
// x-forwarded-for entry is the real client; without a proxy it's absent and
// everything shares the one 'unknown' bucket, which only makes the limit
// stricter.
export function clientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for')
  return (forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown').trim() || 'unknown'
}

// Counts one attempt against `key`. → { ok } or { ok: false, retryAfter } (seconds).
export function countAttempt(key, { limit, windowMs }) {
  const now = Date.now()
  let entry = windows.get(key)
  if (!entry || entry.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k)
      if (windows.size >= MAX_KEYS) windows.clear()
    }
    entry = { count: 0, resetAt: now + windowMs }
    windows.set(key, entry)
  }
  entry.count += 1
  if (entry.count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) }
  return { ok: true }
}

// One call per route: counts an attempt for this caller's address and — when
// the request names an account/target (`subject`, e.g. the email being signed
// into) — a second, tighter one for that address + subject pair. Returns the
// 429 response to send, or null to carry on.
export function tooManyAttempts(req, name, { limit, windowMs, subject, subjectLimit } = {}) {
  const ip = clientIp(req)
  const checks = [countAttempt(`${name}|${ip}`, { limit, windowMs })]
  const who = String(subject ?? '').trim().toLowerCase()
  if (who && subjectLimit) checks.push(countAttempt(`${name}|${ip}|${who}`, { limit: subjectLimit, windowMs }))
  const blocked = checks.find((c) => !c.ok)
  if (!blocked) return null
  return NextResponse.json(
    { error: 'Too many attempts. Please wait a few minutes and try again.' },
    { status: 429, headers: { 'Retry-After': String(blocked.retryAfter) } },
  )
}

export const MINUTES = 60 * 1000
