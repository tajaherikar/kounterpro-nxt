'use client'
/**
 * app/providers.tsx
 *
 * Client-side providers tree — keeps app/layout.tsx a Server Component.
 * Add new providers here; pages never need to know about them.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { AppStateProvider } from '@/context/AppStateContext'
import { ToastProvider } from '@/components/Toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min — reduces refetch chatter
      retry: 1,
    },
  },
})

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppStateProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AppStateProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
