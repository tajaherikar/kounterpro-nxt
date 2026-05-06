'use client'
import React, { useState, useMemo } from 'react'
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, usePurchases, useCreatePurchase, useDeletePurchase, useInventory } from '@/hooks/useAPI'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import type { Supplier, Purchase, PurchaseItem } from '@/lib/supabase'
import { formatRupee } from '@/lib/currency'

export default function SuppliersPage() {
  return <SuppliersContent />
}

const EMPTY_FORM: Partial<Supplier> = {
  name: '', contact_name: '', phone: '', email: '', address: '', gstin: '', notes: '',
}

function SuppliersContent() {
  const { user } = useAuth()
  const toast = useToast()
  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers()
  const { data: purchases = [], isLoading: purchasesLoading } = usePurchases()
  const { data: inventory = [] } = useInventory()
  const createSupplierMutation = useCreateSupplier()
  const updateSupplierMutation = useUpdateSupplier()
  const deleteSupplierMutation = useDeleteSupplier()
  const createPurchaseMutation = useCreatePurchase()
  const deletePurchaseMutation = useDeletePurchase()

  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [deleteSupplierId, setDeleteSupplierId] = useState<string | null>(null)
  const [deletePurchaseId, setDeletePurchaseId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({ ...EMPTY_FORM })
  const [savingSupplier, setSavingSupplier] = useState(false)

  // Purchase state
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
    items: [newLine()],
  })
  const [savingPurchase, setSavingPurchase] = useState(false)

  // Purchase helpers
  function r2(n: number) { return Math.round(n * 100) / 100 }

  function parsePurchaseItems(raw: PurchaseItem[] | string): PurchaseItem[] {
    if (!raw) return []
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) } catch { return [] }
    }
    return raw
  }

  function genPurchaseNumber(existing: Purchase[]): string {
    const now = new Date()
    const yr = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const max = Math.max(0, ...existing.map(p => {
      const m = String(p.purchase_number).match(/PO-\d{4}-\d{2}-(\d+)/)
      return m ? parseInt(m[1]) : 0
    }))
    return `PO-${yr}-${mo}-${String(max + 1).padStart(4, '0')}`
  }

  const GST_RATES = [0, 5, 12, 18, 28]

  type LineItem = {
    id: string
    item_name: string
    inventory_id?: string
    is_new_item: boolean
    hsn_code: string
    quantity: number
    rate: number
    gst_rate: number
  }

  function newLine(): LineItem {
    return {
      id: Math.random().toString(36).slice(2),
      item_name: '', inventory_id: undefined, is_new_item: false,
      hsn_code: '', quantity: 1, rate: 0, gst_rate: 18
    }
  }

  const filteredSuppliers = useMemo(() =>
    suppliers.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone || '').includes(search) ||
      (s.gstin || '').toLowerCase().includes(search.toLowerCase())
    ), [suppliers, search])

  const filteredPurchases = useMemo(() =>
    purchases.filter(p => {
      const supplier = suppliers.find(s => s.id === p.supplier_id)
      return supplier?.name.toLowerCase().includes(search.toLowerCase()) ||
             p.purchase_number.toLowerCase().includes(search.toLowerCase())
    }), [purchases, suppliers, search])

  function openAddSupplier() {
    setEditingSupplierId(null)
    setSupplierForm({ ...EMPTY_FORM })
    setSupplierModalOpen(true)
  }

  function openEditSupplier(s: Supplier) {
    setEditingSupplierId(s.id)
    setSupplierForm({
      name: s.name, contact_name: s.contact_name || '', phone: s.phone || '',
      email: s.email || '', address: s.address || '', gstin: s.gstin || '', notes: s.notes || '',
    })
    setSupplierModalOpen(true)
  }

  function openNewPurchase() {
    setPurchaseForm({
      supplier_id: '',
      purchase_date: new Date().toISOString().split('T')[0],
      notes: '',
      items: [newLine()],
    })
    setPurchaseModalOpen(true)
  }

  async function handleSaveSupplier(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierForm.name?.trim()) { toast.error('Supplier name is required'); return }
    setSavingSupplier(true)
    try {
      if (editingSupplierId) {
        await updateSupplierMutation.mutateAsync({ id: editingSupplierId, updates: supplierForm })
        toast.success('Supplier updated')
      } else {
        await createSupplierMutation.mutateAsync({ ...supplierForm, name: supplierForm.name!, user_id: user!.id } as Omit<Supplier, 'id' | 'created_at' | 'updated_at'>)
        toast.success('Supplier added')
      }
      setSupplierModalOpen(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save supplier')
    } finally {
      setSavingSupplier(false)
    }
  }

  async function handleSavePurchase(e: React.FormEvent) {
    e.preventDefault()
    if (!purchaseForm.supplier_id) { toast.error('Please select a supplier'); return }
    if (purchaseForm.items.length === 0 || purchaseForm.items.every(i => !i.item_name.trim())) {
      toast.error('Please add at least one item'); return
    }

    setSavingPurchase(true)
    try {
      const purchaseNumber = genPurchaseNumber(purchases)
      const totalAmount = purchaseForm.items.reduce((sum, item) => {
        const amount = item.quantity * item.rate
        const gstAmount = amount * (item.gst_rate / 100)
        return sum + amount + gstAmount
      }, 0)

      await createPurchaseMutation.mutateAsync({
        supplier_id: purchaseForm.supplier_id,
        purchase_number: purchaseNumber,
        date: purchaseForm.purchase_date,
        subtotal: r2(totalAmount / (1 + (purchaseForm.items.reduce((sum, item) => sum + item.gst_rate, 0) / purchaseForm.items.length / 100))),
        gst_amount: r2(totalAmount - (totalAmount / (1 + (purchaseForm.items.reduce((sum, item) => sum + item.gst_rate, 0) / purchaseForm.items.length / 100)))),
        total_amount: r2(totalAmount),
        notes: purchaseForm.notes,
        items: purchaseForm.items.map(item => ({
          item_name: item.item_name,
          inventory_id: item.inventory_id || undefined,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          rate: item.rate,
          gst_rate: item.gst_rate,
          amount: r2(item.quantity * item.rate),
          gst_amount: r2(item.quantity * item.rate * (item.gst_rate / 100)),
          total_amount: r2(item.quantity * item.rate * (1 + item.gst_rate / 100)),
        })),
        user_id: user!.id,
      })
      toast.success('Purchase created successfully')
      setPurchaseModalOpen(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create purchase')
    } finally {
      setSavingPurchase(false)
    }
  }

  async function handleDeleteSupplier(id: string) {
    try {
      await deleteSupplierMutation.mutateAsync(id)
      toast.success('Supplier deleted')
    } catch {
      toast.error('Failed to delete supplier')
    } finally {
      setDeleteSupplierId(null)
    }
  }

  async function handleDeletePurchase(id: string) {
    try {
      await deletePurchaseMutation.mutateAsync(id)
      toast.success('Purchase deleted')
    } catch {
      toast.error('Failed to delete purchase')
    } finally {
      setDeletePurchaseId(null)
    }
  }

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Stats bar */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(40,69,214,0.1)' }}>
            <span className="material-icons" style={{ color: '#2845D6' }}>local_shipping</span>
          </div>
          <div>
            <p className="stat-label">Total Suppliers</p>
            <p className="stat-value">{suppliers.length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <span className="material-icons" style={{ color: '#10b981' }}>verified</span>
          </div>
          <div>
            <p className="stat-label">With GST Number</p>
            <p className="stat-value">{suppliers.filter(s => s.gstin).length}</p>
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="card">
        <div className="card-header">
          <h3>
            <span className="material-icons">local_shipping</span>
            Supplier Directory
          </h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" onClick={openAddSupplier} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="material-icons" style={{ fontSize: 18 }}>add</span>
              Add Supplier
            </button>
            <button className="btn-primary" onClick={openNewPurchase} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="material-icons" style={{ fontSize: 18 }}>add_shopping_cart</span>
              New Purchase
            </button>
          </div>
        </div>

        <div className="card-body">
          {/* Search */}
          <div className="search-input-wrapper" style={{ marginBottom: 16, maxWidth: 360 }}>
            <span className="material-icons search-icon">search</span>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name, phone or GST..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>

          {suppliersLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              <span className="material-icons" style={{ fontSize: 40, opacity: 0.3 }}>local_shipping</span>
              <p>Loading suppliers...</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              <span className="material-icons" style={{ fontSize: 48, opacity: 0.3 }}>local_shipping</span>
              <p style={{ marginTop: 12 }}>{search ? 'No suppliers match your search' : 'No suppliers yet — add your first supplier'}</p>
              {!search && (
                <button className="btn-primary" onClick={openAddSupplier} style={{ marginTop: 16 }}>
                  Add Supplier
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop: Table View */}
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>Contact</th>
                      <th>Phone</th>
                      <th>GSTIN</th>
                      <th>Address</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map(s => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          {s.email && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.email}</div>}
                        </td>
                        <td>{s.contact_name || '—'}</td>
                        <td>{s.phone || '—'}</td>
                        <td>
                          {s.gstin ? (
                            <span className="badge badge-success">{s.gstin}</span>
                          ) : '—'}
                        </td>
                        <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.address || '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn-icon" onClick={() => openEditSupplier(s)} title="Edit">
                            <span className="material-icons">edit</span>
                          </button>
                          <button className="btn-icon btn-danger" onClick={() => setDeleteSupplierId(s.id)} title="Delete">
                            <span className="material-icons">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Card View */}
              <div className="mobile-cards-grid">
                {filteredSuppliers.map(s => (
                  <div key={s.id} className="mobile-card">
                    <div className="mobile-card-header" style={{ fontSize: 14, fontWeight: 700 }}>
                      {s.name}
                    </div>
                    {s.email && (
                      <div className="mobile-card-row">
                        <div className="mobile-card-label">Email</div>
                        <div className="mobile-card-value" style={{ fontSize: 12 }}>{s.email}</div>
                      </div>
                    )}
                    <div className="mobile-card-row">
                      <div className="mobile-card-label">Contact</div>
                      <div className="mobile-card-value">{s.contact_name || '—'}</div>
                    </div>
                    <div className="mobile-card-row">
                      <div className="mobile-card-label">Phone</div>
                      <div className="mobile-card-value">{s.phone || '—'}</div>
                    </div>
                    {s.gstin && (
                      <div className="mobile-card-row">
                        <div className="mobile-card-label">GSTIN</div>
                        <div className="mobile-card-value">
                          <span className="badge badge-success">{s.gstin}</span>
                        </div>
                      </div>
                    )}
                    {s.address && (
                      <div className="mobile-card-row">
                        <div className="mobile-card-label">Address</div>
                        <div className="mobile-card-value" style={{ fontSize: 12 }}>{s.address}</div>
                      </div>
                    )}
                    <div className="mobile-card-actions">
                      <button className="btn-icon" onClick={() => openEditSupplier(s)} title="Edit" style={{ flex: 1 }}>
                        <span className="material-icons" style={{ fontSize: 18 }}>edit</span>
                      </button>
                      <button className="btn-icon btn-danger" onClick={() => setDeleteSupplierId(s.id)} title="Delete" style={{ flex: 1 }}>
                        <span className="material-icons" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Supplier Modal */}
      {supplierModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}
          onClick={() => setSupplierModalOpen(false)}
        >
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto', padding: 0, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editingSupplierId ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button onClick={() => setSupplierModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, lineHeight: 1, color: 'var(--text-muted, #999)' }}>&times;</button>
            </div>
            <form onSubmit={handleSaveSupplier} style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Supplier / Company Name *</label>
                  <input
                    style={{ width: '100%', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--border-color,#e0e4f8)', borderRadius: 6, background: 'var(--bg-input, transparent)', color: 'inherit' }}
                    value={supplierForm.name || ''}
                    onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. ABC Wholesale Pvt Ltd"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Contact Person</label>
                  <input
                    style={{ width: '100%', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--border-color,#e0e4f8)', borderRadius: 6, background: 'var(--bg-input, transparent)', color: 'inherit' }}
                    value={supplierForm.contact_name || ''}
                    onChange={e => setSupplierForm(f => ({ ...f, contact_name: e.target.value }))}
                    placeholder="Owner / rep name"
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Phone</label>
                  <input
                    style={{ width: '100%', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--border-color,#e0e4f8)', borderRadius: 6, background: 'var(--bg-input, transparent)', color: 'inherit' }}
                    value={supplierForm.phone || ''}
                    onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Mobile number"
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Email</label>
                  <input
                    type="email"
                    style={{ width: '100%', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--border-color,#e0e4f8)', borderRadius: 6, background: 'var(--bg-input, transparent)', color: 'inherit' }}
                    value={supplierForm.email || ''}
                    onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="supplier@email.com"
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>GSTIN</label>
                  <input
                    style={{ width: '100%', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--border-color,#e0e4f8)', borderRadius: 6, background: 'var(--bg-input, transparent)', color: 'inherit', fontFamily: 'monospace', letterSpacing: 1 }}
                    value={supplierForm.gstin || ''}
                    onChange={e => setSupplierForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                    placeholder="22XXXXX0000X1ZX"
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Address</label>
                  <textarea
                    style={{ width: '100%', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--border-color,#e0e4f8)', borderRadius: 6, background: 'var(--bg-input, transparent)', color: 'inherit', resize: 'vertical' }}
                    value={supplierForm.address || ''}
                    onChange={e => setSupplierForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Full address"
                    rows={2}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Notes</label>
                  <textarea
                    style={{ width: '100%', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--border-color,#e0e4f8)', borderRadius: 6, background: 'var(--bg-input, transparent)', color: 'inherit', resize: 'vertical' }}
                    value={supplierForm.notes || ''}
                    onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any notes about this supplier"
                    rows={2}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="submit" disabled={savingSupplier} style={{ flex: 1, padding: '10px 16px', background: 'var(--primary-blue, #2845D6)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  {savingSupplier ? 'Saving...' : editingSupplierId ? 'Update Supplier' : 'Add Supplier'}
                </button>
                <button type="button" onClick={() => setSupplierModalOpen(false)} style={{ flex: 1, padding: '10px 16px', background: 'var(--border-color, #e0e4f8)', color: 'var(--text-secondary, #666)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Purchase Modal */}
      {purchaseModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}
          onClick={() => setPurchaseModalOpen(false)}
        >
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 800, maxHeight: '92vh', overflowY: 'auto', padding: 0, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New Purchase</h2>
              <button onClick={() => setPurchaseModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, lineHeight: 1, color: 'var(--text-muted, #999)' }}>&times;</button>
            </div>
            <form onSubmit={handleSavePurchase} style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Supplier *</label>
                  <select
                    style={{ width: '100%', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--border-color,#e0e4f8)', borderRadius: 6, background: 'var(--bg-input, transparent)', color: 'inherit' }}
                    value={purchaseForm.supplier_id}
                    onChange={e => setPurchaseForm(f => ({ ...f, supplier_id: e.target.value }))}
                    required
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Purchase Date</label>
                  <input
                    type="date"
                    style={{ width: '100%', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--border-color,#e0e4f8)', borderRadius: 6, background: 'var(--bg-input, transparent)', color: 'inherit' }}
                    value={purchaseForm.purchase_date}
                    onChange={e => setPurchaseForm(f => ({ ...f, purchase_date: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>Notes</label>
                  <textarea
                    style={{ width: '100%', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box', border: '1px solid var(--border-color,#e0e4f8)', borderRadius: 6, background: 'var(--bg-input, transparent)', color: 'inherit', resize: 'vertical' }}
                    value={purchaseForm.notes}
                    onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Purchase notes"
                    rows={2}
                  />
                </div>
              </div>

              {/* Purchase Items */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Items</h3>
                  <button
                    type="button"
                    onClick={() => setPurchaseForm(f => ({ ...f, items: [...f.items, newLine()] }))}
                    style={{ padding: '6px 12px', background: 'var(--primary-blue)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                  >
                    Add Item
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Item Name</th>
                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Inventory Item</th>
                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>HSN Code</th>
                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>Qty</th>
                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>Rate</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600, fontSize: 13 }}>GST %</th>
                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>Amount</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600, fontSize: 13 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseForm.items.map((item, index) => {
                        const amount = r2(item.quantity * item.rate)
                        const gstAmount = r2(amount * (item.gst_rate / 100))
                        const total = r2(amount + gstAmount)
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px' }}>
                              <input
                                style={{ width: '100%', padding: '4px 8px', fontSize: 14, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-input)', color: 'inherit' }}
                                value={item.item_name}
                                onChange={e => {
                                  const newItems = [...purchaseForm.items]
                                  newItems[index].item_name = e.target.value
                                  setPurchaseForm(f => ({ ...f, items: newItems }))
                                }}
                                placeholder="Item name"
                              />
                            </td>
                            <td style={{ padding: '8px' }}>
                              <select
                                style={{ width: '100%', padding: '4px 8px', fontSize: 14, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-input)', color: 'inherit' }}
                                value={item.inventory_id || ''}
                                onChange={e => {
                                  const newItems = [...purchaseForm.items]
                                  newItems[index].inventory_id = e.target.value || undefined
                                  setPurchaseForm(f => ({ ...f, items: newItems }))
                                }}
                              >
                                <option value="">Select from inventory</option>
                                {inventory.map(inv => (
                                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '8px' }}>
                              <input
                                style={{ width: '100%', padding: '4px 8px', fontSize: 14, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-input)', color: 'inherit' }}
                                value={item.hsn_code}
                                onChange={e => {
                                  const newItems = [...purchaseForm.items]
                                  newItems[index].hsn_code = e.target.value
                                  setPurchaseForm(f => ({ ...f, items: newItems }))
                                }}
                                placeholder="HSN"
                              />
                            </td>
                            <td style={{ padding: '8px' }}>
                              <input
                                type="number"
                                step="0.01"
                                style={{ width: '100%', padding: '4px 8px', fontSize: 14, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-input)', color: 'inherit', textAlign: 'right' }}
                                value={item.quantity}
                                onChange={e => {
                                  const newItems = [...purchaseForm.items]
                                  newItems[index].quantity = parseFloat(e.target.value) || 0
                                  setPurchaseForm(f => ({ ...f, items: newItems }))
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px' }}>
                              <input
                                type="number"
                                step="0.01"
                                style={{ width: '100%', padding: '4px 8px', fontSize: 14, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-input)', color: 'inherit', textAlign: 'right' }}
                                value={item.rate}
                                onChange={e => {
                                  const newItems = [...purchaseForm.items]
                                  newItems[index].rate = parseFloat(e.target.value) || 0
                                  setPurchaseForm(f => ({ ...f, items: newItems }))
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px' }}>
                              <select
                                style={{ width: '100%', padding: '4px 8px', fontSize: 14, border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-input)', color: 'inherit' }}
                                value={item.gst_rate}
                                onChange={e => {
                                  const newItems = [...purchaseForm.items]
                                  newItems[index].gst_rate = parseInt(e.target.value) || 0
                                  setPurchaseForm(f => ({ ...f, items: newItems }))
                                }}
                              >
                                {GST_RATES.map(rate => (
                                  <option key={rate} value={rate}>{rate}%</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                              {formatRupee(total)}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const newItems = purchaseForm.items.filter((_, i) => i !== index)
                                  setPurchaseForm(f => ({ ...f, items: newItems }))
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18 }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                        <td colSpan={6} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>Total Amount:</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontSize: 16 }}>
                          {formatRupee(purchaseForm.items.reduce((sum, item) => {
                            const amount = item.quantity * item.rate
                            const gstAmount = amount * (item.gst_rate / 100)
                            return sum + amount + gstAmount
                          }, 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" disabled={savingPurchase} style={{ flex: 1, padding: '10px 16px', background: 'var(--primary-blue, #2845D6)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  {savingPurchase ? 'Creating...' : 'Create Purchase'}
                </button>
                <button type="button" onClick={() => setPurchaseModalOpen(false)} style={{ flex: 1, padding: '10px 16px', background: 'var(--border-color, #e0e4f8)', color: 'var(--text-secondary, #666)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Supplier Confirm */}
      {deleteSupplierId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}
          onClick={() => setDeleteSupplierId(null)}
        >
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 400, padding: 0, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Delete Supplier</h2>
              <button onClick={() => setDeleteSupplierId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, lineHeight: 1, color: 'var(--text-muted, #999)' }}>&times;</button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)' }}>Are you sure you want to delete this supplier? This cannot be undone.</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => handleDeleteSupplier(deleteSupplierId)}
                  style={{ flex: 1, padding: '10px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteSupplierId(null)}
                  style={{ flex: 1, padding: '10px 16px', background: 'var(--border-color, #e0e4f8)', color: 'var(--text-secondary, #666)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Purchase Confirm */}
      {deletePurchaseId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}
          onClick={() => setDeletePurchaseId(null)}
        >
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 400, padding: 0, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-color, #e0e4f8)' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Delete Purchase</h2>
              <button onClick={() => setDeletePurchaseId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, lineHeight: 1, color: 'var(--text-muted, #999)' }}>&times;</button>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)' }}>Are you sure you want to delete this purchase? This cannot be undone.</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => handleDeletePurchase(deletePurchaseId)}
                  style={{ flex: 1, padding: '10px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeletePurchaseId(null)}
                  style={{ flex: 1, padding: '10px 16px', background: 'var(--border-color, #e0e4f8)', color: 'var(--text-secondary, #666)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
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
