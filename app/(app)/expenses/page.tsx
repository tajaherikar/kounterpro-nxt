'use client'
/**
 * app/expenses/page.tsx
 *
 * Expenses page — track business expenses
 * Features:
 *   - Summary stats: Total, This Month, Top Category
 *   - Monthly trend line chart
 *   - Category pie/doughnut chart
 *   - Expenses table (date, description, category, amount, actions)
 *   - Add / Edit / Delete via modal
 *   - Export CSV
 *   - Supabase persistence
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend,
} from 'recharts'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import { formatRupee } from '@/lib/currency'
import { supabase } from '@/lib/supabase'


// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  { value: 'Supplies',      emoji: '📦' },
  { value: 'Labor',         emoji: '👷' },
  { value: 'Utilities',     emoji: '💡' },
  { value: 'Transport',     emoji: '🚚' },
  { value: 'Rent',          emoji: '🏠' },
  { value: 'Other',         emoji: '📌' },
  { value: 'Miscellaneous', emoji: '🔧' },
]

const CHART_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f',
  '#3498db', '#9b59b6', '#1abc9c', '#2ecc71',
]

function catLabel(value: string) {
  const found = EXPENSE_CATEGORIES.find((c) => c.value === value)
  return found ? `${found.emoji} ${found.value}` : value
}

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
interface Expense {
  id: string
  description: string
  category: string
  amount: number
  date: string
  created_at?: string
}

// ─────────────────────────────────────────────────────────────────
// Modal component
// ─────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  formData: Partial<Expense>
  onChange: (patch: Partial<Expense>) => void
  errors: Record<string, string>
  saving: boolean
}

function ExpenseModal({ open, title, onClose, onSubmit, formData, onChange, errors, saving }: ModalProps) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1050,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%', maxWidth: 480,
          maxHeight: '92vh', overflowY: 'auto',
          padding: 0, borderRadius: 12,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color, #e0e4f8)',
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 24, lineHeight: 1, color: 'var(--text-muted, #999)',
            }}
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} style={{ padding: 24 }}>
          {/* Amount */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
              <span className="material-icons" style={{ fontSize: 16, color: 'var(--text-muted,#999)' }}>vignette</span>
              Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount ?? ''}
              onChange={(e) => onChange({ amount: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              style={{
                width: '100%', padding: '8px 12px', fontSize: 14,
                boxSizing: 'border-box',
                border: `1px solid ${errors.amount ? '#dc3545' : 'var(--border-color,#e0e4f8)'}`,
                borderRadius: 6,
                background: 'var(--bg-input, transparent)', color: 'inherit',
              }}
            />
            {errors.amount && <div style={{ color: '#dc3545', fontSize: 12, marginTop: 4 }}>{errors.amount}</div>}
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
              <span className="material-icons" style={{ fontSize: 16, color: 'var(--text-muted,#999)' }}>description</span>
              Description *
            </label>
            <input
              type="text"
              value={formData.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="e.g. Office supplies"
              style={{
                width: '100%', padding: '8px 12px', fontSize: 14,
                boxSizing: 'border-box',
                border: `1px solid ${errors.description ? '#dc3545' : 'var(--border-color,#e0e4f8)'}`,
                borderRadius: 6,
                background: 'var(--bg-input, transparent)', color: 'inherit',
              }}
            />
            {errors.description && <div style={{ color: '#dc3545', fontSize: 12, marginTop: 4 }}>{errors.description}</div>}
          </div>

          {/* Category */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
              <span className="material-icons" style={{ fontSize: 16, color: 'var(--text-muted,#999)' }}>category</span>
              Category *
            </label>
            <select
              value={formData.category ?? ''}
              onChange={(e) => onChange({ category: e.target.value })}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 14,
                boxSizing: 'border-box',
                border: '1px solid var(--border-color,#e0e4f8)',
                borderRadius: 6,
                background: 'var(--bg-card, #fff)', color: 'inherit',
              }}
            >
              <option value="">Select Category</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>
              ))}
            </select>
            {errors.category && <div style={{ color: '#dc3545', fontSize: 12, marginTop: 4 }}>{errors.category}</div>}
          </div>

          {/* Date */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
              <span className="material-icons" style={{ fontSize: 16, color: 'var(--text-muted,#999)' }}>calendar_today</span>
              Date *
            </label>
            <input
              type="date"
              value={formData.date ?? ''}
              onChange={(e) => onChange({ date: e.target.value })}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 14,
                boxSizing: 'border-box',
                border: '1px solid var(--border-color,#e0e4f8)',
                borderRadius: 6,
                background: 'var(--bg-input, transparent)', color: 'inherit',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '10px 16px',
                background: 'var(--border-color,#e0e4f8)',
                color: 'var(--text-secondary,#666)',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>cancel</span>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1, padding: '10px 16px',
                background: 'var(--primary-blue,#2845D6)',
                color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: saving ? 0.7 : 1,
              }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>save</span>
              {saving ? 'Saving…' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  return <ExpensesContent />
}

