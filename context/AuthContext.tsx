'use client'
/**
 * context/AuthContext.tsx
 *
 * App-wide authentication state.
 * Replaces the scattered auth.js globals (authCheckComplete, isUserAuthenticated).
 * Wraps the entire app in providers/layout.tsx.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  session: Session | null
  /** true while the first auth check is in-flight */
  loading: boolean
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    businessName: string,
    mobile: string
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** true when user is confirmed authenticated */
  isAuthenticated: boolean
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })

  // Subscribe to auth changes once — replaces polling
  useEffect(() => {
    async function loadInitialSession() {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.warn('Supabase auth session load error:', error.message)
        await supabase.auth.signOut()
      }
      setState({ user: data?.session?.user ?? null, session: data?.session ?? null, loading: false })
    }

    loadInitialSession()

    // Listen for subsequent changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, session, loading: false })
    })

    return () => subscription.unsubscribe()
  }, [])

  // ─── Auth actions ────────────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, businessName: string, mobile: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { business_name: businessName, mobile },
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      })

      if (error) return { error: error.message }

      // Create user profile record
      if (data.user) {
        const { error: profileError } = await supabase.from('user_profiles').insert([
          { id: data.user.id, business_name: businessName, mobile },
        ])
        if (profileError) {
          // Non-fatal: profile can be re-created on first login
          console.warn('Profile creation failed:', profileError.message)
        }
      }

      return { error: null }
    },
    []
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signUp,
        signOut,
        isAuthenticated: !!state.user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
