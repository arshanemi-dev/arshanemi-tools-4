import { NextResponse } from 'next/server'

// Testing-only connectivity check — not linked from any nav, no auth gate (see
// proxy.js's matcher: only /api/admin and /listing-tools require a session).
// Fetches each target server-side (so this isn't subject to browser CORS the
// way a client-side fetch to another origin would be) and reports exactly
// what happened: final status, whether it redirected, or the raw error a
// misconfigured URL throws (e.g. a scheme-less NEXT_PUBLIC_ADMIN_API_URL —
// see app/api/auth/login/route.js's own comment on this exact failure mode).
//
// GET /api/diagnostics/urls              -> default target list below
// GET /api/diagnostics/urls?urls=a,b,c   -> check these instead

const DEFAULT_URLS = [
  'https://linkgenerater.barmeto.com/',
  'https://bgremover.barmeto.com/',
  'https://pdfcropper.barmeto.com/',
  'https://lisiting-tools-live.vercel.app/',
]

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || ''

async function checkOne(url, { method = 'GET', body } = {}) {
  const startedAt = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
    const text = await res.text().catch(() => '')
    return {
      url,
      method,
      ok: res.ok,
      status: res.status,
      redirected: res.redirected,
      finalUrl: res.url,
      bodyPreview: text.slice(0, 300),
      ms: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      url,
      method,
      ok: false,
      status: null,
      error: err?.message || String(err),
      ms: Date.now() - startedAt,
    }
  }
}

export async function GET(req) {
  const qs = req.nextUrl.searchParams.get('urls')
  const urls = qs ? qs.split(',').map((u) => u.trim()).filter(Boolean) : DEFAULT_URLS

  const checks = urls.map((u) => checkOne(u))

  // Also directly exercises the exact call this app's own login proxy makes
  // (lib/connect.js's proxyAuthCall) — same body shape that earlier returned
  // a clean 400 "Identifier and password required" from a healthy root, vs.
  // a thrown "Failed to parse URL" from a scheme-less NEXT_PUBLIC_ADMIN_API_URL.
  const adminLoginCheck = ADMIN_URL
    ? checkOne(`${ADMIN_URL}/api/auth/login`, { method: 'POST', body: {} })
    : Promise.resolve({ url: '(NEXT_PUBLIC_ADMIN_API_URL is empty)', ok: false, status: null })

  const [results, adminLogin] = await Promise.all([Promise.all(checks), adminLoginCheck])

  return NextResponse.json({
    env: {
      NEXT_PUBLIC_IS_CONNECT: process.env.NEXT_PUBLIC_IS_CONNECT || null,
      NEXT_PUBLIC_ADMIN_API_URL: ADMIN_URL || null,
    },
    results,
    adminLoginCheck: adminLogin,
  })
}
