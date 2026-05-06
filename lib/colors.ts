/**
 * lib/colors.ts
 * Color utilities for generating color schemes from a primary brand color
 */

interface ColorScheme {
  primary: string
  primaryLight: string
  primaryLighter: string
  primaryDark: string
  primaryDarker: string
  secondary: string
  accent: string
  border: string
  background: string
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 40, g: 69, b: 214 }
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = n.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/**
 * Lighten a hex color by percentage (0-100)
 */
export function lighten(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  const amount = Math.round((255 * percent) / 100)
  return rgbToHex(
    Math.min(255, rgb.r + amount),
    Math.min(255, rgb.g + amount),
    Math.min(255, rgb.b + amount)
  )
}

/**
 * Darken a hex color by percentage (0-100)
 */
export function darken(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  const amount = Math.round((255 * percent) / 100)
  return rgbToHex(
    Math.max(0, rgb.r - amount),
    Math.max(0, rgb.g - amount),
    Math.max(0, rgb.b - amount)
  )
}

/**
 * Get complementary color
 */
export function getComplementary(hex: string): string {
  const rgb = hexToRgb(hex)
  return rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b)
}

/**
 * Generate a complete color scheme from a primary color
 */
export function generateColorScheme(primary: string): ColorScheme {
  return {
    primary,
    primaryLight: lighten(primary, 20),
    primaryLighter: lighten(primary, 35),
    primaryDark: darken(primary, 15),
    primaryDarker: darken(primary, 30),
    secondary: getComplementary(primary),
    accent: lighten(primary, 10),
    border: lighten(primary, 55),
    background: lighten(primary, 90),
  }
}

/**
 * Apply color scheme to CSS variables
 */
export function applyCSSColorScheme(scheme: ColorScheme) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const primaryRgb = hexToRgb(scheme.primary)
  const secondaryRgb = hexToRgb(scheme.secondary)
  
  console.log('🎨 Applying color scheme:', {
    primary: scheme.primary,
    primaryRgb: `${primaryRgb.r} ${primaryRgb.g} ${primaryRgb.b}`,
    secondary: scheme.secondary,
  })
  
  root.style.setProperty('--primary', scheme.primary)
  root.style.setProperty('--primary-rgb', `${primaryRgb.r} ${primaryRgb.g} ${primaryRgb.b}`)
  root.style.setProperty('--primary-light', scheme.primaryLight)
  root.style.setProperty('--primary-lighter', scheme.primaryLighter)
  root.style.setProperty('--primary-dark', scheme.primaryDark)
  root.style.setProperty('--primary-darker', scheme.primaryDarker)
  root.style.setProperty('--secondary', scheme.secondary)
  root.style.setProperty('--secondary-rgb', `${secondaryRgb.r} ${secondaryRgb.g} ${secondaryRgb.b}`)
  root.style.setProperty('--accent', scheme.accent)
  root.style.setProperty('--border-color', scheme.border)
  root.style.setProperty('--bg', scheme.background)
  
  console.log('✅ CSS variables set on document.documentElement')
}

/**
 * Get stored color scheme from localStorage
 */
export function getStoredColorScheme(): ColorScheme | null {
  if (typeof localStorage === 'undefined') return null

  const stored = localStorage.getItem('kounterpro_color_scheme')
  return stored ? JSON.parse(stored) : null
}

/**
 * Save color scheme to localStorage
 */
export function saveColorScheme(scheme: ColorScheme) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem('kounterpro_color_scheme', JSON.stringify(scheme))
}
