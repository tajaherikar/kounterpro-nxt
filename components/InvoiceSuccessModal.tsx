'use client'
import React from 'react'
import { formatRupee } from '@/lib/currency'
import type { Invoice } from '@/lib/supabase'

interface InvoiceSuccessModalProps {
  isOpen: boolean
  invoice: Invoice | null
  onClose: () => void
  onView: () => void
  onDownload: () => void
  onWhatsApp: () => void
}

export default function InvoiceSuccessModal({
  isOpen,
  invoice,
  onClose,
  onView,
  onDownload,
  onWhatsApp,
}: InvoiceSuccessModalProps) {
  if (!isOpen || !invoice) return null

  const totalAmount = invoice.total_amount || 0
  const itemCount = (invoice.items as any[])?.length || 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '450px',
          width: '90%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#d4edda',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontSize: '32px' }}>✅</span>
          </div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600, color: '#1f2937' }}>
            Invoice Saved!
          </h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            Invoice <strong>{invoice.invoice_number}</strong> created successfully
          </p>
        </div>

        {/* Invoice Summary Card */}
        <div
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Customer:</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
              {invoice.customer_name}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Items:</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{itemCount}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '12px',
              borderTop: '1px solid #e5e7eb',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>Total:</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#2845d6' }}>
              {formatRupee(totalAmount)}
            </span>
          </div>
        </div>

        {/* Info Message */}
        <div
          style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderLeft: '4px solid #ffc107',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '24px',
            fontSize: '13px',
            color: '#856404',
          }}
        >
          <strong>Note:</strong> The PDF will be downloaded when you view the invoice. You can then share it via
          WhatsApp or download it separately.
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexDirection: 'column',
          }}
        >
          <button
            onClick={onView}
            style={{
              width: '100%',
              padding: '12px',
              background: '#2845d6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1e3a8a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#2845d6')}
          >
            <span style={{ fontSize: '18px' }}>👁️</span>
            View Invoice
          </button>

          <button
            onClick={onWhatsApp}
            style={{
              width: '100%',
              padding: '12px',
              background: '#25d366',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1fad5b')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#25d366')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ marginRight: '4px' }}
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Send via WhatsApp
          </button>

          <button
            onClick={onDownload}
            style={{
              width: '100%',
              padding: '12px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#4b5563')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#6b7280')}
          >
            <span style={{ fontSize: '18px' }}>⬇️</span>
            Download PDF
          </button>

          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              background: 'white',
              color: '#2845d6',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
