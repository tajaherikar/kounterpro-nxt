'use client'
/**
 * components/AppLayout.tsx
 *
 * Wraps every authenticated page with:
 *   - Offline banner
 *   - Sidebar
 *   - Top header: shop switcher, dark-mode toggle, notification bell, welcome pill
 *   - main-content container
 */
import React, { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from './Sidebar'
import type { NavPage } from './Sidebar'
import { useAppState } from '@/context/AppStateContext'
import { useShops, useUserProfile } from '@/hooks/useAPI'
import { generateColorScheme, applyCSSColorScheme, saveColorScheme } from '@/lib/colors'

// Re-export so pages only need one import
export type { NavPage }

/** Auto-derive a human-readable page title from the current pathname */
const PAGE_TITLES: Record<string, string> = {
  '/':                 'Dashboard',
  '/inventory':        'Inventory',
  '/customers':        'Customers',
  '/customer-ledger':  'Customer Ledger',
  '/create-invoice':   'Create Invoice',
  '/create-bill':      'Create Invoice',
  '/quick-bill':       'Create Invoice',
  '/invoices':         'Invoices',
  '/quotations':       'Quotations',
  '/create-quotation': 'Create Quotation',
  '/expenses':         'Expenses',
  '/reports':          'Reports',
  '/profile':          'Business Profile',
  '/suppliers':        'Suppliers',
  '/purchases':        'Purchases',
}

/** Page description subtitles (shown under the page title) */
const PAGE_SUBTITLES: Record<string, string> = {
  '/':                 "Welcome back! Here's your business overview",
  '/inventory':        'Manage your products and stock levels',
  '/customers':        'Manage your customer database',
  '/customer-ledger':  'View payment history and details',
  '/create-invoice':   'Create invoices with full details or quick bills for walk-in customers',
  '/create-bill':      'Fill in the details to generate a new invoice',
  '/quick-bill':       'Fast invoice for walk-in customers — no customer details required',
  '/invoices':         'Create and manage all your invoices',
  '/quotations':       'Create and manage quotations for your clients',
  '/create-quotation': 'Fill in the details to generate a quotation for your client',
  '/expenses':         'Track and manage your business expenses',
  '/reports':          'Analyze sales trends, top products, and customer insights',
  '/profile':          'This information will appear on your invoices and documents',
  '/suppliers':        'Manage your supplier directory',
  '/purchases':        'Record purchase entries and update inventory',
}

interface AppLayoutProps {
  children: React.ReactNode
  activePage?: NavPage
  pageTitle?: string
  pageSubtitle?: string
  mobileTitle?: string
  /** Extra buttons placed in the header-right, alongside the built-in controls */
  headerRight?: React.ReactNode
}

export default function AppLayout({
  children,
  activePage,
  pageTitle,
  pageSubtitle,
  mobileTitle,
  headerRight,
}: AppLayoutProps) {
  const pathname = usePathname()
  const [isOnline, setIsOnline] = useState(true)
  const { data: profile } = useUserProfile()

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Apply brand color when profile loads
  useEffect(() => {
    if (profile?.brand_color) {
      const scheme = generateColorScheme(profile.brand_color)
      applyCSSColorScheme(scheme)
      saveColorScheme(scheme)
    }
  }, [profile?.brand_color])

  const derivedTitle    = pageTitle    ?? PAGE_TITLES[pathname]    ?? 'KounterPro'
  const derivedSubtitle = pageSubtitle ?? PAGE_SUBTITLES[pathname] ?? ''
  const businessName    = profile?.business_name

  return (
    <div className="modern-layout">
      {/* Offline banner */}
      {!isOnline && (
        <div className="offline-indicator" id="offlineIndicator">
          You are offline — Changes will sync when online
        </div>
      )}

      <Sidebar activePage={activePage} mobileTitle={mobileTitle ?? derivedTitle} />

      <div className="main-content">
        <header className="top-header">
          <div className="header-left">
            <h1 className="page-title">{derivedTitle}</h1>
            {derivedSubtitle && (
              <p className="page-subtitle" style={{ margin: 0 }}>{derivedSubtitle}</p>
            )}
          </div>
          <div className="header-right">
            {/* Shop switcher */}
            <ShopSwitcher />
            {/* Dark-mode toggle */}
            <DarkModeToggle />
            {/* Notification bell */}
            <NotificationBell />
            {/* Welcome / profile pill */}
            <UserProfilePill businessName={businessName} />
            {/* Page-specific extra buttons */}
            {headerRight}
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}

// ─── Dark-mode toggle ────────────────────────────────────────────────────────
export function DarkModeToggle({ mobile }: { mobile?: boolean }) {
  const { isDark, toggleDark } = useAppState()
  return (
    <button
      className={mobile ? 'mobile-dark-mode-toggle' : 'dark-mode-toggle'}
      onClick={toggleDark}
      title="Toggle dark mode"
    >
      <span className="material-icons">{isDark ? 'light_mode' : 'dark_mode'}</span>
    </button>
  )
}

// ─── Notification bell ────────────────────────────────────────────────────────
function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="notification-btn"
        onClick={() => setOpen(v => !v)}
        title="Notifications"
      >
        <span className="material-icons">notifications</span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div
          className="notification-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            display: 'flex',
          }}
        >
          <div className="notification-header">
            <h3>Notifications</h3>
            <button className="btn-text">Mark all as read</button>
          </div>
          <div className="notification-list">
            <div className="notification-empty">
              <span className="material-icons">notifications_none</span>
              <p>No notifications</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── User Profile Pill ────────────────────────────────────────────────────────