function ExpensesContent() {
  const { user } = useAuth()
  const toast = useToast()

  const [mounted, setMounted] = useState(false)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Partial<Expense>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // ── Load ─────────────────────────────────────────────────────
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          toast.error(err.message)
        } else {
          setExpenses(
            (data || []).map((e: any) => ({
              id: e.id,
              description: e.description || '',
              category: e.category || 'Other',
              amount: parseFloat(e.amount) || 0,
              date: e.date || (e.created_at ? e.created_at.split('T')[0] : ''),
              created_at: e.created_at,
            }))
          )
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [user?.id, toast])

  // ── Derived data ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0)
    const now = new Date()
    const thisMonth = expenses
      .filter((e) => {
        const d = new Date(e.date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((s, e) => s + e.amount, 0)
    const byCat: Record<string, number> = {}
    expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount })
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]
    return { total, thisMonth, byCat, top, count: expenses.length }
  }, [expenses])

  const monthlyData = useMemo(() => {
    const map: Record<string, { label: string; amount: number }> = {}
    expenses.forEach((e) => {
      const d = new Date(e.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map[key]) map[key] = { label: d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short' }), amount: 0 }
      map[key].amount += e.amount
    })
    return Object.keys(map).sort().map((k) => ({ ...map[k], amount: Math.round(map[k].amount) }))
  }, [expenses])

  const pieData = useMemo(() =>
    Object.entries(stats.byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name: catLabel(name), value: Math.round(value) })),
  [stats.byCat])

  const sorted = useMemo(() =>
    [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [expenses])

  // ── Modal ────────────────────────────────────────────────────
  function openAdd() {
    setEditingId(null)
    setFormData({
      description: '',
      category: EXPENSE_CATEGORIES[0].value,
      amount: undefined,
      date: new Date().toISOString().split('T')[0],
    })
    setFormErrors({})
    setModalOpen(true)
  }

  function openEdit(exp: Expense) {
    setEditingId(exp.id)
    setFormData({ ...exp })
    setFormErrors({})
    setModalOpen(true)
  }

  function closeModal() { if (!saving) setModalOpen(false) }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!formData.amount || formData.amount <= 0) errs.amount = 'Amount must be greater than 0'
    if (!formData.description?.trim())            errs.description = 'Description is required'
    if (!formData.category)                       errs.category = 'Category is required'
    if (Object.keys(errs).length) { setFormErrors(errs); return }

    setSaving(true)
    const payload = {
      description: formData.description!.trim(),
      category:    formData.category!,
      amount:      formData.amount!,
      date:        formData.date || new Date().toISOString().split('T')[0],
    }
    try {
      if (editingId) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editingId)
        if (error) throw error
        setExpenses((prev) => prev.map((x) => (x.id === editingId ? { ...x, ...payload } : x)))
        toast.success('Expense updated!')
      } else {
        const { data, error } = await supabase.from('expenses').insert([payload]).select()
        if (error) throw error
        setExpenses((prev) => [{ id: data![0].id, ...payload, created_at: data![0].created_at }, ...prev])
        toast.success('Expense added!')
      }
      setModalOpen(false)
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, editingId, toast])

  async function handleDelete(id: string, description: string) {
    if (!confirm(`Delete "${description}"?`)) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error(`Delete failed: ${error.message}`); return }
    setExpenses((prev) => prev.filter((x) => x.id !== id))
    toast.success('Expense deleted')
  }

  function exportCSV() {
    if (!expenses.length) { toast.error('No expenses to export'); return }
    const rows = [
      'Expense Report',
      `Generated: ${new Date().toLocaleDateString('en-IN')}`,
      '',
      'Date,Description,Category,Amount',
      ...sorted.map((e) =>
        `"${new Date(e.date).toLocaleDateString('en-IN')}","${e.description}","${e.category}",${e.amount}`
      ),
      '',
      `Total,,,${expenses.reduce((s, e) => s + e.amount, 0)}`,
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported to CSV')
  }

  const rupeeFmt = (v: number) => `₹${v.toLocaleString('en-IN')}`

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted,#999)' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        Loading expenses…
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: '#dc3545', marginBottom: 16 }}>{error}</p>
        <button onClick={() => window.location.reload()}
          style={{ padding: '8px 20px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="page-content">
      {/* ── Action Buttons ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={openAdd}
          style={{
            padding: '9px 18px', background: 'var(--primary-blue,#2845D6)', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span className="material-icons" style={{ fontSize: 20 }}>add</span>
          Add Expense
        </button>
        <button
          onClick={exportCSV}
          style={{
            padding: '9px 18px',
            background: 'var(--bg-main,#f9fafb)',
            color: 'var(--text-secondary,#666)',
            border: '1px solid var(--border-color,#e0e4f8)',
            borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span className="material-icons" style={{ fontSize: 20 }}>download</span>
          Export CSV
        </button>
      </div>

      {/* ── Summary Stats ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16, marginBottom: 24,
      }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="material-icons">trending_down</span>
            <span className="stat-card-label">Total Expenses</span>
          </div>
          <div className="stat-card-value">{formatRupee(stats.total)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted,#999)', marginTop: 4 }}>
            {stats.count} expense{stats.count !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="material-icons">calendar_month</span>
            <span className="stat-card-label">This Month</span>
          </div>
          <div className="stat-card-value">{formatRupee(stats.thisMonth)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="material-icons">category</span>
            <span className="stat-card-label">Top Category</span>
          </div>
          <div className="stat-card-value" style={{ fontSize: 20 }}>
            {stats.top ? stats.top[0] : '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted,#999)', marginTop: 4 }}>
            {stats.top ? formatRupee(stats.top[1]) : '₹0'}
          </div>
        </div>
      </div>

      {/* ── Charts ── */}
      {mounted && expenses.length > 0 && (
        <>
          {/* Monthly Trend */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-icons">trending_down</span>
                Monthly Expense Trends
              </h3>
            </div>
            <div className="card-body" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color,#e0e4f8)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={rupeeFmt} width={70} />
                  <ReTooltip formatter={(v) => [rupeeFmt(Number(v ?? 0)), 'Expenses']} />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#e74c3c"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#e74c3c', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Breakdown */}
          {pieData.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-icons">pie_chart</span>
                  Expense by Category
                </h3>
              </div>
              <div className="card-body" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={50}
                      paddingAngle={3}
                    >
                      {pieData.map((_: unknown, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip formatter={(v) => rupeeFmt(Number(v ?? 0))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Expenses Table ── */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-icons">receipt</span>
            Recent Expenses
          </h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {sorted.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted,#999)' }}>
              <span className="material-icons" style={{ fontSize: 48, display: 'block', marginBottom: 12, color: '#ddd' }}>
                receipt
              </span>
              No expenses yet. Add your first expense!
            </div>
          ) : (
            <>
              {/* Desktop: Table View */}
              <div className="table-wrapper">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="expensesTableBody">
                    {sorted.map((exp) => (
                      <tr key={exp.id} className="expense-row">
                        <td>{new Date(exp.date).toLocaleDateString('en-IN')}</td>
                        <td>{exp.description}</td>
                        <td>
                          <span style={{
                            background: 'var(--bg-main, #ecf0f1)',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 12,
                          }}>
                            {catLabel(exp.category)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatRupee(exp.amount)}
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <a
                            href="#"
                            className="action-link edit-link"
                            onClick={(e) => { e.preventDefault(); openEdit(exp) }}
                            title="Edit"
                          >
                            <span className="material-icons">edit</span> Edit
                          </a>
                          <a
                            href="#"
                            className="action-link delete-link"
                            onClick={(e) => { e.preventDefault(); handleDelete(exp.id, exp.description) }}
                            title="Delete"
                            style={{ marginLeft: 6 }}
                          >
                            <span className="material-icons">delete</span> Delete
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Card View */}
              <div className="mobile-cards-grid">
                {sorted.map((exp) => (
                  <div key={exp.id} className="mobile-card">
                    <div className="mobile-card-header">{exp.description}</div>
                    <div className="mobile-card-row">
                      <div className="mobile-card-label">Date</div>
                      <div className="mobile-card-value">{new Date(exp.date).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div className="mobile-card-row">
                      <div className="mobile-card-label">Category</div>
                      <div className="mobile-card-value">
                        <span style={{
                          background: 'var(--bg-main, #ecf0f1)',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                        }}>
                          {catLabel(exp.category)}
                        </span>
                      </div>
                    </div>
                    <div className="mobile-card-row">
                      <div className="mobile-card-label">Amount</div>
                      <div className="mobile-card-value" style={{ fontWeight: 600, color: '#059669' }}>
                        {formatRupee(exp.amount)}
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <a
                        href="#"
                        className="action-link edit-link"
                        onClick={(e) => { e.preventDefault(); openEdit(exp) }}
                        title="Edit"
                      >
                        <span className="material-icons" style={{ fontSize: 16 }}>edit</span>
                      </a>
                      <a
                        href="#"
                        className="action-link delete-link"
                        onClick={(e) => { e.preventDefault(); handleDelete(exp.id, exp.description) }}
                        title="Delete"
                      >
                        <span className="material-icons" style={{ fontSize: 16 }}>delete</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      <ExpenseModal
        open={modalOpen}
        title={editingId ? 'Edit Expense' : 'Add Expense'}
        onClose={closeModal}
        onSubmit={handleSubmit}
        formData={formData}
        onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
        errors={formErrors}
        saving={saving}
      />
    </div>
  )
}
