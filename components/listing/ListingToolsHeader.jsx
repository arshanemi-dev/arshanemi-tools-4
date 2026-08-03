'use client'
import Link from 'next/link'
import { Layers, Settings, LogOut } from 'lucide-react'
import { clearAuthTokens } from '@/lib/tokenStore'

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } finally {
    clearAuthTokens()
    // Hard redirect (not router.push) so every server component re-renders
    // logged-out — same convention as components/dashboard/UserMenu.jsx.
    window.location.href = '/login'
  }
}

// Top bar for the Listing Tools shell, mirroring tools/arshanemi-tools-1's
// Header.jsx (brand mark left, nav + account controls right) — this app's
// /listing-tools shell previously had no header at all, only
// ListingToolsSidebar's left-hand nav. Styled on the same hardcoded light
// palette as the rest of /listing-tools rather than components/dashboard/
// UserMenu's dark theme-token system, which ListingToolsSidebar's own
// comment already calls out as intentionally separate from this shell.
export default function ListingToolsHeader({ name, email, role }) {
  const initial = (name || email || '?').trim().charAt(0).toUpperCase()

  return (
    <header className="h-14 flex-shrink-0 flex items-center border-b border-gray-200 bg-white px-5 gap-2">
      <Link href="/listing-tools" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
          <Layers size={16} />
        </div>
        <span className="text-sm font-bold tracking-tight text-gray-800">
          Arshanemi <span className="text-indigo-600">Listing Tools</span>
        </span>
      </Link>

      <div className="flex-1" />

      {role !== 'user' && (
        <Link
          href="/settings"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <Settings size={14} />
          <span className="hidden sm:inline">Settings</span>
        </Link>
      )}

      <div className="flex items-center gap-2 pl-2 ml-1 border-l border-gray-200">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
            {initial}
          </div>
          <span className="text-xs font-medium text-gray-700 hidden sm:block max-w-[120px] truncate">
            {name || email}
          </span>
        </div>
        <button
          onClick={handleLogout}
          title="Logout"
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}
