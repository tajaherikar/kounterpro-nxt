'use client'
/**
 * components/InvoicePreviewModal.tsx
 *
 * Modal for previewing invoices with PDF export, print, and email options
 * Features:
 *   - Invoice preview rendering
 *   - Download as PDF
 *   - Print preview
 *   - Email invoice
 *   - Close button
 */
import React, { useState } from 'react'
import { formatINR } from '@/lib/currency'

interface InvoiceItem {
  id?: string
  productName?: string
  name?: string
  description?: string
  quantity: number
  price?: number
  rate?: number
  total?: number
  serial_no?: string
}

interface InvoicePreviewModalProps {
  isOpen: boolean
  invoice: {
    id: string
    invoiceNumber: string
    customerName: string
    customerEmail?: string
    customerPhone?: string
    date: string
    dueDate?: string
    items?: InvoiceItem[]
    subtotal: number
    taxAmount: number
    total: number
    status?: 'paid' | 'unpaid' | 'partial'
    amountPaid?: number
    notes?: string
    business_name?: string
    business_address?: string
    contact_number_1?: string
    gst_number?: string
    cgst?: number
    sgst?: number
    igst?: number
    isInterState?: boolean
    gstEnabled?: boolean
  } | null
  businessProfile?: {
    business_name?: string
    business_address?: string
    contact_number_1?: string
    contact_number_2?: string
    business_email?: string
    gst_number?: string
  }
  onClose: () => void
  onDownload: () => void
  onPrint: () => void
  onEmail?: (email: string) => void
}

