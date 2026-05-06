'use client'
/**
 * components/Toast.tsx
 *
 * Lightweight toast system — replaces the toast.js global.
 *
 * Usage:
 *   import { useToast, ToastContainer } from '@/components/Toast'
 *
 *   // 1 — put <ToastContainer /> once in your layout (already in providers.tsx)
 *   // 2 — call hooks anywhere inside the tree:
 *   const toast = useToast()
 *   toast.success('Invoice saved!')
 *   toast.error('Something went wrong')
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
} from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

type Action =
  | { type: 'ADD'; item: ToastItem }
  | { type: 'REMOVE'; id: number }

function reducer(state: ToastItem[], action: Action): ToastItem[] {
  switch (action.type) {
    case 'ADD':    return [...state, action.item]
    case 'REMOVE': return state.filter((t) => t.id !== action.id)
    default:       return state
  }
}

let _nextId = 0

// ── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<{
  show: (message: string, type?: ToastType, duration?: number) => void
} | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, [])

  const show = useCallback(
    (message: string, type: ToastType = 'info', duration = 3500) => {
      const id = ++_nextId
      dispatch({ type: 'ADD', item: { id, message, type } })
      setTimeout(() => dispatch({ type: 'REMOVE', id }), duration)
    },
    []
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* Toast container rendered here so it's always in the tree */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="alert">
            <span className="material-icons toast-icon">
              {t.type === 'success' ? 'check_circle'
               : t.type === 'error'   ? 'error'
               : t.type === 'warning' ? 'warning'
               : 'info'}
            </span>
            <span className="toast-message">{t.message}</span>
            <button
              className="toast-close"
              onClick={() => dispatch({ type: 'REMOVE', id: t.id })}
              aria-label="Close notification"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')

  return {
    show:    ctx.show,
    success: (msg: string) => ctx.show(msg, 'success'),
    error:   (msg: string) => ctx.show(msg, 'error'),
    warning: (msg: string) => ctx.show(msg, 'warning'),
    info:    (msg: string) => ctx.show(msg, 'info'),
  }
}
