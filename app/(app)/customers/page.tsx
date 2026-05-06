'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/useAPI'
import { useToast } from '@/components/Toast'
import { validateMobile, validateGSTNumber } from '@/lib/validation'
import { supabase } from '@/lib/supabase'
import type { Customer } from '@/lib/supabase'

export default function CustomersPage() {
  return <CustomersContent />
}

function CustomersContent() {
  const router = useRouter()
  const toast = useToast()
  const { data: customers = [], isLoading, isError, error } = useCustomers()
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const deleteMutation = useDeleteCustomer()

  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<Customer>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [activeMobiles, setActiveMobiles] = useState<Set<string>>(new Set())

  // Fetch mobiles of customers who have invoices (active = has transactions)
  useEffect(() => {
    supabase.from('invoices').select('customer_mobile').then(({ data }) => {
      if (data) setActiveMobiles(new Set(data.map((r: any) => r.customer_mobile).filter(Boolean)))
    })
  }, [])

  const stats = useMemo(() => ({
    total: customers.length,
    active: customers.filter(c => c.mobile && activeMobiles.has(c.mobile)).length,
    gst: customers.filter(c => c.gst_number?.trim()).length,
  }), [customers, activeMobiles])

  // Filter customers by search term
  const filtered = useMemo(() => {
    if (!searchTerm) return customers
    const lower = searchTerm.toLowerCase()
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(lower) ||
        c.mobile?.includes(searchTerm) ||
        c.email?.toLowerCase().includes(lower) ||
        c.gst_number?.toLowerCase().includes(lower) ||
        c.address?.toLowerCase().includes(lower)
    )
  }, [customers, searchTerm])

  // Form handlers
  function openNewForm() {
    setEditingId(null)
    setFormData({ name: '', mobile: '', address: '', gst_number: '', email: '' })
    setFormErrors({})
    setShowForm(true)
  }

  function openEditForm(customer: Customer) {
    setEditingId(customer.id)
    setFormData(customer)
    setFormErrors({})
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setFormData({})
    setFormErrors({})
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errors: Record<string, string> = {}

    // Validate
    if (!formData.name?.trim()) errors.name = 'Name is required'
    if (!formData.mobile?.trim()) errors.mobile = 'Mobile is required'
    if (formData.mobile) {
      const mobileVal = validateMobile(formData.mobile)
      if (!mobileVal.ok) errors.mobile = mobileVal.message
    }
    if (formData.address && formData.address.length < 5) errors.address = 'Address too short'
    if (formData.gst_number) {
      const gstVal = validateGSTNumber(formData.gst_number)
      if (!gstVal.ok) errors.gst_number = gstVal.message
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          updates: formData,
        })
        toast.success('Customer updated!')
      } else {
        await createMutation.mutateAsync({
          user_id: '', // Will be set by RLS
          ...formData,
        } as any)
        toast.success('Customer added!')
      }
      closeForm()
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Customer deleted')
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  if (isError)
    return (
      <div className="card" style={{ color: '#dc3545', padding: 32 }}>
        <span className="material-icons" style={{ fontSize: 48, marginBottom: 16 }}>
          error
        </span>
        <p>{error instanceof Error ? error.message : 'Failed to load customers'}</p>
      </div>
    )

  return (
    <div className="page-content">
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card-modern">
          <div className="stat-card-icon blue">
            <span className="material-icons">people</span>
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Total Customers</span>
            <h2 className="stat-card-value">{stats.total}</h2>
            <span className="stat-card-meta">In your database</span>
          </div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-card-icon orange">
            <span className="material-icons">person_check</span>
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Active Customers</span>
            <h2 className="stat-card-value">{stats.active}</h2>
            <span className="stat-card-meta">With recent transactions</span>
          </div>
        </div>
        <div className="stat-card-modern">
          <div className="stat-card-icon green">
            <span className="material-icons">receipt_long</span>
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">GST Registered</span>
            <h2 className="stat-card-value">{stats.gst}</h2>
            <span className="stat-card-meta">Customers with GSTIN</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 24,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Search by name, mobile, email, GST…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '8px 12px',
            border: '1px solid var(--border-color, #e0e4f8)',
            borderRadius: 8,
            fontSize: 14,
          }}
        />
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
          Add Customer
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted, #999)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          Loading customers…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted, #999)' }}>
          <span className="material-icons" style={{ fontSize: 48, marginBottom: 12 }}>
            people_outline
          </span>
          <p>{searchTerm ? 'No customers match your search' : 'No customers yet. Add one to get started.'}</p>
        </div>
      ) : (
        <>
          {/* Desktop: Table View */}
          <div className="card">
            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color, #e0e4f8)' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Name</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Mobile</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Email</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Address</th>
                    <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>GST No.</th>
                    <th style={{ padding: 12, textAlign: 'center', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
                      <td style={{ padding: 12 }}>
                        <strong>{c.name}</strong>
                      </td>
                      <td style={{ padding: 12 }}>{c.mobile}</td>
                      <td style={{ padding: 12, fontSize: 13, color: 'var(--text-secondary, #666)' }}>
                        {c.email || '—'}
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: 'var(--text-secondary, #666)' }}>
                        {c.address ? c.address.substring(0, 40) : '—'}
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: 'var(--text-secondary, #666)' }}>
                        {c.gst_number || '—'}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => router.push(`/customer-ledger?id=${c.id}`)}
                          style={{
                            background: '#28a745',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            marginRight: 4,
                            fontSize: 12,
                          }}
                        >
                          Ledger
                        </button>
                        <button
                          onClick={() => openEditForm(c)}
                          style={{
                            background: 'var(--primary-blue, #2845D6)',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            marginRight: 4,
                            fontSize: 12,
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
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

          {/* Mobile: Card View */}
          <div className="mobile-cards-grid">
            {filtered.map((c) => (
              <div key={c.id} className="mobile-card">
                <div className="mobile-card-header">{c.name}</div>
                <div className="mobile-card-row">
                  <div className="mobile-card-label">Mobile</div>
                  <div className="mobile-card-value">{c.mobile}</div>
                </div>
                {c.email && (
                  <div className="mobile-card-row">
                    <div className="mobile-card-label">Email</div>
                    <div className="mobile-card-value" style={{ fontSize: 12 }}>{c.email}</div>
                  </div>
                )}
                {c.address && (
                  <div className="mobile-card-row">
                    <div className="mobile-card-label">Address</div>
                    <div className="mobile-card-value" style={{ fontSize: 12 }}>{c.address}</div>
                  </div>
                )}
                {c.gst_number && (
                  <div className="mobile-card-row">
                    <div className="mobile-card-label">GST No.</div>
                    <div className="mobile-card-value">{c.gst_number}</div>
                  </div>
                )}
                <div className="mobile-card-actions">
                  <button
                    onClick={() => router.push(`/customer-ledger?id=${c.id}`)}
                    style={{
                      background: '#28a745',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                      flex: 1,
                    }}
                  >
                    Ledger
                  </button>
                  <button
                    onClick={() => openEditForm(c)}
                    style={{
                      background: 'var(--primary-blue, #2845D6)',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                      flex: 1,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    style={{
                      background: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                      flex: 1,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Form */}
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
          }}
          onClick={closeForm}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}
          >
            <div style={{ padding: 24 }}>
              <h2 style={{ marginBottom: 24, marginTop: 0 }}>
                {editingId ? 'Edit Customer' : 'Add Customer'}
              </h2>

              <form onSubmit={handleSubmit}>
                <FormField
                  label="Name *"
                  value={formData.name || ''}
                  onChange={(v) => setFormData({ ...formData, name: v })}
                  error={formErrors.name}
                />
                <FormField
                  label="Mobile *"
                  value={formData.mobile || ''}
                  onChange={(v) => setFormData({ ...formData, mobile: v })}
                  placeholder="10-digit number"
                  error={formErrors.mobile}
                />
                <FormField
                  label="Email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(v) => setFormData({ ...formData, email: v })}
                  placeholder="optional@email.com"
                />
                <FormField
                  label="Address"
                  value={formData.address || ''}
                  onChange={(v) => setFormData({ ...formData, address: v })}
                  placeholder="City, State, Pincode"
                  error={formErrors.address}
                />
                <FormField
                  label="GST Number"
                  value={formData.gst_number || ''}
                  onChange={(v) => setFormData({ ...formData, gst_number: v })}
                  placeholder="22AAAAA0000A1Z5"
                  error={formErrors.gst_number}
                />

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
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
                    {editingId ? 'Update' : 'Add'}
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
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FormField ────────────────────────────────────────────────────────────

function FormField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  error?: string
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: `1px solid ${error ? '#dc3545' : 'var(--border-color, #e0e4f8)'}`,
          borderRadius: 6,
          fontSize: 14,
          boxSizing: 'border-box',
        }}
      />
      {error && <div style={{ color: '#dc3545', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  )
}
