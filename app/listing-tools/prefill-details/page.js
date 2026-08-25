'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// This page was renamed to Brand Details (app/listing-tools/brand-details/page.js) — kept as a
// redirect so an old bookmark/link to this URL still lands somewhere real instead of 404ing.
// `?template=` (the only query param this feature ever sets on this route) carries over.
export default function PrefillDetailsRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const qs = searchParams.toString()
    router.replace(`/listing-tools/brand-details${qs ? `?${qs}` : ''}`)
  }, [router, searchParams])

  return null
}
