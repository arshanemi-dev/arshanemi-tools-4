import Link from 'next/link'
import { ShieldOff } from 'lucide-react'

export default function AdminNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
          <ShieldOff className="w-7 h-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">404 — Page not found</h1>
        <p className="text-sm text-subtle mb-8">
          Either this page doesn&apos;t exist, or your account doesn&apos;t have access to it.
        </p>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
        >
          Back to your dashboard
        </Link>
      </div>
    </div>
  )
}
