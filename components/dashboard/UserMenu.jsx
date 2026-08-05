'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User as UserIcon, LogOut } from 'lucide-react';
import { clearAuthTokens } from '@/lib/tokenStore';

// variant="compact" renders an icon-only circular trigger (for the bottom-
// right floating menu) instead of the avatar+name+role chip used in the top
// header. dropUp opens the dropdown above the trigger instead of below it —
// needed when the trigger sits near the bottom of the viewport.
export default function UserMenu({ user, onLogout, variant = 'header', dropUp = false }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clearAuthTokens();
      setOpen(false);
      onLogout?.();
      // Hard redirect (not router.push) so every server component re-renders
      // logged-out — client-side nav would leave stale authed state cached.
      window.location.href = '/login';
    }
  }

  
function roleLabel(role) {
  if (!role) return 'Member';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open profile menu"
          aria-expanded={open}
          title="Profile"
          className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-colors ${
            open
              ? 'border-accent bg-accent text-background'
              : 'border-divider bg-card text-muted hover:border-divider-light hover:bg-card-hover hover:text-foreground'
          }`}
        >
          <UserIcon size={18} />
        </button>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Open profile menu"
          aria-expanded={open}
          className="hidden items-center gap-2.5 border rounded-xl border-divider p-2 sm:flex"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-cyan text-xs font-bold text-background">
            {initial}
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">{user?.name}</p>
            <p className="text-[11px] text-subtle">{roleLabel(user?.role)}</p>
          </div>
        </button>
      )}

      {open && (
        <div className={`absolute right-0 w-64 bg-card border border-divider rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50 ${
          dropUp ? 'bottom-full mb-3' : 'top-full mt-3'
        }`}>
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-divider">
            <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name || 'Account'}</p>
              <p className="text-xs text-subtle truncate">{user?.email}</p>
            </div>
          </div>
          <div className="py-2">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:text-foreground hover:bg-card-hover transition-colors"
            >
              <UserIcon size={16} />
              Profile
            </Link>
            <button
              onClick={handleLogout}
              disabled={loading}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-muted hover:text-red-500 hover:bg-card-hover transition-colors disabled:opacity-60"
            >
              <LogOut size={16} />
              {loading ? 'Logging out…' : 'Logout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
