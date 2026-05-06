'use client'
/**
 * app/reset-password/page.tsx
 *
 * Reset password page — set new password with token
 */
import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tokenValid, setTokenValid] = useState(true)

  useEffect(() => {
    // Check if token exists in URL
    const token = searchParams.get('token')
    if (!token) {
      setTokenValid(false)
      toast.error('Invalid or missing reset token')
    }
  }, [searchParams, toast])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!password || !confirmPassword) {
      toast.error('Please fill in all fields')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        toast.error(error.message || 'Failed to reset password')
        return
      }

      toast.success('Password reset successfully!')
      setTimeout(() => {
        router.push('/login')
      }, 1500)
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  if (!tokenValid) {
    return (
      <div className="login-body">
        <div className="login-container">
          <div className="login-box">
            <div style={{ textAlign: 'center', padding: 40 }}>
              <span className="material-icons" style={{ fontSize: 48, color: '#dc3545', marginBottom: 16 }}>
                error_outline
              </span>
              <h2 style={{ color: '#0D1A63', marginBottom: 12 }}>Invalid Reset Link</h2>
              <p style={{ color: 'var(--text-secondary, #666)', marginBottom: 24 }}>
                This password reset link is invalid or has expired.
              </p>
              <Link
                href="/forgot-password"
                style={{
                  background: 'var(--primary-blue, #2845D6)',
                  color: '#fff',
                  padding: '10px 24px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontWeight: 600,
                  display: 'inline-block',
                  marginBottom: 12,
                }}
              >
                Request New Link
              </Link>
              <div style={{ marginTop: 12 }}>
                <Link href="/login" style={{ color: 'var(--primary-blue, #2845D6)', fontSize: 13, textDecoration: 'none' }}>
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-body">
      <div className="login-container">
        <div className="login-box">
          <div className="logo-placeholder" style={{ marginBottom: 20 }}>
            <span className="material-icons" style={{ fontSize: 48, color: '#28a745' }}>
              verified_user
            </span>
          </div>

          <h1 style={{ color: '#0D1A63', marginBottom: 8, fontSize: 24 }}>
            Set New Password
          </h1>
          <p className="subtitle" style={{ color: 'var(--text-secondary, #666)', fontSize: 13, marginBottom: 30 }}>
            Enter a strong password for your account
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-form-group">
              <label htmlFor="password">New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                />
                <span
                  className="password-toggle-icon material-icons"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ cursor: 'pointer' }}
                >
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </div>
            </div>

            <div className="login-form-group">
              <label htmlFor="confirm">Confirm Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirm"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <span
                  className="password-toggle-icon material-icons"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ cursor: 'pointer' }}
                >
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted, #999)', marginBottom: 20 }}>
              ✓ At least 8 characters
              <br />✓ Mix of letters and numbers
              <br />✓ Memorable but secure
            </div>

            <button
              type="submit"
              className="btn-login"
              disabled={loading}
              style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? (
                <>
                  <span className="material-icons">schedule</span>
                  Resetting...
                </>
              ) : (
                <>
                  <span className="material-icons">check</span>
                  Reset Password
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Link href="/login" style={{ color: 'var(--primary-blue, #2845D6)', fontSize: 13, textDecoration: 'none' }}>
                Back to Login
              </Link>
            </div>
          </form>

          <div className="login-footer" style={{ marginTop: 30 }}>
            <small className="app-version">© 2026 KounterPro</small>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
