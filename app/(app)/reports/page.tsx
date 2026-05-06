'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import { formatRupee } from '@/lib/currency'
import { supabase } from '@/lib/supabase'
import { usePurchases, useSuppliers } from '@/hooks/useAPI'
import type { Purchase } from '@/lib/supabase'
import { generateInvoicePDF, generateMultipleInvoicesPDF } from '@/lib/pdf-generator'
import BillPrintModal from '@/components/BillPrintModal'
import InvoicePreviewModalNew from '@/components/InvoicePreviewModalNew'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────
interface InvoiceItem {
  product?: string
  name?: string
  quantity: number
  price: number
}

interface Invoice {
  id: string
  date: string
  total: number
  customer: string
  items: InvoiceItem[]
  invoiceNumber?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  customerMobile?: string
  dueDate?: string
  subtotal?: number
  taxAmount?: number
  gst_amount?: number
  total_amount?: number
  status?: 'paid' | 'unpaid' | 'partial'
  payment_status?: 'paid' | 'unpaid' | 'partial'
  amountPaid?: number
  amount_paid?: number
  notes?: string
  isInterState?: boolean
  is_inter_state?: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────
const COLORS = ['#2845D6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

// ── Helpers ────────────────────────────────────────────────────────────────
function parseItems(raw: unknown): InvoiceItem[] {
  if (!raw) return []
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw as string) : raw
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function parsePurchaseItems(raw: any): any[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  }
  return []
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  return <ReportsContent />
}

// ── Main Content ───────────────────────────────────────────────────────────
function ReportsContent() {
  const { user } = useAuth()
  const toast = useToast()

  // SSR safety for recharts
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const { data: purchases = [] } = usePurchases()
  const { data: suppliers = [] } = useSuppliers()

  // Date range filter (applies to ALL tabs)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])

  // Active tab
  const [activeTab, setActiveTab] = useState<'revenue' | 'products' | 'customers' | 'purchases' | 'invoices'>('revenue')
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)

