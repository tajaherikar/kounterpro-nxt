'use client'
/**
 * app/page.tsx  →  /  (Dashboard)
 *
 * Authenticated root page with financial dashboard
 * Features:
 *   - Financial summary cards (today's sales, trend, total invoices)
 *   - Sales trend chart (30 days)
 *   - Sales vs Expenses comparison
 *   - Recent invoices table
 *   - Activity feed
 *   - Low stock alert
 */
import React, { useState, useMemo, useEffect, lazy, Suspense, useDeferredValue, useTransition } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useAppState } from '@/context/AppStateContext'
import { supabase } from '@/lib/supabase'
import { formatINR } from '@/lib/currency'
import Link from 'next/link'

// Lazy-load charts to prevent Recharts from loading on non-dashboard pages
// Saves ~1.7MB on initial bundle for all other routes
const DashboardCharts = lazy(() => import('@/components/DashboardCharts').then(m => ({ default: m.ChartsGrid })))

// Lazy-load lower section (recent invoices, activity feed, low stock alerts)
// Defers non-critical rendering below the fold to improve LCP (Largest Contentful Paint)
const DashboardLowerSection = lazy(() => import('@/components/DashboardLowerSection').then(m => ({ default: m.DashboardLowerSection })))

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

interface StatCard {
  label: string
  value: string
  icon: string
  trend?: { value: number; isPositive: boolean }
  color: string
}

export default function DashboardPage() {
  return <DashboardContent />
}

