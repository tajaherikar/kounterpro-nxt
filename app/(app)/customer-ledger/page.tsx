'use client'
import React, { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { useToast } from '@/components/Toast'
import { formatRupee } from '@/lib/currency'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface CustomerRow {
  id: string
  name: string
  mobile: string
  email: string
  address: string
  gst_number: string
}

interface InvoiceRow {
  id: string
  invoice_number: string
  date: string
  total_amount: number
  payment_status: 'unpaid' | 'partial' | 'paid'
  amount_paid: number
  amount_due: number
  customer_name: string
  customer_mobile: string
}

export default function CustomerLedgerPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: '#999' }}>Loading…</div>}>
      <CustomerLedgerContent />
    </Suspense>
  )
}

function CustomerLedgerContent() {
  const searchParams = useSearchParams()
  const toast = useToast()

  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customersLoading, setCustomersLoading] = useState(true)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  const [showPayment, setShowPayment] = useState(false)
  const [payInvoiceId, setPayInvoiceId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('Cash')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payLoading, setPayLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setCustomersLoading(true)
      const { data } = await supabase.from('customers').select('*').order('name')
      setCustomers(data || [])
      setCustomersLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const id = searchParams.get('id')
    if (id) setSelectedCustomerId(id)
  }, [searchParams, customers])

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  )

  useEffect(() => {
    if (!selectedCustomer?.mobile) {
      setInvoices([])
      return
    }
    async function loadInvoices() {
      setInvoicesLoading(true)
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, date, total_amount, payment_status, amount_paid, amount_due, customer_name, customer_mobile')
        .eq('customer_mobile', selectedCustomer!.mobile)
        .order('date', { ascending: false })
      setInvoices(data || [])
      setInvoicesLoading(false)
    }
    loadInvoices()
  }, [selectedCustomer])

  const stats = useMemo(() => {
    if (!invoices.length) return { outstanding: 0, totalSpent: 0, lastPurchase: '', avgOrder: 0, count: 0 }
    const outstanding = invoices.reduce((s, inv) => s + (inv.amount_due || 0), 0)
    const totalSpent = invoices.reduce((s, inv) => s + (inv.total_amount || 0), 0)
    const dates = invoices.map((inv) => inv.date).filter(Boolean).sort()
    const lastPurchase = dates[dates.length - 1] || ''
    const avgOrder = totalSpent / invoices.length
    return { outstanding, totalSpent, lastPurchase, avgOrder, count: invoices.length }
  }, [invoices])

  const monthlyData = useMemo(() => {
    const map = new Map<string, number>()
    invoices.forEach((inv) => {
      if (!inv.date) return
      const key = inv.date.slice(0, 7)
      map.set(key, (map.get(key) || 0) + (inv.total_amount || 0))
    })
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, total]) => ({
        month: new Date(month + '-01').toLocaleString('default', { month: 'short', year: '2-digit' }),
        total,
      }))
  }, [invoices])

  const pendingInvoices = useMemo(
    () => invoices.filter((inv) => inv.payment_status !== 'paid'),
    [invoices]
  )

  function openPaymentModal(invoiceId = '') {
    setPayInvoiceId(invoiceId)
    setPayAmount('')
    setPayMethod('Cash')
    setPayDate(new Date().toISOString().slice(0, 10))
    setShowPayment(true)
  }

  async function handleRecordPayment() {
    if (!payInvoiceId) { toast.error('Select an invoice'); return }
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }

    const inv = invoices.find((i) => i.id === payInvoiceId)
    if (!inv) return

    const newAmountPaid = (inv.amount_paid || 0) + amount
    const newAmountDue = Math.max(0, (inv.total_amount || 0) - newAmountPaid)
    const newStatus: 'paid' | 'partial' | 'unpaid' =
      newAmountDue <= 0 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid'

    setPayLoading(true)
    const { error } = await supabase
      .from('invoices')
      .update({ amount_paid: newAmountPaid, amount_due: newAmountDue, payment_status: newStatus })
      .eq('id', payInvoiceId)
    setPayLoading(false)

    if (error) { toast.error('Failed: ' + error.message); return }
    toast.success('Payment recorded!')
    setShowPayment(false)

    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, date, total_amount, payment_status, amount_paid, amount_due, customer_name, customer_mobile')
      .eq('customer_mobile', selectedCustomer!.mobile)
      .order('date', { ascending: false })
    setInvoices(data || [])
  }

  function handleExportCSV() {
    if (!invoices.length || !selectedCustomer) return
    const rows = [
      ['Invoice No', 'Date', 'Total', 'Paid', 'Due', 'Status'].join(','),
      ...invoices.map((inv) =>
        [inv.invoice_number, inv.date, inv.total_amount, inv.amount_paid, inv.amount_due, inv.payment_status].join(',')
      ),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ledger-${selectedCustomer.name.replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-content">
      {/* Customer selector */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>
          Select Customer
        </label>
        <select
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
          disabled={customersLoading}
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '8px 12px',
            border: '1px solid var(--border-color, #e0e4f8)',
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <option value="">— Select a customer —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.mobile ? ` (${c.mobile})` : ''}
            </option>
          ))}
        </select>
      </div>

      {!selectedCustomer ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
          <span className="material-icons" style={{ fontSize: 56, marginBottom: 12 }}>person_search</span>
          <p>Select a customer to view their ledger</p>
        </div>
      ) : (
        <>
          {/* Customer Info Card */}
          <div className="card" style={{ padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, marginBottom: 8, fontSize: 20, fontWeight: 700 }}>
                  {selectedCustomer.name}
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {selectedCustomer.mobile && (
                    <span style={{ fontSize: 14, color: 'var(--text-secondary, #666)' }}>
                      <span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>phone</span>
                      {selectedCustomer.mobile}
                    </span>
                  )}
                  {selectedCustomer.email && (
                    <span style={{ fontSize: 14, color: 'var(--text-secondary, #666)' }}>
                      <span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>email</span>
                      {selectedCustomer.email}
                    </span>
                  )}
                  {selectedCustomer.gst_number && (
                    <span style={{ fontSize: 14, color: 'var(--text-secondary, #666)' }}>
                      <span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>receipt_long</span>
                      GST: {selectedCustomer.gst_number}
                    </span>
                  )}
                  {selectedCustomer.address && (
                    <span style={{ fontSize: 14, color: 'var(--text-secondary, #666)' }}>
                      <span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>location_on</span>
                      {selectedCustomer.address}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => openPaymentModal()}
                  style={{
                    padding: '8px 14px', background: '#28a745', color: '#fff', border: 'none',
                    borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 18 }}>payments</span>
                  Record Payment
                </button>
                <button
                  onClick={handleExportCSV}
                  style={{
                    padding: '8px 14px', background: 'var(--border-color, #e0e4f8)', color: 'var(--text-secondary, #555)',
                    border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 18 }}>download</span>
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {invoicesLoading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted, #999)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              Loading invoices…
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="fin-card profit-negative">
                  <div className="fin-card-header">
                    <span className="fin-card-label">Outstanding</span>
                    <div className="fin-card-icon"><span className="material-icons">pending</span></div>
                  </div>
                  <div className="fin-card-value">{formatRupee(stats.outstanding)}</div>
                </div>
                <div className="fin-card expenses">
                  <div className="fin-card-header">
                    <span className="fin-card-label">Total Spent</span>
                    <div className="fin-card-icon"><span className="material-icons">shopping_cart</span></div>
                  </div>
                  <div className="fin-card-value">{formatRupee(stats.totalSpent)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #999)', marginTop: 4 }}>
                    {stats.count} invoice{stats.count !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="fin-card profit">
                  <div className="fin-card-header">
                    <span className="fin-card-label">Last Purchase</span>
                    <div className="fin-card-icon"><span className="material-icons">calendar_today</span></div>
                  </div>
                  <div className="fin-card-value" style={{ fontSize: 18 }}>
                    {stats.lastPurchase
                      ? new Date(stats.lastPurchase).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
                      : '—'}
                  </div>
                </div>
                <div className="fin-card sales">
                  <div className="fin-card-header">
                    <span className="fin-card-label">Avg Order</span>
                    <div className="fin-card-icon"><span className="material-icons">trending_up</span></div>
                  </div>
                  <div className="fin-card-value">{formatRupee(stats.avgOrder)}</div>
                </div>
              </div>

              {/* Monthly Chart */}
              {monthlyData.length > 0 && (
                <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                  <h3 style={{ margin: 0, marginBottom: 16, fontSize: 14, fontWeight: 600 }}>Monthly Purchases</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => [formatRupee(Number(v ?? 0)), 'Sales']} />
                      <Bar dataKey="total" fill="#2845D6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Invoice History */}
              {invoices.length === 0 ? (
                <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
                  <span className="material-icons" style={{ fontSize: 48, marginBottom: 12 }}>receipt_long</span>
                  <p>No invoices found for this customer</p>
                </div>
              ) : (
                <div className="card">
                  <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--border-color, #e0e4f8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Invoice History</h3>
                    <span style={{ fontSize: 13, color: 'var(--text-muted, #999)' }}>
                      {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="table-responsive">
                    <table style={{ width: '100%' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color, #e0e4f8)', background: 'var(--bg-main, #f9fafb)' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Invoice #</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Date</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>Amount</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>Paid</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>Due</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, fontSize: 13 }}>Status</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, fontSize: 13 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
                            <td style={{ padding: '10px 16px', fontWeight: 600, fontSize: 13 }}>
                              {inv.invoice_number || '—'}
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary, #666)' }}>
                              {inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '—'}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                              {formatRupee(inv.total_amount)}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, color: '#28a745' }}>
                              {formatRupee(inv.amount_paid || 0)}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, color: (inv.amount_due || 0) > 0 ? '#dc3545' : '#28a745' }}>
                              {formatRupee(inv.amount_due || 0)}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                              <StatusBadge status={inv.payment_status} />
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                              {inv.payment_status !== 'paid' && (
                                <button
                                  onClick={() => openPaymentModal(inv.id)}
                                  style={{
                                    background: '#28a74515', color: '#28a745',
                                    border: '1px solid #28a74540', padding: '4px 10px',
                                    borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                  }}
                                >
                                  Pay
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Record Payment Modal */}
      {showPayment && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowPayment(false)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90%', maxWidth: 460, padding: 28 }}
          >
            <h2 style={{ margin: 0, marginBottom: 24, fontSize: 18 }}>Record Payment</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Invoice *</label>
              <select
                value={payInvoiceId}
                onChange={(e) => setPayInvoiceId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color, #e0e4f8)', borderRadius: 6, fontSize: 14 }}
              >
                <option value="">— Select invoice —</option>
                {pendingInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number || inv.id.slice(0, 8)} — Due: {formatRupee(inv.amount_due || 0)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Amount (₹) *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Enter amount"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color, #e0e4f8)', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color, #e0e4f8)', borderRadius: 6, fontSize: 14 }}
                >
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Card</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Date</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color, #e0e4f8)', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleRecordPayment}
                disabled={payLoading}
                style={{ flex: 1, padding: '10px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                {payLoading ? 'Saving…' : 'Record Payment'}
              </button>
              <button
                onClick={() => setShowPayment(false)}
                style={{ flex: 1, padding: '10px 16px', background: 'var(--border-color, #e0e4f8)', color: 'var(--text-secondary, #666)', border: 'none', borderRadius: 8, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    paid:    { bg: '#d1fae5', color: '#065f46' },
    partial: { bg: '#fed7aa', color: '#9a3412' },
    unpaid:  { bg: '#fee2e2', color: '#991b1b' },
  }
  const s = map[status] || { bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
    }}>
      {status}
    </span>
  )
}
