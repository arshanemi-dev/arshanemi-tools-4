'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isLoggedIn, getStoredUser, clearAuthTokens } from '@/lib/tokenStore'
import { ToastProvider } from '@/components/admin/Toast'
import DashboardTopbar from '@/components/dashboard/DashboardTopbar'
import BottomMenu from '@/components/dashboard/BottomMenu'
import ProfileContent from '@/components/profile/ProfileContent'

const HEADER_HIDDEN = process.env.NEXT_PUBLIC_IS_Header_Hide === 'true'
const BOTTOM_MENU_SHOWN = process.env.NEXT_PUBLIC_SHOW_FLOATING_MENU === 'true'

// The one profile page for every role — master_admin/admin/user all land
// here (there is no separate admin-shell copy anymore; the local admin
// panel at /settings was removed in favor of the hub admin panel).
export default function ProfilePage() {
  const router = useRouter()
  const [authStatus, setAuthStatus] = useState('checking') // checking | authed
  const [user, setUser] = useState(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }
    setUser(getStoredUser())
    setAuthStatus('authed')
  }, [router])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      clearAuthTokens()
      window.location.href = '/login'
    }
  }

  if (authStatus !== 'authed') {
    return <div className="min-h-screen bg-background" />
  }

  return (
    <div className="min-h-screen bg-background">
      {!HEADER_HIDDEN && <DashboardTopbar user={user} onLogout={handleLogout} loggingOut={loggingOut} />}
      {BOTTOM_MENU_SHOWN && <BottomMenu user={user} />}
      <main>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
          <ToastProvider>
            <ProfileContent />
          </ToastProvider>
        </div>
      </main>
    </div>
  )
}
