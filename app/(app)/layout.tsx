'use client'
/**
 * app/(app)/layout.tsx
 *
 * Shared layout for every authenticated page.
 * By living here, RequireAuth + AppLayout stay mounted across
 * page navigations — only the page content swaps, so the sidebar and
 * header toolbar never re-render/flash.
 */
import RequireAuth from '@/components/RequireAuth'
import AppLayout from '@/components/AppLayout'

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppLayout>{children}</AppLayout>
    </RequireAuth>
  )
}
