'use client'
/**
 * components/Sidebar.tsx
 *
 * The one sidebar used across every authenticated page.
 * Replaces the duplicated sidebar HTML in all 15 pages.
 */
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { DarkModeToggle } from '@/components/AppLayout'

export type NavPage =
  | 'dashboard'
  | 'create-invoice'
  | 'quotations'
  | 'inventory'
  | 'suppliers'
  | 'customers'
  | 'customer-ledger'
  | 'expenses'
  | 'reports'
  | 'profile'

interface SidebarProps {
  /** Pass the current page so the correct nav item is highlighted */
  activePage?: NavPage
  mobileTitle?: string
}

function NavLink({
  href,
  icon,
  label,
  active,
  sub,
}: {
  href: string
  icon: string
  label: string
  active?: boolean
  sub?: boolean
}) {
  const pathname = usePathname()
  // Auto-detect active if not explicitly provided
  const isActive = active ?? (href === '/' ? pathname === '/' : pathname.startsWith(href))
  return (
    <Link
      href={href}
      className={`nav-item${sub ? ' nav-sub-item' : ''}${isActive ? ' active' : ''}`}
      title={label}
    >
      <span className="material-icons">{icon}</span>
      <span className="nav-text">{label}</span>
    </Link>
  )
}

export default function Sidebar({ activePage, mobileTitle = 'KounterPro' }: SidebarProps) {
  const { signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  function toggleSidebar() {
    setSidebarOpen((v) => !v)
  }

  return (
    <>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`sidebar${sidebarOpen ? ' show' : ''}`} id="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="material-icons logo-icon">store</span>
            <span className="logo-text">KounterPro</span>
          </div>
          <button
            className="sidebar-toggle"
            id="sidebarToggle"
            title="Toggle Sidebar"
            onClick={toggleSidebar}
          >
            <span className="material-icons">menu</span>
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink href="/" icon="dashboard" label="Dashboard" />
          <NavLink href="/create-invoice" icon="add_circle_outline" label="Create Invoice" />
          <NavLink href="/quotations" icon="request_quote" label="Quotations" />
          <NavLink href="/inventory" icon="inventory_2" label="Inventory" />
          <NavLink href="/suppliers" icon="local_shipping" label="Suppliers" />
          <NavLink href="/customers" icon="people" label="Customers" />
          <NavLink href="/expenses" icon="receipt" label="Expenses" />
          <NavLink href="/reports" icon="bar_chart" label="Reports" />
          <NavLink href="/profile" icon="business" label="Profile" />

          <div className="nav-divider" />

          <button className="nav-item" onClick={handleLogout} title="Logout" style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span className="material-icons">logout</span>
            <span className="nav-text">Logout</span>
          </button>
        </nav>

        <div className="app-version sidebar-version">
          Version 2.4.0 | © 2026 KounterPro
        </div>
      </aside>

      {/* ── Overlay (mobile) ─────────────────────────────────────────────── */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' show' : ''}`}
        id="sidebarOverlay"
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Mobile Header ────────────────────────────────────────────────── */}
      <div className="mobile-header">
        <div className="mobile-header-left">
          <button className="mobile-menu-btn" id="mobileMenuBtn" onClick={toggleSidebar}>
            <span className="material-icons">menu</span>
          </button>
        </div>
        <h1 className="mobile-header-title">{mobileTitle}</h1>
        <div className="mobile-header-right">
          <DarkModeToggle mobile />
        </div>
      </div>
    </>
  )
}


