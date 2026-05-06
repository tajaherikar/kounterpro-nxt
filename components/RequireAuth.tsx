'use client'
/**
 * components/RequireAuth.tsx
 *
 * Wraps any page that requires authentication.
 * Shows a loading state while Supabase resolves the session,
 * then redirects to /login if no user is found.
 *
 * Usage (in any page component):
 *   export default function InventoryPage() {
 *     return (
 *       <RequireAuth>
 *         <AppLayout activePage="inventory">...</AppLayout>
 *       </RequireAuth>
 *     )
 *   }
 */
import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [loading, isAuthenticated, router])

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return <>{children}</>
}
