'use client'

/**
 * components/DashboardLowerSection.tsx
 * 
 * Lazy-loaded bottom section of dashboard
 * Contains: Recent Invoices table, Activity Feed, Low Stock Alerts
 * Renders after the fold, so deferring it improves LCP (Largest Contentful Paint)
 */

import React from 'react'
import Link from 'next/link'

interface Invoice {
  id: string
  invoice_number: string
  customer_name: string
  total_amount: number
  date: string
  created_at: string
  payment_status?: string
  items?: string
}

interface Expense {
  id: string
  amount: number
  category?: string
  date: string
  created_at: string
}

interface InventoryItem {
  id: string
  name: string
  stock: number
  low_stock_threshold?: number
}

interface DashboardLowerSectionProps {
  invoices: Invoice[]
  expenses: Expense[]
  inventory: InventoryItem[]
  showPrivacy: boolean
  fmt: (amount: number) => string
}

export function DashboardLowerSection({
  invoices,
  expenses,
  inventory,
  showPrivacy,
  fmt,
}: DashboardLowerSectionProps) {
  // Activity feed
  const activityFeed = React.useMemo(() => {
    return [...invoices]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(inv => ({
        date: inv.created_at,
        data: {
          icon: 'receipt_long',
          text: `Invoice ${inv.invoice_number} – ${inv.customer_name || 'Customer'}`,
          amount: fmt(parseFloat(inv.total_amount?.toString() || '0')),
        },
      }))
  }, [invoices, fmt])

  const recentInvoices = React.useMemo(() => invoices.slice(0, 5), [invoices])
  
  const lowStockItems = React.useMemo(
    () => inventory.filter(
      item => parseFloat(item.stock?.toString() || '0') <= parseFloat(item.low_stock_threshold?.toString() || '10')
    ).slice(0, 5),
    [inventory]
  )

  return (
    <>
      {/* Low Stock Alerts - Moved to top for visibility */}
      {lowStockItems.length > 0 && (
        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%)',
          borderRadius: 12,
          borderLeft: '5px solid #dc2626',
          marginBottom: 24,
        }}>
          {/* Alert Header with Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span className="material-icons" style={{ fontSize: 24, color: '#dc2626' }}>inventory_2</span>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#7f1d1d' }}>Low Stock Alert</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#991b1b' }}>
                  {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need attention
                </p>
              </div>
            </div>
            <div style={{
              background: '#dc2626',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              minWidth: 40,
              textAlign: 'center',
            }}>
              {lowStockItems.length}
            </div>
          </div>

          {/* Low Stock Items Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}>
            {lowStockItems.map(item => {
              const stock = parseFloat(item.stock?.toString() || '0')
              const threshold = parseFloat(item.low_stock_threshold?.toString() || '10')
              const percentageOfThreshold = (stock / threshold) * 100
              const isCritical = stock === 0
              const isLow = stock > 0 && stock <= threshold * 0.5

              return (
                <div
                  key={item.id}
                  style={{
                    padding: 16,
                    background: '#fff',
                    borderRadius: 8,
                    border: `1px solid ${isCritical ? '#fecaca' : '#fca5a5'}`,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.15)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Item Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                    <div style={{
                      minWidth: 32,
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: isCritical ? '#fee2e2' : '#fef2f2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span className="material-icons" style={{
                        fontSize: 18,
                        color: isCritical ? '#dc2626' : '#f43f5e',
                      }}>
                        {isCritical ? 'error' : 'warning_amber'}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>{item.name}</div>
                      <div style={{
                        fontSize: 11,
                        color: isCritical ? '#dc2626' : '#f43f5e',
                        fontWeight: 600,
                        marginTop: 2,
                      }}>
                        {isCritical ? '⚠️ OUT OF STOCK' : '⚠️ LOW STOCK'}
                      </div>
                    </div>
                  </div>

                  {/* Stock Progress Bar */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Stock Level</span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: isCritical ? '#dc2626' : '#f43f5e',
                      }}>
                        {stock} / {threshold}
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: 6,
                      background: '#e2e8f0',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(percentageOfThreshold, 100)}%`,
                          background: isCritical ? '#dc2626' : isLow ? '#f43f5e' : '#fb923c',
                          borderRadius: 3,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <Link
                    href="/inventory"
                    style={{
                      display: 'inline-block',
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'center',
                      background: isCritical ? '#dc2626' : '#f43f5e',
                      color: '#fff',
                      borderRadius: 6,
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isCritical ? '#991b1b' : '#be185d'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isCritical ? '#dc2626' : '#f43f5e'
                    }}
                  >
                    {isCritical ? 'Reorder Now' : 'Reorder'}
                  </Link>
                </div>
              )
            })}
          </div>

          {/* View All Inventory Button */}
          <Link
            href="/inventory"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'transparent',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fee2e2'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>open_in_new</span>
            Manage All Inventory
          </Link>
        </div>
      )}

      {/* Recent Invoices + Activity Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Recent Invoices</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color, #eee)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Invoice</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Amount</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted, #999)' }}>
                      <p>No invoices yet</p>
                      <Link href="/create-bill" style={{ color: 'var(--primary-blue, #2845D6)', textDecoration: 'none', fontSize: 12 }}>
                        Create your first invoice →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  recentInvoices.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color, #eee)' }}>
                      <td style={{ padding: '10px 0', fontWeight: 500 }}>
                        <Link href="/invoices" style={{ color: 'var(--primary-blue, #2845D6)', textDecoration: 'none' }}>
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 0', color: 'var(--text-secondary, #64748b)' }}>{inv.customer_name || '—'}</td>
                      <td style={{ padding: '10px 0' }}>
                        {showPrivacy ? '••••' : fmt(parseFloat(inv.total_amount?.toString() || '0'))}
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: (inv.payment_status || '').toLowerCase() === 'paid' ? '#d1fae5' : '#fee2e2',
                          color: (inv.payment_status || '').toLowerCase() === 'paid' ? '#059669' : '#dc2626',
                        }}>
                          {inv.payment_status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Link
            href="/invoices"
            style={{
              display: 'inline-block', marginTop: 16, padding: '8px 16px',
              background: 'var(--primary-blue, #2845D6)', color: '#fff', borderRadius: 8,
              textDecoration: 'none', fontSize: 12, fontWeight: 600,
            }}
          >
            View all invoices →
          </Link>
        </div>

        {/* Activity Feed */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Activity Feed</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activityFeed.length === 0 ? (
              <p style={{ color: 'var(--text-muted, #999)', margin: 0 }}>No recent activity</p>
            ) : (
              activityFeed.map((entry, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, paddingBottom: 12, borderBottom: idx < activityFeed.length - 1 ? '1px solid var(--border-color, #eee)' : 'none' }}>
                  <div style={{ minWidth: 40, minHeight: 40, background: 'var(--bg-secondary, #f3f4f6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-icons" style={{ fontSize: 20, color: 'var(--text-secondary, #64748b)' }}>
                      {entry.data.icon}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #1f2937)' }}>{entry.data.text}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>
                      {new Date(entry.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary, #1f2937)' }}>
                    {entry.data.amount}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
