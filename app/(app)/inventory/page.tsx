'use client'
import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useInventory } from '@/hooks/useAPI'
import type { InventoryItem } from '@/lib/supabase'

export default function InventoryPage() {
  return <InventoryContent />
}

const DEFAULT_THRESHOLD = 10

// Stock is read-only — all changes go through Purchases

function getStockStatus(item: InventoryItem): { label: string; cls: string; icon: string } {
  const t = item.low_stock_threshold ?? DEFAULT_THRESHOLD
  if (item.stock === 0) return { label: 'Out of Stock', cls: 'status-out', icon: 'remove_circle' }
  if (item.stock <= t)  return { label: 'Low Stock',    cls: 'status-low', icon: 'warning' }
  return                       { label: 'In Stock',     cls: 'status-ok',  icon: 'check_circle' }
}

function formatIndian(n: number) {
  const fixed = n.toFixed(2)
  const [int, dec] = fixed.split('.')
  const isNeg = int.startsWith('-')
  const abs = isNeg ? int.slice(1) : int
  let result = abs.length <= 3 ? abs : abs.slice(-3)
  const rest = abs.length > 3 ? abs.slice(0, abs.length - 3) : ''
  if (rest) result = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + result
  return (isNeg ? '-' : '') + result + '.' + dec
}