function DashboardContent() {
  const { user } = useAuth()
  const { showPrivacy, activeShopId } = useAppState()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isPending, startTransition] = useTransition()

  // Period filter state
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showCustomRange, setShowCustomRange] = useState(false)
  const [appliedCustomStart, setAppliedCustomStart] = useState('')
  const [appliedCustomEnd, setAppliedCustomEnd] = useState('')

  // Reload whenever the active shop changes
  useEffect(() => {
    if (!user) return
    loadDashboardData()
  }, [user, activeShopId])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      const shopFilter = activeShopId
        ? `shop_id.eq.${activeShopId},shop_id.is.null`
        : undefined

      let invoicesQuery = supabase.from('invoices').select('*').order('created_at', { ascending: false })
      let expensesQuery = supabase.from('expenses').select('*').order('created_at', { ascending: false })

      if (shopFilter) {
        invoicesQuery = invoicesQuery.or(shopFilter) as any
        expensesQuery = expensesQuery.or(shopFilter) as any
      }

      const [invoicesRes, expensesRes, inventoryRes] = await Promise.all([
        invoicesQuery,
        expensesQuery,
        supabase.from('inventory').select('*'),
      ])

      setInvoices(invoicesRes.data || [])
      setExpenses(expensesRes.data || [])
      setInventory(inventoryRes.data || [])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (amount: number) => `₹${formatINR(amount)}`

  // Helper: filter items to a date range
  function filterItems<T extends { date?: string; created_at: string }>(
    items: T[], start: string, end: string
  ): T[] {
    return items.filter(item => {
      const d = item.date?.split('T')[0] || new Date(item.created_at).toISOString().split('T')[0]
      return d >= start && d <= end
    })
  }

  // Date ranges for current and previous period
  const { curRange, prevRange, trendLabel } = useMemo(() => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    if (period === 'today') {
      const yest = new Date(now); yest.setDate(now.getDate() - 1)
      const y = yest.toISOString().split('T')[0]
      return { curRange: { start: today, end: today }, prevRange: { start: y, end: y }, trendLabel: 'vs yesterday' }
    }
    if (period === 'week') {
      const s = new Date(now); s.setDate(now.getDate() - 6)
      const pe = new Date(s); pe.setDate(s.getDate() - 1)
      const ps = new Date(pe); ps.setDate(pe.getDate() - 6)
      return {
        curRange: { start: s.toISOString().split('T')[0], end: today },
        prevRange: { start: ps.toISOString().split('T')[0], end: pe.toISOString().split('T')[0] },
        trendLabel: 'vs prev week',
      }
    }
    if (period === 'month') {
      const s = new Date(now); s.setDate(now.getDate() - 29)
      const pe = new Date(s); pe.setDate(s.getDate() - 1)
      const ps = new Date(pe); ps.setDate(pe.getDate() - 29)
      return {
        curRange: { start: s.toISOString().split('T')[0], end: today },
        prevRange: { start: ps.toISOString().split('T')[0], end: pe.toISOString().split('T')[0] },
        trendLabel: 'vs prev month',
      }
    }
    return {
      curRange: { start: appliedCustomStart || today, end: appliedCustomEnd || today },
      prevRange: null,
      trendLabel: '',
    }
  }, [period, appliedCustomStart, appliedCustomEnd])

  // Financial summary stats
  const finStats = useMemo(() => {
    const curInvoices = filterItems(invoices, curRange.start, curRange.end)
    const curExpenses = filterItems(expenses, curRange.start, curRange.end)
    const sales = curInvoices.reduce((s, inv) => s + parseFloat(inv.total_amount?.toString() || '0'), 0)
    const totalExpenses = curExpenses.reduce((s, exp) => s + parseFloat(exp.amount?.toString() || '0'), 0)

    // COGS: invoice items × inventory purchase_price
    const priceMap = new Map<string, number>()
    inventory.forEach(item => {
      priceMap.set(item.name, parseFloat((item as any).purchase_price?.toString() || '0'))
    })
    let cogs = 0
    curInvoices.forEach(inv => {
      try {
        const items = inv.items
          ? (typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items)
          : []
        if (Array.isArray(items)) {
          items.forEach((it: any) => {
            const itemName = it.description || it.item_name || it.name || ''
            cogs += (priceMap.get(itemName) || 0) * parseFloat(it.quantity?.toString() || '0')
          })
        }
      } catch { /* skip malformed */ }
    })

    const netProfit = sales - totalExpenses - cogs

    // Sales trend vs previous period
    let salesTrend = 0
    if (prevRange) {
      const prevSales = filterItems(invoices, prevRange.start, prevRange.end)
        .reduce((s, inv) => s + parseFloat(inv.total_amount?.toString() || '0'), 0)
      salesTrend = prevSales > 0 ? ((sales - prevSales) / prevSales) * 100 : 0
    }

    // Top selling product
    const productMap = new Map<string, number>()
    curInvoices.forEach(inv => {
      try {
        const items = inv.items
          ? (typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items)
          : []
        if (Array.isArray(items)) {
          items.forEach((it: any) => {
            const name = it.description || it.item_name || it.name || 'Unknown'
            productMap.set(name, (productMap.get(name) || 0) + parseFloat(it.quantity?.toString() || '0'))
          })
        }
      } catch { /* skip */ }
    })
    let topProduct = { name: 'No sales in period', qty: 0 }
    productMap.forEach((qty, name) => { if (qty > topProduct.qty) topProduct = { name, qty } })

    // Top expense category
    const catMap = new Map<string, number>()
    curExpenses.forEach(exp => {
      const cat = exp.category || 'Other'
      catMap.set(cat, (catMap.get(cat) || 0) + parseFloat(exp.amount?.toString() || '0'))
    })
    let topCategory = { name: 'No expenses in period', amount: 0 }
    catMap.forEach((amount, name) => { if (amount > topCategory.amount) topCategory = { name, amount } })

    // Pending payments - ALL invoices, not filtered by period
    const pending = invoices.filter(inv => inv.payment_status && inv.payment_status.toLowerCase() !== 'paid')
    const pendingAmount = pending.reduce((s, inv) => s + parseFloat(inv.total_amount?.toString() || '0'), 0)

    // Low stock
    const lowStockCount = inventory.filter(
      item => parseFloat(item.stock?.toString() || '0') <= parseFloat(item.low_stock_threshold?.toString() || '10')
    ).length

    return {
      sales, totalExpenses, cogs, netProfit, salesTrend,
      invoiceCount: curInvoices.length,
      topProduct, topCategory,
      pendingCount: pending.length, pendingAmount,
      hasTrend: !!prevRange, lowStockCount,
    }
  }, [invoices, expenses, inventory, curRange, prevRange])

  // 6-month aggregated chart data
  const chartData6Mo = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const start = d.toISOString().split('T')[0]
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      const s = filterItems(invoices, start, end).reduce((sum, inv) => sum + parseFloat(inv.total_amount?.toString() || '0'), 0)
      const e = filterItems(expenses, start, end).reduce((sum, exp) => sum + parseFloat(exp.amount?.toString() || '0'), 0)
      return { label, sales: Math.round(s), expenses: Math.round(e), profit: Math.round(s - e) }
    })
  }, [invoices, expenses])

  if (loading) {
    return <div className="card" style={{ padding: 32, textAlign: 'center' }}>Loading...</div>
  }

  return (
    <div className="dashboard-container">

      {/* Period Filter Bar */}
      <div className="period-filter-bar">
        <span className="period-label">Period</span>
        {(['today', 'week', 'month'] as const).map(p => (
          <button
            key={p}
            className={`period-btn${period === p ? ' active' : ''}`}
            onClick={() => startTransition(() => { setPeriod(p); setShowCustomRange(false) })}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
        <button
          className={`period-btn${period === 'custom' ? ' active' : ''}`}
          onClick={() => startTransition(() => { setPeriod('custom'); setShowCustomRange(v => !v) })}
        >
          Custom ▾
        </button>
        <div className={`period-custom-range${showCustomRange ? ' show' : ''}`}>
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
          <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: 13 }}>to</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          <button
            className="btn-apply-range"
            onClick={() => startTransition(() => {
              setAppliedCustomStart(customStart)
              setAppliedCustomEnd(customEnd)
              setShowCustomRange(false)
            })}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Financial Summary Grid */}
      <div className="financial-summary-grid">
        <div className="fin-card sales">
          <div className="fin-card-header">
            <span className="fin-card-label">Sales</span>
            <div className="fin-card-icon"><span className="material-icons">payments</span></div>
          </div>
          <div className="fin-card-value">{showPrivacy ? '••••••' : fmt(finStats.sales)}</div>
          <div className="fin-card-footer">
            {finStats.hasTrend && finStats.salesTrend !== 0 && (
              <span className={`fin-card-trend ${finStats.salesTrend > 0 ? 'up' : 'down'}`}>
                <span className="material-icons">{finStats.salesTrend > 0 ? 'trending_up' : 'trending_down'}</span>
                {Math.abs(finStats.salesTrend).toFixed(1)}%
              </span>
            )}
            <span className="fin-card-meta">{trendLabel || `${finStats.invoiceCount} invoices`}</span>
          </div>
        </div>

        <div className="fin-card expenses">
          <div className="fin-card-header">
            <span className="fin-card-label">Expenses</span>
            <div className="fin-card-icon"><span className="material-icons">receipt</span></div>
          </div>
          <div className="fin-card-value">{showPrivacy ? '••••••' : fmt(finStats.totalExpenses)}</div>
          <div className="fin-card-footer">
            <span className="fin-card-meta">Total for period</span>
          </div>
        </div>

        <div className="fin-card purchases">
          <div className="fin-card-header">
            <span className="fin-card-label">Purchases (COGS)</span>
            <div className="fin-card-icon"><span className="material-icons">inventory_2</span></div>
          </div>
          <div className="fin-card-value">{showPrivacy ? '••••••' : fmt(finStats.cogs)}</div>
          <div className="fin-card-footer">
            <span className="fin-card-meta">Cost of goods sold</span>
          </div>
        </div>

        <div className={`fin-card profit${finStats.netProfit < 0 ? ' profit-negative' : ''}`}>
          <div className="fin-card-header">
            <span className="fin-card-label">Net Profit</span>
            <div className="fin-card-icon">
              <span className="material-icons">{finStats.netProfit >= 0 ? 'trending_up' : 'trending_down'}</span>
            </div>
          </div>
          <div className="fin-card-value">{showPrivacy ? '••••••' : fmt(finStats.netProfit)}</div>
          <div className="fin-card-footer">
            <span className="fin-card-meta">Sales − Expenses − COGS</span>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="insights-section">
        <div className="insight-tile">
          <div className="insight-icon blue"><span className="material-icons">star</span></div>
          <div className="insight-body">
            <div className="insight-label">Top Selling Product</div>
            <div className="insight-value">{finStats.topProduct.name}</div>
            <div className="insight-sub">
              {finStats.topProduct.qty > 0 ? `${finStats.topProduct.qty} units sold` : ''}
            </div>
          </div>
        </div>

        <div className="insight-tile">
          <div className="insight-icon orange"><span className="material-icons">category</span></div>
          <div className="insight-body">
            <div className="insight-label">Top Expense Category</div>
            <div className="insight-value">{showPrivacy ? '••••' : finStats.topCategory.name}</div>
            <div className="insight-sub">
              {finStats.topCategory.amount > 0 ? (showPrivacy ? '••••' : fmt(finStats.topCategory.amount)) : ''}
            </div>
          </div>
        </div>

        <div className="insight-tile">
          <div className="insight-icon red"><span className="material-icons">pending_actions</span></div>
          <div className="insight-body">
            <div className="insight-label">Pending Payments</div>
            <div className="insight-value">{showPrivacy ? '••••••' : fmt(finStats.pendingAmount)}</div>
            <div className="insight-sub">
              {finStats.pendingCount} invoice{finStats.pendingCount !== 1 ? 's' : ''} pending
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid – 6-month aggregated */}
      <Suspense fallback={
        <div className="charts-grid">
          <div className="card" style={{ padding: 24, background: 'var(--bg-secondary, #f8f9fa)' }}>
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              Loading chart...
            </div>
          </div>
          <div className="card" style={{ padding: 24, background: 'var(--bg-secondary, #f8f9fa)' }}>
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              Loading chart...
            </div>
          </div>
        </div>
      }>
        <DashboardCharts chartData6Mo={chartData6Mo} />
      </Suspense>

      {/* Recent Invoices + Activity Feed – Lazy Loaded Below Fold */}
      <Suspense fallback={
        <div style={{ marginTop: 24 }}>
          <div className="card" style={{ padding: 24, background: 'var(--bg-secondary, #f8f9fa)', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            Loading dashboard details...
          </div>
        </div>
      }>
        <DashboardLowerSection
          invoices={invoices}
          expenses={expenses}
          inventory={inventory}
          showPrivacy={showPrivacy}
          fmt={fmt}
        />
      </Suspense>
    </div>
  )
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago'
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago'
  if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago'
  return date.toLocaleDateString('en-IN')
}
