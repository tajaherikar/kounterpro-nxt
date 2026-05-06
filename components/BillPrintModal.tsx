'use client'
/**
 * components/BillPrintModal.tsx
 *
 * Clean, professional bill/invoice print modal using HTML-based rendering
 * Inspired by Medixor's approach for superior visual quality
 * Features:
 *   - Professional HTML-rendered invoice
 *   - Browser print dialog (saves as PDF)
 *   - Clean, semantic HTML structure
 *   - Responsive layout
 *   - Business branding support
 */

import React from 'react'
import { formatINR } from '@/lib/currency'
import { Printer } from 'lucide-react'

interface BillItem {
  id?: string
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

interface BillPrintModalProps {
  isOpen: boolean
  bill: {
    id: string
    invoiceNumber: string
    customerName: string
    customerEmail?: string
    customerPhone?: string
    customerAddress?: string
    customerGST?: string
    date: string
    dueDate?: string
    items?: BillItem[]
    subtotal: number
    taxAmount: number
    total: number
    status?: 'paid' | 'unpaid' | 'partial'
    amountPaid?: number
    notes?: string
    termsConditions?: string
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
    upi_id?: string
  }
  onClose: () => void
}

const BillPrintModal: React.FC<BillPrintModalProps> = ({ isOpen, bill, businessProfile, onClose }) => {
  if (!isOpen || !bill) return null

  const businessName = businessProfile?.business_name || 'BUSINESS NAME'
  const businessAddress = businessProfile?.business_address || ''
  const contactPhone = businessProfile?.contact_number_1 || ''
  const gstNumber = businessProfile?.gst_number || ''
  const items = bill.items || []

  const payStatusMap: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    unpaid: 'bg-red-100 text-red-700',
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=960,height=650')
    if (!printWindow) return

    const brandColor = '#2845D6'
    const statusColor: Record<string, string> = {
      paid: '#dcfce7',
      partial: '#fef3c7',
      unpaid: '#fee2e2',
    }
    const statusTextColor: Record<string, string> = {
      paid: '#065f46',
      partial: '#92400e',
      unpaid: '#b91c1c',
    }

    const currentStatus = bill.status || 'unpaid'
    const statusBg = statusColor[currentStatus] || '#f3f4f6'
    const statusText = statusTextColor[currentStatus] || '#374151'

    const rows = items
      .map(
        (item, i) => `<tr>
        <td style="padding:6px 8px;text-align:left;border-bottom:1px solid #f0f0f0">${i + 1}</td>
        <td style="padding:6px 8px;text-align:left;border-bottom:1px solid #f0f0f0">${item.description || item.name || item.productName || ''}</td>
        ${item.hsn ? `<td style="padding:6px 8px;text-align:center;font-family:monospace;font-size:11px;border-bottom:1px solid #f0f0f0">${item.hsn}</td>` : ''}
        <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #f0f0f0">${item.quantity}</td>
        <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #f0f0f0">₹${formatINR(item.rate || item.price || 0)}</td>
        ${item.gstRate ? `<td style="padding:6px 8px;text-align:center;border-bottom:1px solid #f0f0f0">${item.gstRate}%</td>` : ''}
        <td style="padding:6px 8px;text-align:right;font-weight:600;border-bottom:1px solid #f0f0f0">₹${formatINR(item.total || item.quantity * (item.rate || item.price || 0))}</td>
      </tr>`
      )
      .join('')

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${bill.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #1a1a1a; padding: 24px; max-width: 960px; margin: 0 auto; }
    .container { background: white; padding: 24px; border-radius: 6px; }
    
    /* Header Section */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid ${brandColor}; }
    .header-left { flex: 1; }
    .header-right { text-align: right; }
    .business-name { font-size: 20px; font-weight: 800; color: ${brandColor}; margin-bottom: 4px; }
    .business-meta { font-size: 11px; color: #666; line-height: 1.5; }
    .invoice-title { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .invoice-number { font-size: 20px; font-weight: 700; color: ${brandColor}; margin-bottom: 4px; }
    .invoice-date { font-size: 11px; color: #666; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 10px; font-weight: 600; background: ${statusBg}; color: ${statusText}; margin-top: 8px; }
    
    /* Party Details */
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .party-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
    .party-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px; }
    .party-name { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
    .party-detail { font-size: 11px; color: #666; line-height: 1.5; }
    
    /* Items Table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: ${brandColor}; color: white; }
    th { padding: 8px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; white-space: nowrap; }
    td { padding: 6px 8px; }
    tbody tr:nth-child(even) { background: #fafafa; }
    
    /* Summary */
    .summary { display: flex; justify-content: flex-end; margin-bottom: 20px; }
    .summary-table { width: 280px; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
    .summary-row.total { font-weight: 700; font-size: 13px; color: ${brandColor}; border-top: 2px solid ${brandColor}; padding-top: 8px; border-bottom: none; }
    .summary-label { color: #666; }
    .summary-value { text-align: right; font-weight: 600; }
    
    /* Notes & Terms */
    .notes-section { background: #f9fafb; border-left: 3px solid ${brandColor}; padding: 12px; margin-bottom: 12px; border-radius: 0 4px 4px 0; }
    .notes-label { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px; }
    .notes-text { font-size: 11px; color: #666; line-height: 1.5; }
    
    /* Footer */
    .footer { text-align: center; font-size: 10px; color: #999; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
    
    /* Print Styles */
    @media print {
      @page { margin: 1cm; }
      body { padding: 0; }
      .container { box-shadow: none; border-radius: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="business-name">${businessName.toUpperCase()}</div>
        ${businessAddress ? `<div class="business-meta">${businessAddress}</div>` : ''}
        ${contactPhone ? `<div class="business-meta">Phone: ${contactPhone}</div>` : ''}
        ${gstNumber ? `<div class="business-meta">GST: ${gstNumber}</div>` : ''}
      </div>
      <div class="header-right">
        <div class="invoice-title">Tax Invoice</div>
        <div class="invoice-number">#${bill.invoiceNumber}</div>
        <div class="invoice-date">${new Date(bill.date).toLocaleDateString('en-IN')}</div>
        <div class="status-badge">${bill.status === 'paid' ? 'Paid' : bill.status === 'partial' ? 'Partial' : 'Unpaid'}</div>
      </div>
    </div>

    <!-- Party Details -->
    <div class="parties">
      <div class="party-box">
        <div class="party-label">Bill To</div>
        <div class="party-name">${bill.customerName}</div>
        ${bill.customerPhone ? `<div class="party-detail">Phone: ${bill.customerPhone}</div>` : ''}
        ${bill.customerEmail ? `<div class="party-detail">Email: ${bill.customerEmail}</div>` : ''}
        ${bill.customerGST ? `<div class="party-detail">GST: ${bill.customerGST}</div>` : ''}
        ${bill.customerAddress ? `<div class="party-detail">${bill.customerAddress}</div>` : ''}
      </div>
      <div class="party-box">
        <div class="party-label">Invoice Details</div>
        <div class="party-detail">Invoice No: ${bill.invoiceNumber}</div>
        <div class="party-detail">Date: ${new Date(bill.date).toLocaleDateString('en-IN')}</div>
        ${bill.dueDate ? `<div class="party-detail">Due: ${new Date(bill.dueDate).toLocaleDateString('en-IN')}</div>` : ''}
        ${bill.status === 'partial' && bill.amountPaid ? `<div class="party-detail">Paid: ₹${formatINR(bill.amountPaid)}</div>` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 5%">#</th>
          <th style="width: 45%">Description</th>
          ${items.some(i => i.hsn) ? `<th style="width: 10%;text-align:center">HSN</th>` : ''}
          <th style="width: 10%;text-align:center">Qty</th>
          <th style="width: 15%;text-align:right">Rate (₹)</th>
          ${items.some(i => i.gstRate) ? `<th style="width: 8%;text-align:center">GST%</th>` : ''}
          <th style="width: 15%;text-align:right">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <!-- Summary -->
    <div class="summary">
      <div class="summary-table">
        <div class="summary-row">
          <span class="summary-label">Subtotal</span>
          <span class="summary-value">₹${formatINR(bill.subtotal)}</span>
        </div>
        ${bill.gstEnabled && bill.taxAmount > 0 ? `
          ${bill.isInterState && bill.igst ? `
            <div class="summary-row">
              <span class="summary-label">IGST</span>
              <span class="summary-value">₹${formatINR(bill.igst)}</span>
            </div>
          ` : `
            ${bill.cgst ? `
              <div class="summary-row">
                <span class="summary-label">CGST</span>
                <span class="summary-value">₹${formatINR(bill.cgst)}</span>
              </div>
            ` : ''}
            ${bill.sgst ? `
              <div class="summary-row">
                <span class="summary-label">SGST</span>
                <span class="summary-value">₹${formatINR(bill.sgst)}</span>
              </div>
            ` : ''}
          `}
        ` : bill.taxAmount > 0 ? `
          <div class="summary-row">
            <span class="summary-label">Tax</span>
            <span class="summary-value">₹${formatINR(bill.taxAmount)}</span>
          </div>
        ` : ''}
        ${bill.status === 'partial' && bill.amountPaid ? `
          <div class="summary-row">
            <span class="summary-label">Paid</span>
            <span class="summary-value">₹${formatINR(bill.amountPaid)}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Balance Due</span>
            <span class="summary-value">₹${formatINR(bill.total - (bill.amountPaid || 0))}</span>
          </div>
        ` : ''}
        <div class="summary-row total">
          <span class="summary-label">Total</span>
          <span class="summary-value">₹${formatINR(bill.total)}</span>
        </div>
      </div>
    </div>

    <!-- Notes & Terms -->
    ${bill.notes ? `
      <div class="notes-section">
        <div class="notes-label">Notes</div>
        <div class="notes-text">${bill.notes}</div>
      </div>
    ` : ''}
    ${bill.termsConditions ? `
      <div class="notes-section">
        <div class="notes-label">Terms & Conditions</div>
        <div class="notes-text">${bill.termsConditions}</div>
      </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <p>Thank you for your business!</p>
      <p style="margin-top: 4px">This is a computer-generated invoice</p>
    </div>
  </div>

  <script>
    // Print will be triggered by React component
  </script>
</body>
</html>
    `

    printWindow.document.write(htmlContent)
    
    // Ensure print dialog opens after content is rendered
    setTimeout(() => {
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }, 500)
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '16px',
        }}
      >
        {/* Modal */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'white',
            borderRadius: '8px',
            maxWidth: '960px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              background: '#ffffff',
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
                Invoice Preview
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                {bill.customerName} • {new Date(bill.date).toLocaleDateString('en-IN')}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={handlePrint}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: '#2845d6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1e3a8a')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#2845d6')}
              >
                <span style={{ fontSize: '16px' }}>🖨️</span>
                Print / PDF
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#6b7280')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              background: '#f9fafb',
            }}
          >
            {/* HTML Preview */}
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '14px',
                color: '#1f2937',
                lineHeight: 1.6,
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: '16px',
                  borderBottom: '2px solid #2845d6',
                  marginBottom: '24px',
                }}
              >
                <div>
                  <div className="text-lg font-bold text-blue-600 mb-2">{businessName.toUpperCase()}</div>
                  {businessAddress && <div className="text-xs text-gray-600 mb-1">{businessAddress}</div>}
                  {contactPhone && <div className="text-xs text-gray-600 mb-1">Phone: {contactPhone}</div>}
                  {gstNumber && <div className="text-xs text-gray-600">GST: {gstNumber}</div>}
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-700 mb-2">TAX INVOICE</div>
                  <div className="text-lg font-bold text-blue-600 mb-1">#{bill.invoiceNumber}</div>
                  <div className="text-xs text-gray-600 mb-2">{new Date(bill.date).toLocaleDateString('en-IN')}</div>
                  <span
                    className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${payStatusMap[bill.status || 'unpaid'] ?? payStatusMap.unpaid}`}
                  >
                    {bill.status === 'paid' ? 'Paid' : bill.status === 'partial' ? 'Partial' : 'Unpaid'}
                  </span>
                </div>
              </div>

              {/* Party Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Bill To</p>
                  <p className="font-semibold text-sm mb-1">{bill.customerName}</p>
                  {bill.customerPhone && <p className="text-xs text-gray-600">Phone: {bill.customerPhone}</p>}
                  {bill.customerEmail && <p className="text-xs text-gray-600">Email: {bill.customerEmail}</p>}
                  {bill.customerGST && <p className="text-xs text-gray-600 font-mono">GST: {bill.customerGST}</p>}
                  {bill.customerAddress && <p className="text-xs text-gray-600 mt-1">{bill.customerAddress}</p>}
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Invoice Details</p>
                  <p className="text-xs text-gray-600 mb-1">Invoice No: {bill.invoiceNumber}</p>
                  <p className="text-xs text-gray-600 mb-1">Date: {new Date(bill.date).toLocaleDateString('en-IN')}</p>
                  {bill.dueDate && (
                    <p className="text-xs text-gray-600 mb-1">Due: {new Date(bill.dueDate).toLocaleDateString('en-IN')}</p>
                  )}
                  {bill.status === 'partial' && bill.amountPaid && (
                    <p className="text-xs text-gray-600">Paid: ₹{formatINR(bill.amountPaid)}</p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="px-2 py-2 text-left font-semibold">#</th>
                      <th className="px-2 py-2 text-left font-semibold">Description</th>
                      {items.some((i) => i.hsn) && (
                        <th className="px-2 py-2 text-center font-semibold">HSN</th>
                      )}
                      <th className="px-2 py-2 text-center font-semibold">Qty</th>
                      <th className="px-2 py-2 text-right font-semibold">Rate (₹)</th>
                      {items.some((i) => i.gstRate) && (
                        <th className="px-2 py-2 text-center font-semibold">GST%</th>
                      )}
                      <th className="px-2 py-2 text-right font-semibold">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-3 text-center text-gray-500">
                          No items
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-200 even:bg-gray-50">
                          <td className="px-2 py-2">{idx + 1}</td>
                          <td className="px-2 py-2">{item.description || item.name || item.productName || ''}</td>
                          {items.some((i) => i.hsn) && (
                            <td className="px-2 py-2 text-center font-mono text-gray-600">{item.hsn || '-'}</td>
                          )}
                          <td className="px-2 py-2 text-center">{item.quantity}</td>
                          <td className="px-2 py-2 text-right">₹{formatINR(item.rate || item.price || 0)}</td>
                          {items.some((i) => i.gstRate) && (
                            <td className="px-2 py-2 text-center">{item.gstRate || '-'}%</td>
                          )}
                          <td className="px-2 py-2 text-right font-semibold">
                            ₹{formatINR(item.total || item.quantity * (item.rate || item.price || 0))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="flex justify-end">
                <div className="w-72 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span>₹{formatINR(bill.subtotal)}</span>
                  </div>
                  {bill.gstEnabled && bill.taxAmount > 0 && (
                    <>
                      {bill.isInterState && bill.igst ? (
                        <div className="flex justify-between text-gray-600">
                          <span>IGST:</span>
                          <span>₹{formatINR(bill.igst)}</span>
                        </div>
                      ) : (
                        <>
                          {bill.cgst && (
                            <div className="flex justify-between text-gray-600">
                              <span>CGST:</span>
                              <span>₹{formatINR(bill.cgst)}</span>
                            </div>
                          )}
                          {bill.sgst && (
                            <div className="flex justify-between text-gray-600">
                              <span>SGST:</span>
                              <span>₹{formatINR(bill.sgst)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {!bill.gstEnabled && bill.taxAmount > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Tax:</span>
                      <span>₹{formatINR(bill.taxAmount)}</span>
                    </div>
                  )}
                  {bill.status === 'partial' && bill.amountPaid && (
                    <>
                      <div className="flex justify-between text-gray-600 py-1">
                        <span>Paid:</span>
                        <span>₹{formatINR(bill.amountPaid)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 border-t pt-1">
                        <span>Balance Due:</span>
                        <span>₹{formatINR(bill.total - (bill.amountPaid || 0))}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-bold text-lg text-blue-600 border-t-2 border-blue-600 pt-2">
                    <span>Total:</span>
                    <span>₹{formatINR(bill.total)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {bill.notes && (
                <div className="bg-blue-50 border-l-3 border-blue-600 rounded p-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Notes</p>
                  <p className="text-xs text-gray-700">{bill.notes}</p>
                </div>
              )}

              {/* Terms */}
              {bill.termsConditions && (
                <div className="bg-blue-50 border-l-3 border-blue-600 rounded p-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Terms & Conditions</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{bill.termsConditions}</p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-xs text-gray-500 pt-4 border-t">
                <p>Thank you for your business!</p>
                <p className="mt-1">This is a computer-generated invoice</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default BillPrintModal
