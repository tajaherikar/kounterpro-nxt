'use client'
/**
 * hooks/useColorScheme.ts
 * 
 * Initializes color scheme from localStorage on app startup
 * Ensures sidebar and other UI elements get themed colors immediately
 */

import { useEffect } from 'react'
import { getStoredColorScheme, applyCSSColorScheme, generateColorScheme } from '@/lib/colors'

export function useColorSchemeInit() {
  useEffect(() => {
    // Load color scheme from localStorage on mount
    const storedScheme = getStoredColorScheme()
    
    if (storedScheme) {
      console.log('🎨 [INIT] Restoring color scheme from localStorage:', storedScheme.primary)
      applyCSSColorScheme(storedScheme)
    } else {
      // Apply default blue color scheme
      console.log('🎨 [INIT] Using default blue color scheme #2845D6')
      const defaultScheme = generateColorScheme('#2845D6')
      applyCSSColorScheme(defaultScheme)
    }
    
    // Verify CSS variables were applied
    const primary = document.documentElement.style.getPropertyValue('--primary')
    const primaryRgb = document.documentElement.style.getPropertyValue('--primary-rgb')
    console.log('✅ [INIT] CSS Variables set:', { primary: primary.trim(), primaryRgb: primaryRgb.trim() })
  }, [])
}

