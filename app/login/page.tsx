'use client'
/**
 * app/login/page.tsx
 *
 * Login page — ported from login.html + auth.js
 * Supports both email and 10-digit mobile number login.
 */
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const { signIn, isAuthenticated, loading } = useAuth()
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shake, setShake] = useState(false)

  // Redirect already-authenticated users
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/')
    }
  }, [loading, isAuthenticated, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSubmitting(true)

    const input = username.trim()
    const isMobile = /^[0-9]{10}$/.test(input)
    let emailToUse = input

    // Mobile login: look up email from user_profiles
    if (isMobile) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('mobile', input)
        .single()

      if (error || !data?.email) {
        setErrorMsg('Mobile number not found. Please check and try again.')
        trigger()
        return
      }
      emailToUse = data.email
    }

    const { error } = await signIn(emailToUse, password)

    if (!error) {
      router.replace('/')
    } else {
      setErrorMsg('Invalid mobile/email or password')
      setPassword('')
      trigger()
    }
  }

  function trigger() {
    setSubmitting(false)
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  if (loading) return null  // waiting for initial session check

  return (
    <div className="login-body">
      <div className="login-container">
        <div className={`login-box${shake ? ' shake' : ''}`}>
          <div className="logo-placeholder">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/kounter-pro-logo-sm.png" alt="KounterPro" style={{ width: 100 }} />
          </div>

          <h1 style={{ color: '#0D1A63', marginBottom: 0 }}>
            Kounter<span style={{ color: '#F68048' }}>Pro</span>
          </h1>
          <p className="subtitle" style={{ color: '#666', fontSize: 13, marginBottom: 30 }}>
            Dukaan ka Digital Manager
          </p>

          <form id="loginForm" className="login-form" onSubmit={handleSubmit}>
            <div className="login-form-group">
              <label htmlFor="username">Mobile Number or Email</label>
              <input
                type="text"
                id="username"
                name="username"
                placeholder="Enter mobile number or email"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="login-form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="Enter password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span
                  className="password-toggle-icon material-icons"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ cursor: 'pointer' }}
                >
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </div>
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Link
                  href="/forgot-password"
                  style={{ color: '#2845D6', fontSize: 13, textDecoration: 'none' }}
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            {errorMsg && (
              <div id="errorMessage" className="error-message" style={{ display: 'block' }}>
                {errorMsg}
              </div>
            )}

            <button type="submit" className="btn-login" disabled={submitting}>
              <span className="material-icons">login</span>{' '}
              {submitting ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <div className="login-footer" style={{ marginTop: 20 }}>
            <p style={{ marginBottom: 10 }}>
              Don&apos;t have an account?{' '}
              <Link
                href="/signup"
                style={{ color: '#2845D6', fontWeight: 600, textDecoration: 'none' }}
              >
                Sign Up
              </Link>
            </p>
            <small className="app-version">Version 2.4.0 | © 2026 KounterPro</small>
          </div>
        </div>
      </div>
    </div>
  )
}
