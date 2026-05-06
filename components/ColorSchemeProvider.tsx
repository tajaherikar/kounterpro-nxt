'use client'
/**
 * components/ColorSchemeProvider.tsx
 *
 * Initializes color scheme on app startup
 * Ensures sidebar and other UI elements are themed immediately
 */

import React from 'react'
import { useColorSchemeInit } from '@/hooks/useColorScheme'

export function ColorSchemeInitializer() {
  useColorSchemeInit()
  return null
}

export default function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ColorSchemeInitializer />
      {children}
    </>
  )
}
