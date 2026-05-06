'use client'

import React from 'react'
import { formatINR } from '@/lib/currency'
import { X } from 'lucide-react'

interface InvoiceItem {
  description?: string
  productName?: string
  name?: string
  quantity: number
  price?: number
  rate?: number
  total?: number
  hsn?: string
  gstRate?: number
}

interface InvoicePreviewModalNewProps {
  isOpen: boolean
  invoice: {
    id?: string
    invoiceNumber: string
    customerName: string
    customerPhone?: string
    customerEmail?: string
    customerAddress?: string
    customerGST?: string
    date: string
    dueDate?: string
    items?: InvoiceItem[]
    subtotal: number
    taxAmount: number
    total: number
    status?: 'paid' | 'unpaid' | 'partial'
    amountPaid?: number
    notes?: string
    cgst?: number
    sgst?: number
    igst?: number
    gstEnabled?: boolean
    isInterState?: boolean
  } | null
  businessProfile?: {
    business_name?: string
    business_address?: string
    contact_number_1?: string
    gst_number?: string
  }
  onClose: () => void
}

export default function InvoicePreviewModalNew({
  isOpen,
  invoice,
  businessProfile,
  onClose,
}: InvoicePreviewModalNewProps) {
  if (!isOpen || !invoice) return null

  const items = invoice.items || []
  const brandColor = '#2845D6'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '12px',
          maxWidth: '1000px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '24px',
            borderBottom: '1px solid #e5e7eb',
            background: 'linear-gradient(to right, #f0f4ff, white)',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
              Invoice #{invoice.invoiceNumber}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#9ca3af' }}>
              {invoice.customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
            }}
          >
            <X className="w-6 h-6" style={{ color: '#9ca3af' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '32px', background: '#f9fafb' }}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '32px' }}>
            {/* Business Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '32px',
                paddingBottom: '24px',
                borderBottom: `2px solid ${brandColor}`,
              }}
            >
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: brandColor, marginBottom: '8px' }}>
                  {businessProfile?.business_name || 'BUSINESS NAME'}
                </div>
                {businessProfile?.business_address && (
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                    {businessProfile.business_address}
                  </div>
                )}
                {businessProfile?.contact_number_1 && (
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                    Phone: {businessProfile.contact_number_1}
                  </div>
                )}
                {businessProfile?.gst_number && (
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    GST: {businessProfile.gst_number}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Tax Invoice
                </div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: brandColor, marginBottom: '8px' }}>
                  #{invoice.invoiceNumber}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                  {new Date(invoice.date).toLocaleDateString('en-IN')}
                </div>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '6px 16px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: invoice.status === 'paid' ? '#dcfce7' : invoice.status === 'partial' ? '#fef3c7' : '#fee2e2',
                    color: invoice.status === 'paid' ? '#065f46' : invoice.status === 'partial' ? '#92400e' : '#b91c1c',
                  }}
                >
                  {invoice.status === 'paid' ? 'Paid' : invoice.status === 'partial' ? 'Partial' : 'Unpaid'}
                </div>
              </div>
            </div>

            {/* Party Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '24px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Bill To
                </h3>
                <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>{invoice.customerName}</p>
                {invoice.customerPhone && (
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#666' }}>Phone: {invoice.customerPhone}</p>
                )}
                {invoice.customerEmail && (
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#666' }}>Email: {invoice.customerEmail}</p>
                )}
                {invoice.customerGST && (
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#666', fontFamily: 'monospace' }}>GST: {invoice.customerGST}</p>
                )}
                {invoice.customerAddress && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>{invoice.customerAddress}</p>
                )}
              </div>

              <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '24px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Invoice Details
                </h3>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Invoice No: {invoice.invoiceNumber}</p>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Date: {new Date(invoice.date).toLocaleDateString('en-IN')}</p>
                {invoice.dueDate && (
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>Due: {new Date(invoice.dueDate).toLocaleDateString('en-IN')}</p>
                )}
                {invoice.status === 'partial' && invoice.amountPaid && (
                  <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Paid: ₹{formatINR(invoice.amountPaid)}</p>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div style={{ marginBottom: '32px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: brandColor, color: 'white' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' }}>#</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' }}>Description</th>
                    {items.some((i) => i.hsn) && (
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', fontSize: '12px' }}>HSN</th>
                    )}
                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', fontSize: '12px' }}>Qty</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', fontSize: '12px' }}>Rate (₹)</th>
                    {items.some((i) => i.gstRate) && (
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', fontSize: '12px' }}>GST%</th>
                    )}
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', fontSize: '12px' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '12px' }}>{idx + 1}</td>
                      <td style={{ padding: '12px' }}>{item.description || item.name || item.productName || ''}</td>
                      {items.some((i) => i.hsn) && (
                        <td style={{ padding: '12px', textAlign: 'center', fontFamily: 'monospace', fontSize: '12px' }}>
                          {item.hsn || '-'}
                        </td>
                      )}
                      <td style={{ padding: '12px', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>₹{formatINR(item.rate || item.price || 0)}</td>
                      {items.some((i) => i.gstRate) && (
                        <td style={{ padding: '12px', textAlign: 'center' }}>{item.gstRate || '-'}%</td>
                      )}
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                        ₹{formatINR(item.total || item.quantity * (item.rate || item.price || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
              <div style={{ width: '320px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                  <span>Subtotal:</span>
                  <span>₹{formatINR(invoice.subtotal)}</span>
                </div>

                {invoice.gstEnabled && invoice.taxAmount > 0 && (
                  <>
                    {invoice.isInterState && invoice.igst ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                        <span>IGST:</span>
                        <span>₹{formatINR(invoice.igst)}</span>
                      </div>
                    ) : (
                      <>
                        {invoice.cgst && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                            <span>CGST:</span>
                            <span>₹{formatINR(invoice.cgst)}</span>
                          </div>
                        )}
                        {invoice.sgst && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                            <span>SGST:</span>
                            <span>₹{formatINR(invoice.sgst)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {!invoice.gstEnabled && invoice.taxAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                    <span>Tax:</span>
                    <span>₹{formatINR(invoice.taxAmount)}</span>
                  </div>
                )}

                {invoice.status === 'partial' && invoice.amountPaid && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666', paddingTop: '8px', marginBottom: '8px', borderTop: '1px solid #e5e7eb' }}>
                      <span>Paid:</span>
                      <span>₹{formatINR(invoice.amountPaid)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '600', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                      <span>Balance Due:</span>
                      <span>₹{formatINR(invoice.total - (invoice.amountPaid || 0))}</span>
                    </div>
                  </>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: 'white',
                    background: brandColor,
                    padding: '12px 16px',
                    borderRadius: '6px',
                    marginTop: '16px',
                  }}
                >
                  <span>Total:</span>
                  <span>₹{formatINR(invoice.total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div style={{ background: '#f0f4ff', borderLeft: `4px solid ${brandColor}`, borderRadius: '4px 6px 6px 4px', padding: '16px', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
                  Notes
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{invoice.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
              <p style={{ margin: 0 }}>Thank you for your business!</p>
              <p style={{ marginTop: '4px' }}>This is a computer-generated invoice</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