function InventoryContent() {
  const { data: items = [], isLoading, isError, error } = useInventory()

  const [searchTerm, setSearchTerm]   = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all')

  // ── Derived stats ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalItems = items.length
    const totalStock = items.reduce((s, i) => s + i.stock, 0)
    const lowStock   = items.filter(i => {
      const t = i.low_stock_threshold ?? DEFAULT_THRESHOLD
      return i.stock > 0 && i.stock <= t
    }).length
    const outOfStock = items.filter(i => i.stock === 0).length
    return { totalItems, totalStock, lowStock, outOfStock }
  }, [items])

  // ── Filtered list ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = items
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      list = list.filter(i =>
        i.name.toLowerCase().includes(lower) ||
        (i.description?.toLowerCase().includes(lower) ?? false) ||
        (i.barcode?.toLowerCase().includes(lower) ?? false)
      )
    }
    if (stockFilter === 'low') {
      list = list.filter(i => {
        const t = i.low_stock_threshold ?? DEFAULT_THRESHOLD
        return i.stock > 0 && i.stock <= t
      })
    } else if (stockFilter === 'out') {
      list = list.filter(i => i.stock === 0)
    }
    return list
  }, [items, searchTerm, stockFilter])



  if (isError)
    return (
      <div className="invoices-section" style={{ textAlign: 'center', padding: 40, color: '#c62828' }}>
        <span className="material-icons" style={{ fontSize: 48 }}>error</span>
        <p>{error instanceof Error ? error.message : 'Failed to load inventory'}</p>
      </div>
    )

  return (
    <>
      {/* Stats bar */}
      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-label">Total Items</div>
          <div className="stat-value">{isLoading ? '…' : stats.totalItems}</div>
        </div>
        <div
          className="stat-card"
          style={{ cursor: stats.lowStock > 0 ? 'pointer' : 'default' }}
          onClick={() => stats.lowStock > 0 && setStockFilter(prev => prev === 'low' ? 'all' : 'low')}
        >
          <div className="stat-label">Low Stock Items</div>
          <div className="stat-value" style={{ color: '#f68048' }}>{isLoading ? '…' : stats.lowStock}</div>
          {stats.lowStock > 0 && <small className="stat-label" style={{ fontSize: 11 }}>Click to filter</small>}
        </div>
        <div
          className="stat-card"
          style={{ cursor: stats.outOfStock > 0 ? 'pointer' : 'default' }}
          onClick={() => stats.outOfStock > 0 && setStockFilter(prev => prev === 'out' ? 'all' : 'out')}
        >
          <div className="stat-label">Out of Stock</div>
          <div className="stat-value" style={{ color: '#c62828' }}>{isLoading ? '…' : stats.outOfStock}</div>
          {stats.outOfStock > 0 && <small className="stat-label" style={{ fontSize: 11 }}>Click to filter</small>}
        </div>
      </div>

      {/* Stock Update Notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: 'rgba(40,69,214,0.07)', borderRadius: 10, marginBottom: 16,
        border: '1px solid rgba(40,69,214,0.15)',
      }}>
        <span className="material-icons" style={{ color: '#2845D6', fontSize: 20 }}>info</span>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Update stock by recording purchases with your suppliers.{' '}
          <Link href="/suppliers" style={{ color: '#2845D6', fontWeight: 600 }}>Go to Suppliers →</Link>
        </span>
      </div>

      {/* Main table section */}
      <div className="invoices-section">
        <div className="section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="inventory-search">
            <div className="search-input-wrapper">
              <span className="material-icons search-icon">search</span>
              <input
                type="text"
                placeholder="Search by name, description or barcode…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <span className="material-icons search-clear" onClick={() => setSearchTerm('')}>close</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {(['all', 'low', 'out'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setStockFilter(f)}
                style={{
                  padding: '5px 12px', borderRadius: 20, border: '1.5px solid',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  borderColor: stockFilter === f ? '#2845D6' : '#ddd',
                  background:  stockFilter === f ? '#2845D6' : '#fff',
                  color:       stockFilter === f ? '#fff' : '#555',
                }}
              >
                {f === 'all' ? 'All' : f === 'low' ? '⚠ Low Stock' : '🔴 Out of Stock'}
              </button>
            ))}
            {stockFilter !== 'all' && (
              <span style={{ fontSize: 12, color: '#999' }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
            Loading inventory…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
            <span className="material-icons" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>inventory_2</span>
            <p>
              {searchTerm || stockFilter !== 'all'
                ? 'No items match your filter.'
                : 'No inventory items yet. Add stock by recording a purchase.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop: Table View | Mobile: Card View (see CSS) */}
            <table className="invoices-table">
              <thead style={{ display: 'table-header-group' }}>
                <tr>
                  <th>Item Name</th>
                  <th>Description</th>
                  <th>Opening Stock</th>
                  <th>Current Stock</th>
                  <th>Consumed</th>
                  <th>Purchase Price (₹)</th>
                  <th>Sale Price (₹)</th>
                  <th>Profit %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const status    = getStockStatus(item)
                  const threshold = item.low_stock_threshold ?? DEFAULT_THRESHOLD
                  const itemConsumed = (item.opening_stock ?? 0) - item.stock
                  const profit =
                    (item.purchase_price ?? 0) > 0
                      ? (((item.rate - (item.purchase_price ?? 0)) / (item.purchase_price ?? 1)) * 100).toFixed(2)
                      : null
                  const rowBg =
                    item.stock === 0 ? '#ffebee' : item.stock <= threshold ? '#fff8f0' : undefined

                  let stockDisplay: React.ReactNode = `${item.stock} units`
                  if (item.stock === 0) {
                    stockDisplay = <strong style={{ color: '#c62828' }}>0 units</strong>
                  } else if (item.stock <= threshold) {
                    stockDisplay = (
                      <>
                        <strong style={{ color: '#f68048' }}>{item.stock} units</strong>
                        <small style={{ color: '#666', display: 'block', fontSize: 11 }}>Alert ≤ {threshold}</small>
                      </>
                    )
                  }

                  return (
                    <tr key={item.id} style={{ backgroundColor: rowBg }}>
                      <td>
                        <strong>{item.name}</strong>
                        {item.barcode && (
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                            <span className="material-icons" style={{ fontSize: 12, verticalAlign: 'middle' }}>qr_code</span> {item.barcode}
                          </div>
                        )}
                      </td>
                      <td>{item.description || '—'}</td>
                      <td>{item.opening_stock ?? 0} units</td>
                      <td>{stockDisplay}</td>
                      <td>{itemConsumed} units</td>
                      <td>₹{formatIndian(item.purchase_price ?? 0)}</td>
                      <td>₹{formatIndian(item.rate)}</td>
                      <td>
                        {profit !== null ? (
                          <span style={{ color: parseFloat(profit) >= 0 ? '#28a745' : '#c62828', fontWeight: 600 }}>
                            {profit}%
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`status-badge ${status.cls}`}>
                          <span className="material-icons" style={{ fontSize: 13, marginRight: 4, verticalAlign: 'middle' }}>
                            {status.icon}
                          </span>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Mobile: Card View */}
            <div style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: '1fr',
            }}
            className="mobile-inventory-cards">
              {filtered.map(item => {
                const status    = getStockStatus(item)
                const threshold = item.low_stock_threshold ?? DEFAULT_THRESHOLD
                const itemConsumed = (item.opening_stock ?? 0) - item.stock
                const profit =
                  (item.purchase_price ?? 0) > 0
                    ? (((item.rate - (item.purchase_price ?? 0)) / (item.purchase_price ?? 1)) * 100).toFixed(2)
                    : null
                const rowBg =
                  item.stock === 0 ? '#ffebee' : item.stock <= threshold ? '#fff8f0' : undefined

                let stockDisplay: React.ReactNode = `${item.stock} units`
                if (item.stock === 0) {
                  stockDisplay = <strong style={{ color: '#c62828' }}>0 units</strong>
                } else if (item.stock <= threshold) {
                  stockDisplay = (
                    <>
                      <strong style={{ color: '#f68048' }}>{item.stock} units</strong>
                      <small style={{ color: '#666', display: 'block', fontSize: 11 }}>Alert ≤ {threshold}</small>
                    </>
                  )
                }

                return (
                  <div key={item.id} style={{
                    padding: 16,
                    background: rowBg || '#fff',
                    borderRadius: 10,
                    border: '1px solid #eee',
                  }}>
                    {/* Item Name & Barcode */}
                    <div style={{ marginBottom: 12 }}>
                      <strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>{item.name}</strong>
                      {item.barcode && (
                        <small style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-icons" style={{ fontSize: 12 }}>qr_code</span>
                          {item.barcode}
                        </small>
                      )}
                      {item.description && (
                        <small style={{ fontSize: 12, color: '#666', display: 'block', marginTop: 6 }}>
                          {item.description}
                        </small>
                      )}
                    </div>

                    {/* Stock Status Badge */}
                    <div style={{ marginBottom: 12 }}>
                      <span className={`status-badge ${status.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-icons" style={{ fontSize: 13 }}>
                          {status.icon}
                        </span>
                        {status.label}
                      </span>
                    </div>

                    {/* Stock Info Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                      marginBottom: 12,
                      paddingBottom: 12,
                      borderBottom: '1px solid #eee',
                    }}>
                      <div>
                        <small style={{ color: '#999', fontSize: 11 }}>Current Stock</small>
                        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{stockDisplay}</div>
                      </div>
                      <div>
                        <small style={{ color: '#999', fontSize: 11 }}>Opening Stock</small>
                        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{item.opening_stock ?? 0} units</div>
                      </div>
                      <div>
                        <small style={{ color: '#999', fontSize: 11 }}>Consumed</small>
                        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{itemConsumed} units</div>
                      </div>
                    </div>

                    {/* Pricing Info Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                    }}>
                      <div>
                        <small style={{ color: '#999', fontSize: 11 }}>Purchase Price</small>
                        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>₹{formatIndian(item.purchase_price ?? 0)}</div>
                      </div>
                      <div>
                        <small style={{ color: '#999', fontSize: 11 }}>Sale Price</small>
                        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>₹{formatIndian(item.rate)}</div>
                      </div>
                      {profit !== null && (
                        <div>
                          <small style={{ color: '#999', fontSize: 11 }}>Profit Margin</small>
                          <div style={{
                            fontSize: 15,
                            fontWeight: 600,
                            marginTop: 4,
                            color: parseFloat(profit) >= 0 ? '#28a745' : '#c62828',
                          }}>
                            {profit}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}