export default function InvoicePreviewModal({
  isOpen,
  invoice,
  businessProfile,
  onClose,
  onDownload,
  onPrint,
  onEmail,
}: InvoicePreviewModalProps) {
  const [emailMode, setEmailMode] = useState(false)
  const [emailValue, setEmailValue] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  if (!isOpen || !invoice) return null

  const handleEmailSend = async () => {
    if (!emailValue.trim()) return

    setEmailLoading(true)
    try {
      if (onEmail) {
        await onEmail(emailValue)
      }
      setEmailValue('')
      setEmailMode(false)
    } catch (error) {
      console.error('Error sending email:', error)
    } finally {
      setEmailLoading(false)
    }
  }

  const items = invoice.items || []
  const businessName = businessProfile?.business_name || invoice.business_name || 'BUSINESS NAME'
  const businessAddress = businessProfile?.business_address || invoice.business_address || ''
  const contactNumber = businessProfile?.contact_number_1 || invoice.contact_number_1 || ''
  const gstNumber = businessProfile?.gst_number || invoice.gst_number || ''

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
        }}
      >
        {/* Modal */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: '1px solid #eee',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Invoice Preview</h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                color: '#999',
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {/* Invoice Preview */}
            <div
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '13px',
                lineHeight: '1.6',
                color: '#333',
                backgroundColor: '#f9f9f9',
                padding: '20px',
                borderRadius: '6px',
                marginBottom: '20px',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#2845D6', marginBottom: '4px' }}>
                    {businessName}
                  </div>
                  <div style={{ color: '#666', fontSize: '12px' }}>{businessAddress}</div>
                  <div style={{ color: '#666', fontSize: '12px' }}>Contact: {contactNumber}</div>
                  {gstNumber && <div style={{ color: '#666', fontSize: '12px' }}>GST: {gstNumber}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>INVOICE</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#2845D6', marginTop: '4px' }}>
                    {invoice.invoiceNumber}
                  </div>
                </div>
              </div>

              {/* Invoice Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '20px',
                  marginBottom: '20px',
                  paddingBottom: '20px',
                  borderBottom: '1px solid #ddd',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>BILL TO</div>
                  <div style={{ fontWeight: 600 }}>{invoice.customerName}</div>
                  {invoice.customerPhone && <div style={{ fontSize: '12px', color: '#666' }}>{invoice.customerPhone}</div>}
                  {invoice.customerEmail && <div style={{ fontSize: '12px', color: '#666' }}>{invoice.customerEmail}</div>}
                </div>
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                    <div>
                      <div style={{ color: '#999' }}>Invoice Date:</div>
                      <div style={{ fontWeight: 600 }}>{new Date(invoice.date).toLocaleDateString('en-IN')}</div>
                    </div>
                    {invoice.dueDate && (
                      <div>
                        <div style={{ color: '#999' }}>Due Date:</div>
                        <div style={{ fontWeight: 600 }}>
                          {new Date(invoice.dueDate).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', marginBottom: '20px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 600, fontSize: '12px' }}>
                      Item
                    </th>
                    <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 600, fontSize: '12px' }}>
                      Qty
                    </th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, fontSize: '12px' }}>
                      Rate
                    </th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, fontSize: '12px' }}>
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '12px', textAlign: 'center', color: '#999' }}>
                        No items
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px 4px' }}>{item.description || item.name || item.productName || ''}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                          ₹{formatINR(item.rate || item.price || 0)}
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                          ₹{formatINR((item.quantity * (item.rate || item.price || 0)) || item.total || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', fontSize: '12px' }}>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>Subtotal:</div>
                <div style={{ textAlign: 'right' }}>₹{formatINR(invoice.subtotal)}</div>

                {invoice.gstEnabled && invoice.taxAmount > 0 && (
                  <>
                    {invoice.isInterState && invoice.igst !== undefined && invoice.igst > 0 ? (
                      <>
                        <div style={{ textAlign: 'right', fontWeight: 600 }}>
                          IGST ({(invoice.igst / invoice.subtotal * 100).toFixed(1)}%):
                        </div>
                        <div style={{ textAlign: 'right' }}>₹{formatINR(invoice.igst)}</div>
                      </>
                    ) : (
                      <>
                        {invoice.cgst !== undefined && invoice.cgst > 0 && (
                          <>
                            <div style={{ textAlign: 'right', fontWeight: 600 }}>
                              CGST ({(invoice.cgst / invoice.subtotal * 100).toFixed(1)}%):
                            </div>
                            <div style={{ textAlign: 'right' }}>₹{formatINR(invoice.cgst)}</div>
                          </>
                        )}
                        {invoice.sgst !== undefined && invoice.sgst > 0 && (
                          <>
                            <div style={{ textAlign: 'right', fontWeight: 600 }}>
                              SGST ({(invoice.sgst / invoice.subtotal * 100).toFixed(1)}%):
                            </div>
                            <div style={{ textAlign: 'right' }}>₹{formatINR(invoice.sgst)}</div>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}

                {!invoice.gstEnabled && invoice.taxAmount > 0 && (
                  <>
                    <div style={{ textAlign: 'right', fontWeight: 600 }}>Tax (GST):</div>
                    <div style={{ textAlign: 'right' }}>₹{formatINR(invoice.taxAmount)}</div>
                  </>
                )}

                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px', paddingTop: '8px' }}>
                  Total:
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: '#2845D6',
                    paddingTop: '8px',
                  }}
                >
                  ₹{formatINR(invoice.total)}
                </div>
              </div>

              {/* Status Badge */}
              {invoice.status && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ddd' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor:
                        invoice.status === 'paid'
                          ? '#d1fae5'
                          : invoice.status === 'partial'
                            ? '#fef3c7'
                            : '#fee2e2',
                      color:
                        invoice.status === 'paid'
                          ? '#065f46'
                          : invoice.status === 'partial'
                            ? '#92400e'
                            : '#991b1b',
                    }}
                  >
                    {invoice.status === 'paid' ? 'Paid' : invoice.status === 'partial' ? 'Partial' : 'Unpaid'}
                  </span>
                </div>
              )}

              {invoice.notes && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ddd' }}>
                  <div style={{ color: '#999', fontSize: '11px', marginBottom: '4px' }}>NOTES:</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{invoice.notes}</div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              padding: '16px 24px',
              borderTop: '1px solid #eee',
              backgroundColor: '#f9f9f9',
              flexWrap: 'wrap',
            }}
          >
            {emailMode ? (
              <>
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '13px',
                    minWidth: '200px',
                  }}
                  disabled={emailLoading}
                />
                <button
                  onClick={handleEmailSend}
                  disabled={emailLoading || !emailValue.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2845D6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    opacity: emailLoading || !emailValue.trim() ? 0.6 : 1,
                  }}
                >
                  {emailLoading ? 'Sending...' : 'Send'}
                </button>
                <button
                  onClick={() => {
                    setEmailMode(false)
                    setEmailValue('')
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f3f4f6',
                    color: '#333',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onDownload}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: '#2845D6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 16 }}>
                    download
                  </span>
                  Download PDF
                </button>
                <button
                  onClick={onPrint}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: '#fff',
                    color: '#333',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 16 }}>
                    print
                  </span>
                  Print
                </button>
                {onEmail && (
                  <button
                    onClick={() => {
                      setEmailMode(true)
                      setEmailValue(invoice.customerEmail || '')
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: '#fff',
                      color: '#333',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 16 }}>
                      mail
                    </span>
                    Email
                  </button>
                )}
                <button
                  onClick={onClose}
                  style={{
                    marginLeft: 'auto',
                    padding: '8px 16px',
                    backgroundColor: '#f3f4f6',
                    color: '#333',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
