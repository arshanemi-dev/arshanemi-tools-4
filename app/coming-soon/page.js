import { notFound } from 'next/navigation'
import { COMING_SOON } from '@/lib/comingSoon'
import ComingSoon from '@/components/coming-soon/ComingSoon'

export const metadata = {
  title: 'Coming Soon',
  description: 'Auto Listing by Barmeto is launching soon.',
}

// Reached through proxy.js, which shows this in place of every page while the
// gate is on (lib/comingSoon.js). Under `npm run dev`, this URL does not exist.
export default function ComingSoonPage() {
  if (!COMING_SOON) notFound()
  return <ComingSoon />
}
