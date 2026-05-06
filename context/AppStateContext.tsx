'use client'
/**
 * context/AppStateContext.tsx
 *
 * App-wide UI state shared across layout and pages:
 *   - Privacy mode (hide financial values)
 *   - Dark mode (persisted to localStorage)
 *   - Active shop (persisted to localStorage, filters data queries)
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

interface AppStateValue {
  showPrivacy: boolean
  togglePrivacy: () => void
  setShowPrivacy: (v: boolean) => void
  isDark: boolean
  toggleDark: () => void
  activeShopId: string | null
  setActiveShopId: (id: string | null) => void
}

const AppStateContext = createContext<AppStateValue>({
  showPrivacy: false,
  togglePrivacy: () => {},
  setShowPrivacy: () => {},
  isDark: false,
  toggleDark: () => {},
  activeShopId: null,
  setActiveShopId: () => {},
})

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [activeShopId, setActiveShopIdState] = useState<string | null>(null)

  // Restore dark mode + active shop from localStorage on mount
  useEffect(() => {
    try {
      // Support both old key ('darkMode') and new key ('theme') for migration
      const savedTheme = localStorage.getItem('theme') ||
        (localStorage.getItem('darkMode') === 'enabled' ? 'dark' : 'light')
      if (savedTheme === 'dark') {
        setIsDark(true)
        document.documentElement.setAttribute('data-theme', 'dark')
      }
      const storedShopId = localStorage.getItem('activeShopId')
      if (storedShopId) setActiveShopIdState(storedShopId)
    } catch {}
  }, [])

  // Sync privacy mode body class
  useEffect(() => {
    document.body.classList.toggle('privacy-mode', showPrivacy)
  }, [showPrivacy])

  const togglePrivacy = useCallback(() => setShowPrivacy((v) => !v), [])
  const setPrivacy = useCallback((v: boolean) => setShowPrivacy(v), [])

  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev
      const html = document.documentElement
      // Disable transitions briefly so the switch is instant (no flash)
      html.setAttribute('data-theme-changing', '')
      html.setAttribute('data-theme', next ? 'dark' : 'light')
      setTimeout(() => html.removeAttribute('data-theme-changing'), 50)
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light')
      } catch {}
      return next
    })
  }, [])

  const setActiveShopId = useCallback((id: string | null) => {
    setActiveShopIdState(id)
    try {
      if (id) {
        localStorage.setItem('activeShopId', id)
      } else {
        localStorage.removeItem('activeShopId')
      }
    } catch {}
  }, [])

  return (
    <AppStateContext.Provider value={{ showPrivacy, togglePrivacy, setShowPrivacy: setPrivacy, isDark, toggleDark, activeShopId, setActiveShopId }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  return useContext(AppStateContext)
}
