'use client';

import { LogOut } from 'lucide-react';
import { clearAuthTokens } from '@/lib/tokenStore';
import UserMenu from './UserMenu';

function IconBtn({ label, icon: Icon, active, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-colors ${
        active
          ? 'border-accent bg-accent text-background'
          : 'border-divider bg-card text-muted hover:border-divider-light hover:bg-card-hover hover:text-foreground'
      }`}
      {...props}
    >
      <Icon size={18} />
    </button>
  );
}

// Always-open, icon-only floating shortcuts — pinned bottom-right, above
// everything (z-[9999]). Order: Profile (opens the exact same dropdown menu
// as the top header's UserMenu, just anchored upward since it's near the
// bottom of the viewport), then Logout last.
export default function BottomMenu({ user }) {
  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clearAuthTokens();
      window.location.href = '/login';
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2.5">
      <UserMenu user={user} variant="compact" dropUp />
      <IconBtn label="Logout" icon={LogOut} onClick={handleLogout} />
    </div>
  );
}
