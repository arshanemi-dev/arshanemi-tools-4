'use client';

import Link from 'next/link';
import UserMenu from './UserMenu';

export default function DashboardTopbar({ user, onLogout }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-divider bg-background/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-cyan text-sm">
            ⚡
          </span>
          Arshanemi<span className="gradient-text">Tools</span>
        </a>

        <div className="flex items-center gap-3">
          {user ? (
            <UserMenu user={user} onLogout={onLogout} />
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center rounded-full border border-divider px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-divider-light"
              >
                Login
              </Link>
              <Link
                href="/contact"
                className="hidden sm:inline-flex items-center rounded-full bg-gradient-to-r from-accent to-cyan px-4 py-2 text-sm font-semibold text-background transition-shadow hover:shadow-lg hover:shadow-accent/30"
              >
                Get Free Audit
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
