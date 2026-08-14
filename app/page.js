import { redirect } from 'next/navigation'

// Cross-app SSO handoff (see lib/tokenHandoff.js, proxy.js) — root appends its own issued tokens
// as lt_at/lt_rt/lt_u on this app's URL when opening it embedded in its own iframe. A plain
// `redirect('/listing-tools')` drops the current URL's query string entirely, so those tokens
// never survived landing here — proxy.js's own `lt_at` handling on the redirected request never
// got a chance to run. Forwarding just these three known params (not the whole query string,
// which could carry anything) keeps this a deliberate, narrow pass-through rather than an open
// one.
export default async function Home({ searchParams }) {
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const key of ['lt_at', 'lt_rt', 'lt_u']) {
    const value = sp?.[key]
    if (typeof value === 'string') qs.set(key, value)
  }
  redirect(`/listing-tools${qs.toString() ? `?${qs}` : ''}`)
}