  // Invoice-specific state
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('')
  const [invoiceFilterStatus, setInvoiceFilterStatus] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all')
  const [invoiceFilterFromDate, setInvoiceFilterFromDate] = useState('')
  const [invoiceFilterToDate, setInvoiceFilterToDate] = useState('')
  const [invoiceCurrentPage, setInvoiceCurrentPage] = useState(1)
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [editForm, setEditForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    date: '',
    dueDate: '',
    status: 'unpaid' as 'paid' | 'unpaid' | 'partial',
    amountPaid: 0,
    notes: '',
  })
  const [editLoading, setEditLoading] = useState(false)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [businessProfile, setBusinessProfile] = useState<any>(null)
  const [showBillPrintModal, setShowBillPrintModal] = useState(false)
  const [billForPrint, setBillForPrint] = useState<any>(null)

  // ── Load invoices ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        // Fetch business profile
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user!.id)
          .single()
        
        if (profileData) {
          setBusinessProfile(profileData)
        }

        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .order('date', { ascending: false })

        if (error) {
          toast.error(error.message)
          setLoading(false)
          return
        }

        const parsed: Invoice[] = (data || []).map((row: any) => ({
          id: row.id,
          date: row.date || row.created_at || '',
          total: Number(row.total_amount) || 0,
          customer: row.customer_name || 'Unknown Customer',
          items: parseItems(row.items),
          invoiceNumber: row.invoice_number || 'N/A',
          customerName: row.customer_name || 'Unknown',
          customerEmail: row.customer_email,
          customerPhone: row.customer_mobile,
          dueDate: row.due_date,
          subtotal: row.subtotal || 0,
          taxAmount: row.gst_amount || row.tax_amount || 0,
          total_amount: row.total_amount || 0,
          status: row.payment_status || 'unpaid',
          amountPaid: row.amount_paid,
          isInterState: row.is_inter_state || false,
        }))

        setInvoices(parsed)
        setFilteredInvoices(parsed)
      } catch {
        toast.error('Failed to load reports')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, toast])

  // ── Filter handlers ────────────────────────────────────────────────────
  const applyFilter = () => {
    const from = dateFrom ? new Date(dateFrom) : null
    const to = dateTo ? new Date(dateTo + 'T23:59:59') : null
    if (!from && !to) {
      setFilteredInvoices(invoices)
      return
    }
    setFilteredInvoices(
      invoices.filter(inv => {
        const d = new Date(inv.date)
        if (from && d < from) return false
        if (to && d > to) return false
        return true
      })
    )
    toast.success('Filter applied')
  }

  const clearFilter = () => {
    setDateFrom('')
    setDateTo('')
    setFilteredInvoices(invoices)
  }

  // Invoice-specific filtering
  const filteredInvoicesForTab = useMemo(() => {
    return invoices.filter((inv) => {
      // Search filter
      if (invoiceSearchQuery.trim()) {
        const q = invoiceSearchQuery.toLowerCase()
        const match =
          (inv.invoiceNumber || '').toLowerCase().includes(q) ||
          (inv.customerName || '').toLowerCase().includes(q) ||
          (inv.customerEmail || '').toLowerCase().includes(q)
        if (!match) return false
      }

      // Status filter
      if (invoiceFilterStatus !== 'all' && (inv.status || 'unpaid') !== invoiceFilterStatus) return false

      // Date range filter
      if (invoiceFilterFromDate) {
        const invDate = new Date(inv.date)
        const fromDate = new Date(invoiceFilterFromDate)
        if (invDate < fromDate) return false
      }

      if (invoiceFilterToDate) {
        const invDate = new Date(inv.date)
        const toDate = new Date(invoiceFilterToDate)
        if (invDate > toDate) return false
      }

      return true
    })
  }, [invoices, invoiceSearchQuery, invoiceFilterStatus, invoiceFilterFromDate, invoiceFilterToDate])

  function getStatusColor(status: 'paid' | 'unpaid' | 'partial') {
    switch (status) {
      case 'paid':
        return { bg: '#d1fae5', color: '#065f46', text: 'Paid' }
      case 'unpaid':
        return { bg: '#fee2e2', color: '#991b1b', text: 'Unpaid' }
      case 'partial':
        return { bg: '#fef3c7', color: '#92400e', text: 'Partial' }
    }
  }

  // Invoice summary metrics
  const invoiceSummary = useMemo(() => {
    let totalAmount = 0
    let paidAmount = 0
    let unpaidAmount = 0
    let partialAmount = 0

    filteredInvoicesForTab.forEach((inv) => {
      const total = inv.total || inv.total_amount || 0
      totalAmount += total
      const status = inv.status || 'unpaid'
      if (status === 'paid') {
        paidAmount += total
      } else if (status === 'unpaid') {
        unpaidAmount += total
      } else {
        partialAmount += (total - (inv.amountPaid || 0))
      }
    })

    return {
      total: totalAmount,
      paid: paidAmount,
      unpaid: unpaidAmount,
      partial: partialAmount,
      count: filteredInvoicesForTab.length,
    }
  }, [filteredInvoicesForTab])

  const INVOICES_PER_PAGE = 10
  const totalInvoicePages = Math.ceil(filteredInvoicesForTab.length / INVOICES_PER_PAGE)
  const paginatedInvoices = filteredInvoicesForTab.slice(
    (invoiceCurrentPage - 1) * INVOICES_PER_PAGE,
    invoiceCurrentPage * INVOICES_PER_PAGE
  )

  // ── Monthly Revenue ────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; invoices: number; revenue: number }>()
    filteredInvoices.forEach(inv => {
      const d = new Date(inv.date)
      if (isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      const existing = map.get(key)
      if (existing) {
        existing.invoices++
        existing.revenue += inv.total
      } else {
        map.set(key, { month: label, invoices: 1, revenue: inv.total })
      }
    })
    const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
    return entries.map(([, v], i) => {
      const prevRevenue = i > 0 ? entries[i - 1][1].revenue : 0
      const growth = prevRevenue > 0 ? ((v.revenue - prevRevenue) / prevRevenue) * 100 : 0
      return { ...v, growth: parseFloat(growth.toFixed(1)) }
    })
  }, [filteredInvoices])

  const totalRevenue = useMemo(
    () => filteredInvoices.reduce((s, i) => s + i.total, 0),
    [filteredInvoices]
  )
  const avgMonthlyRevenue = useMemo(
    () => (monthlyData.length > 0 ? totalRevenue / monthlyData.length : 0),
    [totalRevenue, monthlyData]
  )

  // ── Products ───────────────────────────────────────────────────────────
  const productsData = useMemo(() => {
    const map = new Map<string, { name: string; units: number; revenue: number }>()
    filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        const name = (item.product || item.name || 'Unknown Product').trim()
        const qty = Number(item.quantity) || 1
        const rev = Number(item.price) * qty
        const existing = map.get(name)
        if (existing) {
          existing.units += qty
          existing.revenue += rev
        } else {
          map.set(name, { name, units: qty, revenue: rev })
        }
      })
    })
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [filteredInvoices])

  const totalProductRevenue = useMemo(
    () => productsData.reduce((s, p) => s + p.revenue, 0),
    [productsData]
  )
  const totalUnits = useMemo(
    () => productsData.reduce((s, p) => s + p.units, 0),
    [productsData]
  )

  // ── Customers ──────────────────────────────────────────────────────────
  const customersData = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; total: number }>()
    filteredInvoices.forEach(inv => {
      const name = (inv.customer || 'Unknown Customer').trim()
      const existing = map.get(name)
      if (existing) {
        existing.orders++
        existing.total += inv.total
      } else {
        map.set(name, { name, orders: 1, total: inv.total })
      }
    })
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10)
  }, [filteredInvoices])

  const totalCustomerSpend = useMemo(
    () => customersData.reduce((s, c) => s + c.total, 0),
    [customersData]
  )
  const repeatCustomers = useMemo(
    () => customersData.filter(c => c.orders > 1).length,
    [customersData]
  )
  const avgOrderValue = useMemo(() => {
    const totalOrders = customersData.reduce((s, c) => s + c.orders, 0)
    return totalOrders > 0 ? totalCustomerSpend / totalOrders : 0
  }, [totalCustomerSpend, customersData])

  // ── Export helpers ─────────────────────────────────────────────────────
  const exportRevenue = () => {
    const rows = monthlyData.map(r =>
      `${r.month},${r.invoices},${r.revenue.toFixed(2)},${r.growth}`
    )
    downloadCSV('monthly-revenue.csv', 'Month,Invoices,Revenue,Growth%\n' + rows.join('\n'))
    toast.success('CSV exported!')
  }

  const exportProducts = () => {
    const rows = productsData.map(p => {
      const pct = totalProductRevenue > 0 ? (p.revenue / totalProductRevenue * 100).toFixed(1) : '0'
      const avg = p.units > 0 ? (p.revenue / p.units).toFixed(2) : '0'
      return `${p.name},${p.units},${p.revenue.toFixed(2)},${pct},${avg}`
    })
    downloadCSV('top-products.csv', 'Product,Units Sold,Revenue,% of Total,Avg Price\n' + rows.join('\n'))
    toast.success('CSV exported!')
  }

  const exportCustomers = () => {
    const rows = customersData.map(c => {
      const pct = totalCustomerSpend > 0 ? (c.total / totalCustomerSpend * 100).toFixed(1) : '0'
      const avg = c.orders > 0 ? (c.total / c.orders).toFixed(2) : '0'
      return `${c.name},${c.orders},${c.total.toFixed(2)},${avg},${pct}`
    })
    downloadCSV('top-customers.csv', 'Customer,Orders,Total Spent,Avg Order,% of Total\n' + rows.join('\n'))
    toast.success('CSV exported!')
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="page-content">

      {/* ── Date Range Filter (applies to ALL tabs) ───────────────────── */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-icons" style={{ fontSize: 20, color: '#2845D6' }}>date_range</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Date Range Filter</span>
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="form-control"
            style={{ maxWidth: 160 }}
          />
          <span style={{ color: 'var(--text-muted, #999)', fontSize: 13 }}>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="form-control"
            style={{ maxWidth: 160 }}
          />
          <button
            onClick={applyFilter}
            style={{
              padding: '8px 16px',
              background: '#2845D6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>filter_list</span>
            Apply Filter
          </button>
          {(dateFrom || dateTo) && (
            <button
              onClick={clearFilter}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                color: 'var(--text-secondary, #666)',
                border: '1px solid var(--border-color, #e0e4f8)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Clear
            </button>
          )}
          {!loading && (
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted, #999)' }}>
              {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} in range
            </span>
          )}
        </div>
      </div>

      {/* ── Tab Navigation ────────────────────────────────────────────── */}
      <div className="report-tabs">
        {([
          { id: 'revenue', icon: 'trending_up', label: 'Monthly Revenue' },
          { id: 'products', icon: 'inventory_2', label: 'Top Products' },
          { id: 'customers', icon: 'people', label: 'Top Customers' },
          { id: 'purchases', icon: 'shopping_cart', label: 'Purchase History' },
          { id: 'invoices', icon: 'receipt_long', label: 'Invoice History' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            className={`report-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="material-icons">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
          <span className="material-icons" style={{ fontSize: 40, display: 'block', marginBottom: 12, opacity: 0.4 }}>
            hourglass_empty
          </span>
          Loading reports…
        </div>
      )}

      {/* ── Monthly Revenue Tab ───────────────────────────────────────── */}
      {!loading && activeTab === 'revenue' && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="fin-card sales">
              <div className="fin-card-header">
                <span className="fin-card-label">Total Revenue</span>
                <div className="fin-card-icon"><span className="material-icons">payments</span></div>
              </div>
              <div className="fin-card-value">{formatRupee(totalRevenue)}</div>
            </div>
            <div className="fin-card profit">
              <div className="fin-card-header">
                <span className="fin-card-label">Total Invoices</span>
                <div className="fin-card-icon"><span className="material-icons">receipt_long</span></div>
              </div>
              <div className="fin-card-value">{filteredInvoices.length}</div>
            </div>
            <div className="fin-card expenses">
              <div className="fin-card-header">
                <span className="fin-card-label">Avg Monthly Revenue</span>
                <div className="fin-card-icon"><span className="material-icons">trending_up</span></div>
              </div>
              <div className="fin-card-value">{formatRupee(avgMonthlyRevenue)}</div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Revenue by Month</h3>
              <button
                onClick={exportRevenue}
                style={{
                  padding: '7px 14px',
                  background: 'transparent',
                  color: '#2845D6',
                  border: '1px solid #2845D6',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span className="material-icons" style={{ fontSize: 16 }}>download</span>
                Export CSV
              </button>
            </div>
            {mounted && monthlyData.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e0e4f8)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v) => [formatRupee(Number(v ?? 0)), 'Revenue']}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#2845D6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : mounted ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
                No invoice data for the selected date range
              </div>
            ) : null}
          </div>

          {/* Monthly Breakdown Table */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ margin: 0, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Monthly Breakdown</h3>
            {monthlyData.length > 0 ? (
              <div className="table-wrapper">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Invoices</th>
                      <th>Revenue</th>
                      <th>Growth %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map(row => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>{row.invoices}</td>
                        <td style={{ fontWeight: 600 }}>{formatRupee(row.revenue)}</td>
                        <td>
                          <span style={{ color: row.growth > 0 ? '#10b981' : row.growth < 0 ? '#ef4444' : '#999', fontWeight: 600 }}>
                            {row.growth > 0 ? '▲' : row.growth < 0 ? '▼' : '—'}{' '}
                            {row.growth !== 0 ? `${Math.abs(row.growth)}%` : ''}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
                No data for selected period
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Top Products Tab ──────────────────────────────────────────── */}
      {!loading && activeTab === 'products' && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="fin-card sales">
              <div className="fin-card-header">
                <span className="fin-card-label">Total Products</span>
                <div className="fin-card-icon"><span className="material-icons">inventory_2</span></div>
              </div>
              <div className="fin-card-value">{productsData.length}</div>
            </div>
            <div className="fin-card profit">
              <div className="fin-card-header">
                <span className="fin-card-label">Total Units Sold</span>
                <div className="fin-card-icon"><span className="material-icons">shopping_bag</span></div>
              </div>
              <div className="fin-card-value">{totalUnits}</div>
            </div>
            <div className="fin-card expenses">
              <div className="fin-card-header">
                <span className="fin-card-label">Product Revenue</span>
                <div className="fin-card-icon"><span className="material-icons">paid</span></div>
              </div>
              <div className="fin-card-value">{formatRupee(totalProductRevenue)}</div>
            </div>
          </div>

          {/* Pie Chart + Table side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) 1fr', gap: 24, marginBottom: 24, alignItems: 'start' }}>
            {/* Doughnut Chart */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: 0, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Revenue Share</h3>
              {mounted && productsData.length > 0 ? (
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productsData}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                      >
                        {productsData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [formatRupee(Number(v ?? 0)), 'Revenue']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : mounted ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
                  No product data in range
                </div>
              ) : null}
            </div>

            {/* Products Table */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Top Products</h3>
                <button
                  onClick={exportProducts}
                  style={{
                    padding: '7px 14px',
                    background: 'transparent',
                    color: '#2845D6',
                    border: '1px solid #2845D6',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 16 }}>download</span>
                  Export CSV
                </button>
              </div>
              {productsData.length > 0 ? (
                <div className="table-wrapper">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Product</th>
                        <th>Units</th>
                        <th>Revenue</th>
                        <th>% Share</th>
                        <th>Avg Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsData.map((p, idx) => {
                        const pct = totalProductRevenue > 0 ? (p.revenue / totalProductRevenue * 100).toFixed(1) : '0'
                        const avg = p.units > 0 ? p.revenue / p.units : 0
                        return (
                          <tr key={p.name}>
                            <td style={{ color: 'var(--text-muted, #999)' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 500 }}>{p.name}</td>
                            <td>{p.units}</td>
                            <td style={{ fontWeight: 600 }}>{formatRupee(p.revenue)}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  height: 6,
                                  width: 60,
                                  background: 'var(--border-color, #e0e4f8)',
                                  borderRadius: 3,
                                  overflow: 'hidden',
                                }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${pct}%`,
                                    background: COLORS[idx % COLORS.length],
                                    borderRadius: 3,
                                  }} />
                                </div>
                                {pct}%
                              </div>
                            </td>
                            <td>{formatRupee(avg)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
                  No product data for selected period
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Top Customers Tab ─────────────────────────────────────────── */}
      {!loading && activeTab === 'customers' && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="fin-card sales">
              <div className="fin-card-header">
                <span className="fin-card-label">Total Customers</span>
                <div className="fin-card-icon"><span className="material-icons">people</span></div>
              </div>
              <div className="fin-card-value">{customersData.length}</div>
            </div>
            <div className="fin-card profit">
              <div className="fin-card-header">
                <span className="fin-card-label">Repeat Customers</span>
                <div className="fin-card-icon"><span className="material-icons">repeat</span></div>
              </div>
              <div className="fin-card-value">
                {repeatCustomers}
                <span style={{ fontSize: 14, color: 'var(--text-muted, #999)', fontWeight: 400, marginLeft: 6 }}>
                  ({customersData.length > 0 ? ((repeatCustomers / customersData.length) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>
            <div className="fin-card expenses">
              <div className="fin-card-header">
                <span className="fin-card-label">Avg Order Value</span>
                <div className="fin-card-icon"><span className="material-icons">local_atm</span></div>
              </div>
              <div className="fin-card-value">{formatRupee(avgOrderValue)}</div>
            </div>
          </div>

          {/* Horizontal Bar Chart */}
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            <h3 style={{ margin: 0, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Top Customers by Spend</h3>
            {mounted && customersData.length > 0 ? (
              <div style={{ width: '100%', height: Math.max(240, customersData.length * 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={customersData}
                    layout="vertical"
                    margin={{ top: 4, right: 60, left: 100, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e0e4f8)" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [formatRupee(Number(v ?? 0)), 'Total Spent']} />
                    <Bar dataKey="total" name="Total Spent" fill="#2845D6" radius={[0, 4, 4, 0]}>
                      {customersData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : mounted ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
                No customer data in range
              </div>
            ) : null}
          </div>

          {/* Customers Table */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Customer Details</h3>
              <button
                onClick={exportCustomers}
                style={{
                  padding: '7px 14px',
                  background: 'transparent',
                  color: '#2845D6',
                  border: '1px solid #2845D6',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span className="material-icons" style={{ fontSize: 16 }}>download</span>
                Export CSV
              </button>
            </div>
            {customersData.length > 0 ? (
              <div className="table-wrapper">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Customer</th>
                      <th>Orders</th>
                      <th>Total Spent</th>
                      <th>Avg Order</th>
                      <th>% Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customersData.map((c, idx) => {
                      const pct = totalCustomerSpend > 0 ? (c.total / totalCustomerSpend * 100).toFixed(1) : '0'
                      const avg = c.orders > 0 ? c.total / c.orders : 0
                      return (
                        <tr key={c.name + idx}>
                          <td style={{ color: 'var(--text-muted, #999)' }}>{idx + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 500 }}>{c.name}</span>
                              {c.orders > 1 && (
                                <span style={{
                                  fontSize: 11,
                                  background: 'rgba(16,185,129,0.1)',
                                  color: '#10b981',
                                  borderRadius: 4,
                                  padding: '2px 6px',
                                  fontWeight: 600,
                                }}>Repeat</span>
                              )}
                            </div>
                          </td>
                          <td>{c.orders}</td>
                          <td style={{ fontWeight: 600 }}>{formatRupee(c.total)}</td>
                          <td>{formatRupee(avg)}</td>
                          <td style={{ color: 'var(--text-secondary, #666)' }}>{pct}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
                No customer data for selected period
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Purchase History Tab ──────────────────────────────────────── */}
      {!loading && activeTab === 'purchases' && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="fin-card sales">
              <div className="fin-card-header">
                <span className="fin-card-label">Total Purchases</span>
                <div className="fin-card-icon"><span className="material-icons">shopping_cart</span></div>
              </div>
              <div className="fin-card-value">{purchases.length}</div>
            </div>
            <div className="fin-card profit">
              <div className="fin-card-header">
                <span className="fin-card-label">Total Amount</span>
                <div className="fin-card-icon"><span className="material-icons">payments</span></div>
              </div>
              <div className="fin-card-value">{formatRupee(purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0))}</div>
            </div>
            <div className="fin-card expenses">
              <div className="fin-card-header">
                <span className="fin-card-label">Suppliers</span>
                <div className="fin-card-icon"><span className="material-icons">local_shipping</span></div>
              </div>
              <div className="fin-card-value">{new Set(purchases.map(p => p.supplier_id)).size}</div>
            </div>
          </div>

          {/* Purchases Table */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Purchase Details</h3>
            </div>
            {purchases.length > 0 ? (
              <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Supplier</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th style={{ textAlign: 'right' }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map(p => {
                      const supplier = suppliers.find(s => s.id === p.supplier_id)
                      const items = parsePurchaseItems(p.items)
                      return (
                        <tr key={p.id} onClick={() => setSelectedPurchase(p)} style={{ cursor: 'pointer' }}>
                          <td style={{ fontWeight: 600 }}>{p.purchase_number}</td>
                          <td>{supplier?.name || 'Unknown Supplier'}</td>
                          <td>{new Date(p.date).toLocaleDateString()}</td>
                          <td>{items.length} item{items.length !== 1 ? 's' : ''}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatRupee(p.total_amount)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
                No purchases yet
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Invoice History Tab ───────────────────────────────────────── */}
      {!loading && activeTab === 'invoices' && (
        <>
          {/* Filters */}
          <div className="card" style={{ padding: 16, marginBottom: 24, background: 'var(--bg-main, #f9fafb)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Invoice # or customer..."
                  value={invoiceSearchQuery}
                  onChange={(e) => {
                    setInvoiceSearchQuery(e.target.value)
                    setInvoiceCurrentPage(1)
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    border: '1px solid var(--border-color, #e0e4f8)',
                    borderRadius: 6,
                    fontSize: 12,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
                  Status
                </label>
                <select
                  value={invoiceFilterStatus}
                  onChange={(e) => {
                    setInvoiceFilterStatus(e.target.value as any)
                    setInvoiceCurrentPage(1)
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    border: '1px solid var(--border-color, #e0e4f8)',
                    borderRadius: 6,
                    fontSize: 12,
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
                  From Date
                </label>
                <input
                  type="date"
                  value={invoiceFilterFromDate}
                  onChange={(e) => {
                    setInvoiceFilterFromDate(e.target.value)
                    setInvoiceCurrentPage(1)
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    border: '1px solid var(--border-color, #e0e4f8)',
                    borderRadius: 6,
                    fontSize: 12,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
                  To Date
                </label>
                <input
                  type="date"
                  value={invoiceFilterToDate}
                  onChange={(e) => {
                    setInvoiceFilterToDate(e.target.value)
                    setInvoiceCurrentPage(1)
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    border: '1px solid var(--border-color, #e0e4f8)',
                    borderRadius: 6,
                    fontSize: 12,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <button
                  onClick={() => {
                    setInvoiceSearchQuery('')
                    setInvoiceFilterStatus('all')
                    setInvoiceFilterFromDate('')
                    setInvoiceFilterToDate('')
                    setInvoiceCurrentPage(1)
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'var(--border-color, #e0e4f8)',
                    color: 'var(--text-secondary, #666)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    marginTop: 22,
                  }}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {filteredInvoicesForTab.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div className="fin-card sales">
                <div className="fin-card-header">
                  <span className="fin-card-label">Total Revenue</span>
                  <div className="fin-card-icon"><span className="material-icons">payments</span></div>
                </div>
                <div className="fin-card-value">{formatRupee(invoiceSummary.total)}</div>
                <div className="fin-card-footer">
                  <span className="fin-card-meta">{invoiceSummary.count} invoices</span>
                </div>
              </div>

              <div className="fin-card profit">
                <div className="fin-card-header">
                  <span className="fin-card-label">Paid</span>
                  <div className="fin-card-icon"><span className="material-icons">check_circle</span></div>
                </div>
                <div className="fin-card-value">{formatRupee(invoiceSummary.paid)}</div>
                <div className="fin-card-footer">
                  <span className="fin-card-meta">Collected</span>
                </div>
              </div>

              <div className="fin-card profit profit-negative">
                <div className="fin-card-header">
                  <span className="fin-card-label">Unpaid</span>
                  <div className="fin-card-icon"><span className="material-icons">pending</span></div>
                </div>
                <div className="fin-card-value">{formatRupee(invoiceSummary.unpaid)}</div>
                <div className="fin-card-footer">
                  <span className="fin-card-meta">Pending</span>
                </div>
              </div>

              <div className="fin-card expenses">
                <div className="fin-card-header">
                  <span className="fin-card-label">Partial</span>
                  <div className="fin-card-icon"><span className="material-icons">hourglass_top</span></div>
                </div>
                <div className="fin-card-value">{formatRupee(invoiceSummary.partial)}</div>
                <div className="fin-card-footer">
                  <span className="fin-card-meta">Outstanding</span>
                </div>
              </div>
            </div>
          )}

          {/* Invoices Table */}
          {paginatedInvoices.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
              <span className="material-icons" style={{ fontSize: 48, marginBottom: 12 }}>
                receipt_long
              </span>
              <p>{filteredInvoicesForTab.length === 0 ? 'No invoices yet' : 'No matching invoices'}</p>
            </div>
          ) : (
            <div className="card">
              <div className="table-responsive">
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color, #e0e4f8)' }}>
                      <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Invoice #</th>
                      <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Customer</th>
                      <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Amount</th>
                      <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((inv) => {
                      const statusInfo = getStatusColor(inv.status || 'unpaid')
                      return (
                        <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
                          <td style={{ padding: 12 }}>
                            <strong>{inv.invoiceNumber}</strong>
                          </td>
                          <td style={{ padding: 12 }}>
                            <div>{inv.customerName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted, #999)' }}>{inv.customerPhone}</div>
                          </td>
                          <td style={{ padding: 12 }}>
                            {new Date(inv.date).toLocaleDateString('en-IN')}
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>
                            {formatRupee(inv.total || inv.total_amount || 0)}
                          </td>
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            <span
                              style={{
                                background: statusInfo.bg,
                                color: statusInfo.color,
                                padding: '4px 12px',
                                borderRadius: 20,
                                fontSize: 11,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {statusInfo.text}
                            </span>
                          </td>
                          <td style={{ padding: 12, textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => {
                                setPreviewInvoice(inv)
                                setShowPreviewModal(true)
                              }}
                              title="Preview"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#6366f1',
                                marginRight: 8,
                                fontSize: 18,
                              }}
                            >
                              <span className="material-icons" style={{ fontSize: 18 }}>
                                visibility
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setBillForPrint({
                                  id: inv.id,
                                  invoiceNumber: inv.invoiceNumber || 'N/A',
                                  customerName: inv.customerName || 'Unknown',
                                  customerEmail: inv.customerEmail || '',
                                  customerPhone: inv.customerPhone || '',
                                  customerAddress: (inv as any).customerAddress || '',
                                  date: inv.date,
                                  dueDate: inv.dueDate,
                                  items: inv.items,
                                  subtotal: inv.subtotal || 0,
                                  taxAmount: inv.taxAmount || 0,
                                  cgst: (inv.taxAmount || 0) / 2,
                                  sgst: (inv.taxAmount || 0) / 2,
                                  total: inv.total || inv.total_amount || 0,
                                  status: (inv.status || 'unpaid') as 'paid' | 'unpaid' | 'partial',
                                  amountPaid: inv.amountPaid,
                                  notes: inv.notes || '',
                                  gstEnabled: true,
                                  isInterState: inv.isInterState,
                                })
                                setShowBillPrintModal(true)
                              }}
                              title="Print / PDF (New)"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#10b981',
                                marginRight: 8,
                              }}
                            >
                              <span className="material-icons" style={{ fontSize: 18 }}>
                                print
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                try {
                                  const pdf = generateInvoicePDF({
                                    id: inv.id,
                                    invoiceNumber: inv.invoiceNumber || 'N/A',
                                    customerName: inv.customerName || 'Unknown',
                                    customerEmail: inv.customerEmail || '',
                                    customerPhone: inv.customerPhone || '',
                                    date: inv.date,
                                    dueDate: inv.dueDate,
                                    items: inv.items.map(item => ({
                                      id: (item as any).id || '',
                                      productName: (item as any).productName || item.product || item.name || 'Item',
                                      quantity: item.quantity,
                                      price: item.price,
                                      total: (item as any).total || (item.quantity * item.price),
                                    })),
                                    subtotal: inv.subtotal || 0,
                                    taxAmount: inv.taxAmount || 0,
                                    total: inv.total || inv.total_amount || 0,
                                    status: (inv.status || 'unpaid') as 'paid' | 'unpaid' | 'partial',
                                    amountPaid: inv.amountPaid,
                                    notes: inv.notes || '',
                                    businessName: businessProfile?.business_name,
                                    businessEmail: businessProfile?.business_email,
                                    businessPhone: businessProfile?.contact_number_1 || businessProfile?.contact_number_2,
                                    businessAddress: businessProfile?.business_address,
                                    gstNumber: businessProfile?.gst_number,
                                    upiId: businessProfile?.upi_id,
                                    isInterState: inv.isInterState,
                                  })
                                  pdf.save(`Invoice_${inv.invoiceNumber}.pdf`)
                                  toast.success(`PDF downloaded for ${inv.invoiceNumber}`)
                                } catch (err) {
                                  console.error('Error generating PDF:', err)
                                  toast.error('Failed to generate PDF')
                                }
                              }}
                              title="Download PDF (Old)"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--primary-blue, #2845D6)',
                                marginRight: 8,
                              }}
                            >
                              <span className="material-icons" style={{ fontSize: 18 }}>
                                download
                              </span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalInvoicePages > 1 && (
                <div style={{ padding: 16, borderTop: '1px solid var(--border-color, #e0e4f8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #999)' }}>
                    Showing {(invoiceCurrentPage - 1) * INVOICES_PER_PAGE + 1} to{' '}
                    {Math.min(invoiceCurrentPage * INVOICES_PER_PAGE, filteredInvoicesForTab.length)} of {filteredInvoicesForTab.length}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setInvoiceCurrentPage(Math.max(1, invoiceCurrentPage - 1))}
                      disabled={invoiceCurrentPage === 1}
                      className="pagination-btn"
                      style={{
                        cursor: invoiceCurrentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: invoiceCurrentPage === 1 ? 0.5 : 1,
                      }}
                    >
                      Previous
                    </button>

                    {Array.from({ length: totalInvoicePages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setInvoiceCurrentPage(page)}
                        className={`pagination-btn${page === invoiceCurrentPage ? ' active' : ''}`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => setInvoiceCurrentPage(Math.min(totalInvoicePages, invoiceCurrentPage + 1))}
                      disabled={invoiceCurrentPage === totalInvoicePages}
                      className="pagination-btn"
                      style={{
                        cursor: invoiceCurrentPage === totalInvoicePages ? 'not-allowed' : 'pointer',
                        opacity: invoiceCurrentPage === totalInvoicePages ? 0.5 : 1,
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Invoice Preview Modal ─────────────────────────────────────── */}
      <InvoicePreviewModalNew
        isOpen={showPreviewModal}
        invoice={previewInvoice ? {
          id: previewInvoice.id,
          invoiceNumber: previewInvoice.invoiceNumber || 'N/A',
          customerName: previewInvoice.customerName || 'Unknown',
          customerEmail: previewInvoice.customerEmail,
          customerPhone: previewInvoice.customerPhone || '',
          customerAddress: (previewInvoice as any).customerAddress || '',
          customerGST: (previewInvoice as any).customerGST || '',
          date: previewInvoice.date,
          dueDate: previewInvoice.dueDate,
          items: previewInvoice.items,
          subtotal: previewInvoice.subtotal || 0,
          taxAmount: previewInvoice.taxAmount || 0,
          total: previewInvoice.total || previewInvoice.total_amount || 0,
          status: (previewInvoice.status || 'unpaid') as 'paid' | 'unpaid' | 'partial',
          amountPaid: previewInvoice.amountPaid,
          notes: previewInvoice.notes || '',
          cgst: (previewInvoice.taxAmount || 0) / 2,
          sgst: (previewInvoice.taxAmount || 0) / 2,
          gstEnabled: true,
          isInterState: previewInvoice.isInterState,
        } : null}
        businessProfile={businessProfile}
        onClose={() => setShowPreviewModal(false)}
      />

      {/* ── Bill Print Modal (New) ───────────────────────────────────── */}
      <BillPrintModal
        isOpen={showBillPrintModal}
        bill={billForPrint}
        businessProfile={businessProfile}
        onClose={() => {
          setShowBillPrintModal(false)
          setBillForPrint(null)
        }}
      />

      {/* ── Purchase Details Modal ────────────────────────────────────── */}
      {selectedPurchase && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}
          onClick={() => setSelectedPurchase(null)}
        >
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', padding: 0, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Purchase Details - {selectedPurchase.purchase_number}</h2>
              <button onClick={() => setSelectedPurchase(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, lineHeight: 1, color: 'var(--text-muted, #999)' }}>&times;</button>
            </div>
            <div style={{ padding: 24 }}>
              {/* Purchase Header Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Supplier</label>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{suppliers.find(s => s.id === selectedPurchase.supplier_id)?.name || 'Unknown'}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Date</label>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{new Date(selectedPurchase.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Total Amount</label>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#10b981' }}>{formatRupee(selectedPurchase.total_amount)}</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</label>
                  <p style={{ margin: 0, fontSize: 14 }}>{selectedPurchase.notes || '—'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginTop: 24 }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600 }}>Items</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>#</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>Item Name</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>HSN Code</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>Quantity</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>Rate</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>GST %</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>Amount</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>GST Amount</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsePurchaseItems(selectedPurchase.items).map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 8px', fontSize: 13, color: 'var(--text-secondary)' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 8px', fontSize: 13, fontWeight: 500 }}>{item.item_name}</td>
                          <td style={{ padding: '10px 8px', fontSize: 13, fontFamily: 'monospace' }}>{item.hsn_code || '—'}</td>
                          <td style={{ padding: '10px 8px', fontSize: 13, textAlign: 'right' }}>{item.quantity}</td>
                          <td style={{ padding: '10px 8px', fontSize: 13, textAlign: 'right' }}>{formatRupee(item.rate)}</td>
                          <td style={{ padding: '10px 8px', fontSize: 13, textAlign: 'center' }}>{item.gst_rate}%</td>
                          <td style={{ padding: '10px 8px', fontSize: 13, textAlign: 'right', fontWeight: 600 }}>{formatRupee(item.amount)}</td>
                          <td style={{ padding: '10px 8px', fontSize: 13, textAlign: 'right' }}>{formatRupee(item.gst_amount)}</td>
                          <td style={{ padding: '10px 8px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatRupee(item.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                        <td colSpan={7} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>Total:</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{formatRupee(parsePurchaseItems(selectedPurchase.items).reduce((sum, item) => sum + (item.gst_amount || 0), 0))}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#10b981' }}>{formatRupee(selectedPurchase.total_amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
