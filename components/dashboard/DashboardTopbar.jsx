'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Menu } from 'lucide-react';
import UserMenu from './UserMenu';
import { redirectToLogin } from '@/lib/authGate';

// One shared navbar for every route in this app (Listing Tools shell +
// /profile) — logo, the current tool's name (this app is single-product, so
// the center nav only ever needs to say what you're in, not link out to
// every other tool on the hub), and login/account on the right.
export default function DashboardTopbar({ user, onLogout, onMenuClick }) {
  return (
    <header className="sticky top-0 z-50 flex-shrink-0 bg-footer border-b border-white/10">
      <div className="w-full px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3 sm:gap-6 py-3">
          {/* Hamburger — opens the nav drawer on mobile; only rendered when a
              shell passes a handler (the sidebar-less /profile route doesn't). */}
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open menu"
              className="lg:hidden shrink-0 -ml-1 flex items-center justify-center w-9 h-9 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Menu size={20} />
            </button>
          )}

          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/images/barmeto-logo.png"
              alt="Barmeto"
              width={132}
              height={40}
              className="h-9 w-auto rounded-lg"
              priority
            />
          </Link>

          {/* Current tool */}
          <div className="flex-1 flex items-center justify-center min-w-0">
            <span className="text-sm font-semibold text-white whitespace-nowrap">
              Auto listing
            </span>
          </div>

          {/* Login/Profile */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <UserMenu user={user} onLogout={onLogout} />
            ) : (
              // A plain <button> rather than a <Link href="/login"> — the
              // real destination (this app's own /login, or the hub's, in
              // connected mode) is only knowable client-side, and computing
              // that into a static href would make the server- and
              // client-rendered markup disagree. See lib/authGate.js.
              <button
                type="button"
                onClick={redirectToLogin}
                className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-white text-accent text-sm font-semibold hover:bg-white/90 transition-colors whitespace-nowrap"
              >
                Log in
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
