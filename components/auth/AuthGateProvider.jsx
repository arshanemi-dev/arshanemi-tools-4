'use client'
import { useEffect, useState } from 'react'
import { onAuthRequired } from '@/lib/authGate'
import LoginRequiredModal from './LoginRequiredModal'

// Mounted once, high in the tree (app/layout.js), for every route in this
// app — subscribes to lib/authGate.js's pub-sub and renders the one shared
// "please log in" modal wherever a 401 happens to surface from.
export default function AuthGateProvider({ children }) {
  const [open, setOpen] = useState(false)

  useEffect(() => onAuthRequired(() => setOpen(true)), [])

  return (
    <>
      {children}
      <LoginRequiredModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
