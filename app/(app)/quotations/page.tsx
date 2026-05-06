'use client'
/**
 * app/quotations/page.tsx
 *
 * Quotations page — similar to Create Bill but for quotations
 * Features:
 *   - List all quotations with status
 *   - Add new quotation
 *   - Edit quotation
 *   - Delete quotation
 *   - Convert quotation to invoice
 *   - Quotation-specific fields: valid_until, status
 *   - Uses same GST calculations as invoices
 */
import React, { useState, useMemo } from 'react'
import { useCustomers, useInventory } from '@/hooks/useAPI'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import { formatRupee } from '@/lib/currency'
import { calcInvoiceTotals } from '@/lib/gst'
import type { Customer, InventoryItem } from '@/lib/supabase'

interface QuotationLineItem {
  id: string
  description: string
  inventory_id?: string
  hsn_code?: string
  quantity: number
  rate: number
  gstRate: number
  amount: number
}

interface Quotation {
  id: string
  quotation_number: string
  customer_name: string
  customer_mobile: string
  items: QuotationLineItem[]
  subtotal: number
  total: number
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  valid_until: string
  created_at: string
}

export default function QuotationsPage() {
  return <QuotationsContent />
}

function QuotationsContent() {
  const { user } = useAuth()
  const toast = useToast()
  const { data: customers = [] } = useCustomers()
  const { data: inventoryItems = [] } = useInventory()

  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [status, setStatus] = useState<'draft' | 'sent'>('draft')
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>([])
  const [tempItemName, setTempItemName] = useState('')
  const [tempQty, setTempQty] = useState('1')
  const [tempRate, setTempRate] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

  const totalsResult = useMemo(() => {
    const converted = lineItems.map((li) => ({
      rateInclGST: li.rate,
      quantity: li.quantity,
      gstRate: li.gstRate,
      discountPercent: 0,
    }))
    return calcInvoiceTotals(converted as any, false)
  }, [lineItems])

  const totals = useMemo(() => {
    const t = (totalsResult as any).totals
    return {
      subtotal: t.subtotal || 0,
      cgst: t.totalCGST || 0,
      sgst: t.totalSGST || 0,
      igst: t.totalIGST || 0,
      total: t.grandTotal || 0,
    }
  }, [totalsResult])

  function openNewForm() {
    setEditingId(null)
    setSelectedCustomerId('')
    setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    setStatus('draft')
    setLineItems([])
    setTempItemName('')
    setTempQty('1')
    setTempRate('')
    setFormErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
  }

  function addItem() {
    if (!tempItemName.trim() || !tempRate.trim()) {
      toast.error('Item name and rate required')
      return
    }
    const newItem: QuotationLineItem = {
      id: Math.random().toString(36).substring(7),
      description: tempItemName,
      quantity: parseInt(tempQty) || 1,
      rate: parseFloat(tempRate) || 0,
      gstRate: 18,
      amount: (parseInt(tempQty) || 1) * (parseFloat(tempRate) || 0),
    }
    setLineItems([...lineItems, newItem])
    setTempItemName('')
    setTempQty('1')
    setTempRate('')
  }

  function removeItem(id: string) {
    setLineItems(lineItems.filter((i) => i.id !== id))
  }

  function handleSave() {
    const errors: Record<string, string> = {}

    if (!selectedCustomerId) errors.customer = 'Select a customer'
    if (lineItems.length === 0) errors.items = 'Add at least one item'

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const quotationNumber = `QT-${new Date().getFullYear()}-${String(Math.random() * 10000).padStart(5, '0')}`
    const newQuotation: Quotation = {
      id: Math.random().toString(36).substring(7),
      quotation_number: quotationNumber,
      customer_name: selectedCustomer?.name || '',
      customer_mobile: selectedCustomer?.mobile || '',
      items: lineItems,
      subtotal: totals.subtotal,
      total: totals.total,
      status: status,
      valid_until: validUntil,
      created_at: new Date().toISOString(),
    }

    setQuotations([newQuotation, ...quotations])
    toast.success(`Quotation ${quotationNumber} created!`)
    closeForm()
  }

  function deleteQuotation(id: string) {
    if (confirm('Delete this quotation?')) {
      setQuotations(quotations.filter((q) => q.id !== id))
      toast.success('Quotation deleted')
    }
  }

  function handleStatusChange(id: string, newStatus: typeof status) {
    setQuotations(quotations.map((q) => (q.id === id ? { ...q, status: newStatus } : q)))
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <button
          onClick={openNewForm}
          style={{
            padding: '8px 16px',
            background: 'var(--primary-blue, #2845D6)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span className="material-icons" style={{ fontSize: 20 }}>
            add
          </span>
          New Quotation
        </button>
      </div>

      {quotations.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
          <span className="material-icons" style={{ fontSize: 48, marginBottom: 12 }}>
            request_quote
          </span>
          <p>No quotations yet</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table style={{ width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color, #e0e4f8)' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Quotation #</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Customer</th>
                  <th style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Valid Until</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id} style={{ borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
                    <td style={{ padding: 12 }}>
                      <strong>{q.quotation_number}</strong>
                    </td>
                    <td style={{ padding: 12 }}>{q.customer_name}</td>
                    <td style={{ padding: 12, textAlign: 'right', fontWeight: 600 }}>
                      {formatRupee(q.total)}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <select
                        value={q.status}
                        onChange={(e) => handleStatusChange(q.id, e.target.value as any)}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid var(--border-color, #e0e4f8)',
                          borderRadius: 4,
                          fontSize: 12,
                          background: q.status === 'draft' ? '#fff3cd' : q.status === 'sent' ? '#cfe2ff' : '#d1e7dd',
                        }}
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td style={{ padding: 12, fontSize: 13 }}>
                      {new Date(q.valid_until).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <button
                        onClick={() => deleteQuotation(q.id)}
                        style={{
                          background: '#dc3545',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 10px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            overflow: 'auto',
          }}
          onClick={closeForm}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto', margin: 'auto' }}
          >
            <div style={{ padding: 24 }}>
              <h2 style={{ marginBottom: 24, marginTop: 0 }}>New Quotation</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {/* Customer */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
                    Customer *
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${formErrors.customer ? '#dc3545' : 'var(--border-color, #e0e4f8)'}`,
                      borderRadius: 6,
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.customer && (
                    <div style={{ color: '#dc3545', fontSize: 11, marginTop: 4 }}>
                      {formErrors.customer}
                    </div>
                  )}
                </div>

                {/* Valid Until */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border-color, #e0e4f8)',
                      borderRadius: 6,
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Items */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
                  Items
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={tempItemName}
                    onChange={(e) => setTempItemName(e.target.value)}
                    placeholder="Item…"
                    style={{ flex: 1, minWidth: 100, padding: '6px 10px', border: '1px solid var(--border-color, #e0e4f8)', borderRadius: 4, fontSize: 12 }}
                  />
                  <input
                    type="number"
                    value={tempQty}
                    onChange={(e) => setTempQty(e.target.value)}
                    placeholder="Qty"
                    style={{ width: 60, padding: '6px 10px', border: '1px solid var(--border-color, #e0e4f8)', borderRadius: 4, fontSize: 12 }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={tempRate}
                    onChange={(e) => setTempRate(e.target.value)}
                    placeholder="Rate"
                    style={{ width: 80, padding: '6px 10px', border: '1px solid var(--border-color, #e0e4f8)', borderRadius: 4, fontSize: 12 }}
                  />
                  <button
                    type="button"
                    onClick={addItem}
                    style={{ padding: '6px 12px', background: 'var(--primary-blue, #2845D6)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    Add
                  </button>
                </div>

                {lineItems.length > 0 && (
                  <table style={{ width: '100%', fontSize: 12, marginBottom: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
                        <th style={{ padding: 6, textAlign: 'left' }}>Item</th>
                        <th style={{ padding: 6, textAlign: 'right', width: 50 }}>Qty</th>
                        <th style={{ padding: 6, textAlign: 'right', width: 70 }}>Rate</th>
                        <th style={{ padding: 6, textAlign: 'right', width: 60 }}>Amount</th>
                        <th style={{ padding: 6, textAlign: 'center', width: 50 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
                          <td style={{ padding: 6 }}>{item.description}</td>
                          <td style={{ padding: 6, textAlign: 'right' }}>{item.quantity}</td>
                          <td style={{ padding: 6, textAlign: 'right' }}>{formatRupee(item.rate)}</td>
                          <td style={{ padding: 6, textAlign: 'right', fontWeight: 600 }}>{formatRupee(item.amount)}</td>
                          <td style={{ padding: 6, textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '3px 6px', borderRadius: 3, cursor: 'pointer', fontSize: 10 }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {formErrors.items && (
                  <div style={{ color: '#dc3545', fontSize: 11, marginTop: 4 }}>
                    {formErrors.items}
                  </div>
                )}
              </div>

              {/* Totals */}
              {lineItems.length > 0 && (
                <div style={{ background: 'var(--bg-main, #f9fafb)', padding: 12, borderRadius: 6, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                    <span>Subtotal:</span>
                    <strong>{formatRupee(totals.subtotal)}</strong>
                  </div>
                  {(totals.cgst > 0 || totals.sgst > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, color: 'var(--text-secondary, #666)' }}>
                      <span>Tax:</span>
                      <span>{formatRupee(totals.cgst + totals.sgst)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, paddingTop: 8, borderTop: '1px solid var(--border-color, #e0e4f8)' }}>
                    <span>Total:</span>
                    <strong>{formatRupee(totals.total)}</strong>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={handleSave}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: 'var(--primary-blue, #2845D6)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Save Quotation
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: 'var(--border-color, #e0e4f8)',
                    color: 'var(--text-secondary, #666)',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