function UserProfilePill({ businessName }: { businessName?: string }) {
  const router = useRouter()
  const displayName = businessName ?? 'KounterPro'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <button
      className="user-profile-pill"
      onClick={() => router.push('/profile')}
      title="Go to profile"
    >
      <span className="user-profile-label">Welcome, {displayName}</span>
      <span className="user-profile-avatar">{initial}</span>
    </button>
  )
}

// ─── Shop switcher ───────────────────────────────────────────────────────────
function ShopSwitcher() {
  const { activeShopId, setActiveShopId } = useAppState()
  const { data: shops = [] } = useShops()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Auto-select the default shop (or first shop) when shops load and none is active
  useEffect(() => {
    if (shops.length > 0 && !activeShopId) {
      const defaultShop = shops.find(s => s.is_default) ?? shops[0]
      setActiveShopId(defaultShop.id)
    }
  }, [shops, activeShopId, setActiveShopId])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (shops.length === 0) return null

  const activeShop = shops.find(s => s.id === activeShopId) ?? shops[0]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="shop-switcher"
        onClick={() => setOpen(v => !v)}
        title={`Switch shop (${activeShop.shop_name})`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: 'auto',
          minWidth: 120,
          height: 40,
          borderRadius: 6,
          border: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-card, #fff)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          paddingInline: 10,
          color: 'var(--text-primary, #1e293b)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover, #f8fafc)'
          e.currentTarget.style.borderColor = 'var(--border-color, #cbd5e1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--bg-card, #fff)'
          e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)'
        }}
      >
        <span className="material-icons" style={{ fontSize: 18, flexShrink: 0 }}>storefront</span>
        <span style={{ fontSize: 13, flexShrink: 0 }}>{activeShop.shop_name}</span>
        <span className="material-icons" style={{ fontSize: 16, flexShrink: 0 }}>expand_more</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,.15)',
          minWidth: 220,
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Dropdown header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--text-secondary, #64748b)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Switch Shop
            </span>
          </div>

          {/* Shop list with radio indicators */}
          {shops.map(shop => {
            const isActive = shop.id === activeShopId
            return (
              <button
                key={shop.id}
                onClick={() => { setActiveShopId(shop.id); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px',
                  background: isActive ? 'rgba(40,69,214,0.05)' : 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--border-color, #e2e8f0)',
                  cursor: 'pointer',
                  color: isActive ? 'var(--primary-blue, #2845D6)' : 'var(--text-primary, #1e293b)',
                  fontSize: 14, textAlign: 'left',
                }}
              >
                <span className="material-icons" style={{ fontSize: 18, flexShrink: 0 }}>
                  {isActive ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
                <span style={{ flex: 1, fontWeight: isActive ? 600 : 400 }}>
                  {shop.shop_name}
                </span>
                {shop.is_default && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px',
                    background: 'rgba(40,69,214,0.1)',
                    color: 'var(--primary-blue, #2845D6)',
                    borderRadius: 20, flexShrink: 0,
                  }}>
                    Default
                  </span>
                )}
              </button>
            )
          })}

          {/* Manage Shops link */}
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px',
              color: 'var(--primary-blue, #2845D6)',
              fontSize: 14, fontWeight: 500, textDecoration: 'none',
            }}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>settings</span>
            Manage Shops
          </Link>
        </div>
      )}
    </div>
  )
}
