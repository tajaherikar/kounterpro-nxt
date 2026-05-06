'use client'
/**
 * app/forgot-password/page.tsx
 *
 * Forgot password page — initiate password recovery
 */
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const toast = useToast()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) {
      toast.error('Please enter email or mobile number')
      return
    }

    setLoading(true)
    try {
      // Supabase password recovery
      const { error } = await supabase.auth.resetPasswordForEmail(input, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        toast.error(error.message || 'Failed to send reset link')
        return
      }

      setSubmitted(true)
      toast.success('Recovery link sent to your email!')
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-body">
      <div className="login-container">
        <div className="login-box">
          <div className="logo-placeholder" style={{ marginBottom: 20 }}>
            <span className="material-icons" style={{ fontSize: 48, color: 'var(--primary-blue, #2845D6)' }}>
              lock_reset
            </span>
          </div>

          <h1 style={{ color: '#0D1A63', marginBottom: 8, fontSize: 24 }}>
            Reset Password
          </h1>
          <p
            className="subtitle"
            style={{ color: 'var(--text-secondary, #666)', fontSize: 13, marginBottom: 30 }}
          >
            Enter your email to receive a recovery link
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="Enter your registered email"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                />
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
                    Sending...
                  </>
                ) : (
                  <>
                    <span className="material-icons">mail</span>
                    Send Recovery Link
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <Link href="/login" style={{ color: 'var(--primary-blue, #2845D6)', fontSize: 13, textDecoration: 'none' }}>
                  Back to Login
                </Link>
              </div>
            </form>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  background: '#d1fae5',
                  color: '#065f46',
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span className="material-icons">check_circle</span>
                <div style={{ textAlign: 'left' }}>
                  <strong>Check your email!</strong>
                  <p style={{ margin: 4, fontSize: 12 }}>
                    We sent a password reset link to {input}
                  </p>
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary, #666)', fontSize: 13, marginBottom: 20 }}>
                The link will expire in 24 hours. If you don't see the email, check your spam folder.
              </p>

              <button
                onClick={() => setSubmitted(false)}
                style={{
                  background: 'var(--border-color, #e0e4f8)',
                  color: 'var(--text-secondary, #666)',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  marginBottom: 12,
                }}
              >
                Try Another Email
              </button>

              <div style={{ textAlign: 'center' }}>
                <Link href="/login" style={{ color: 'var(--primary-blue, #2845D6)', fontSize: 13, textDecoration: 'none' }}>
                  Back to Login
                </Link>
              </div>
            </div>
          )}

          <div className="login-footer" style={{ marginTop: 30 }}>
            <small className="app-version">© 2026 KounterPro</small>
          </div>
        </div>
      </div>
    </div>
  )
}
