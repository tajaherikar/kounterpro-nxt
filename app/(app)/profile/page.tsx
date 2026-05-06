'use client'
/**  
 * app/profile/page.tsx
 *
 * Complete profile management with tabs:
 * - Profile Settings (business info, logo, tax)
 * - Invoice Templates (template selection + brand color)
 * - Password & Security
 * - My Shops
 */
import React, { useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { ProfileSettingsTab } from './profile-settings-tab'
import { generateColorScheme, applyCSSColorScheme, saveColorScheme } from '@/lib/colors'
import { generateInvoicePDF } from '@/lib/pdf-generator'

export default function ProfilePage() {
  return <ProfileContent />
}

type Tab = 'settings' | 'templates' | 'security' | 'shops'

function ProfileContent() {
  const { user } = useAuth()
  const toast = useToast()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) ?? 'settings'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '2px solid var(--border-color, #e2e8f0)',
        flexWrap: 'wrap',
        marginBottom: 0,
      }}>
        {[
          { id: 'settings', icon: 'business', label: 'Profile Settings' },
          { id: 'templates', icon: 'receipt_long', label: 'Invoice Templates' },
          { id: 'security', icon: 'lock', label: 'Password & Security' },
          { id: 'shops', icon: 'storefront', label: 'My Shops' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              border: activeTab === tab.id ? '2px solid var(--primary, #2845D6)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--primary, #2845D6)' : 'var(--text-secondary, #64748b)',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 600 : 500,
              transition: 'all 0.2s',
              fontSize: 14,
            }}
          >
            <span className="material-icons" style={{ fontSize: 20 }}>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ paddingBottom: 24 }}>
        {activeTab === 'settings' && <ProfileSettingsTab />}
        {activeTab === 'templates' && <InvoiceTemplatesTab />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'shops' && <ShopsTab />}
      </div>
    </div>
  )
}

// ─── INVOICE TEMPLATES TAB ────────────────────────────────────────
function InvoiceTemplatesTab() {
  const toast = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const previewPDFRef = useRef<any>(null)

  // Template settings state (no logo here - it's in ProfileSettingsTab)
  const [templateType, setTemplateType] = useState<'classic' | 'modern' | 'gst_format' | 'retail'>('classic')
  const [brandColor, setBrandColor] = useState('#2845D6')

  const templates = [
    { value: 'classic', name: 'Classic', description: 'Simple, minimal layout', icon: 'description' },
    { value: 'modern', name: 'Modern', description: 'Clean with better spacing', icon: 'auto_awesome' },
    { value: 'gst_format', name: 'GST Format', description: 'Structured for compliance', icon: 'assignment' },
    { value: 'retail', name: 'Retail', description: 'Compact for retail billing', icon: 'shopping_cart' },
  ]

  // Set iframe src once both iframe exists and blob URL is ready
  React.useEffect(() => {
    if (previewBlobUrl && iframeRef.current && !previewLoading) {
      console.log('📺 iframe is ready, setting src to blob URL')
      iframeRef.current.src = previewBlobUrl
      console.log('✨ PDF should display now')
    }
  }, [previewBlobUrl, previewLoading])
  const loadSettingsMemo = React.useCallback(async () => {
    if (!user?.id) return
    
    console.log('[Profile] Loading settings for user:', user.id)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('invoice_template, brand_color')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setTemplateType(data.invoice_template || 'classic')
        const color = data.brand_color || '#2845D6'
        setBrandColor(color)
        
        // Apply color scheme to app
        const scheme = generateColorScheme(color)
        applyCSSColorScheme(scheme)
        saveColorScheme(scheme)
        
        console.log('[Profile] Settings loaded:', { template: data.invoice_template, color })
      }
    } catch (err: any) {
      console.error('[Profile] Load settings failed:', err)
      toast.error('Failed to load template settings')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  React.useEffect(() => {
    loadSettingsMemo()
  }, [loadSettingsMemo])

  async function handleSaveSettings() {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          invoice_template: templateType,
        })
        .eq('id', user.id)

      if (error) throw error
      
      toast.success('Template settings saved!')
    } catch (err: any) {
      console.error('Save failed:', err)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetSettings() {
    setTemplateType('classic')
    setBrandColor('#2845D6')
    toast.success('Settings reset to defaults')
  }

  async function handlePreviewTemplate() {
    if (!user) return
    setPreviewLoading(true)
    setShowPreview(true)

    try {
      // Load real profile data to use in preview
      let profileBiz = {
        businessName: 'Your Business Name',
        businessEmail: 'business@example.com',
        businessPhone: '+91 98765 43210',
        businessAddress: '456 Business Park, Industrial Area, Mumbai',
        gstNumber: '',
        upiId: '',
      }
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('business_name, business_address, contact_number_1, contact_number_2, business_email, gst_number, upi_id')
          .eq('id', user.id)
          .single()
        if (profileError) console.error('Profile fetch error:', profileError)
        if (profileData) {
          profileBiz = {
            businessName: profileData.business_name || profileBiz.businessName,
            businessEmail: profileData.business_email || profileBiz.businessEmail,
            businessPhone: profileData.contact_number_1 || profileBiz.businessPhone,
            businessAddress: profileData.business_address || profileBiz.businessAddress,
            gstNumber: profileData.gst_number || '',
            upiId: profileData.upi_id || '',
          }
        }
      } catch (e) { console.error('Profile fetch exception:', e) }

      // Realistic sample invoice data (3 items like old app)
      const sampleInvoice = {
        id: 'preview-001',
        invoiceNumber: 'INV-2026-001',
        date: new Date().toISOString().split('T')[0],
        customerName: 'Sample Customer Pvt Ltd',
        customerEmail: 'customer@example.com',
        customerPhone: '+91 98765 43210',
        customerGST: '27AABCU9603R1ZM',
        customerAddress: '123 Business Street, Commercial Area, Mumbai, Maharashtra - 400001',
        businessName: profileBiz.businessName,
        businessEmail: profileBiz.businessEmail,
        businessPhone: profileBiz.businessPhone,
        businessAddress: profileBiz.businessAddress,
        gstNumber: profileBiz.gstNumber,
        upiId: profileBiz.upiId,
        items: [
          {
            id: '1',
            productName: 'Product A',
            description: 'Product A - Premium Quality',
            quantity: 5,
            price: 1000,
            hsn: '8471',
            gstRate: 18,
            total: 5000,
          },
          {
            id: '2',
            productName: 'Product B',
            description: 'Product B - Standard Package',
            quantity: 10,
            price: 500,
            hsn: '8473',
            gstRate: 18,
            total: 5000,
          },
          {
            id: '3',
            productName: 'Service',
            description: 'Service Charges - Installation',
            quantity: 1,
            price: 2000,
            hsn: '9987',
            gstRate: 18,
            total: 2000,
          },
        ],
        subtotal: 12000,
        taxAmount: 2160,
        total: 14160,
        status: 'unpaid' as const,
        notes: 'Thank you for your business!',
        termsConditions: '1. Payment due within 15 days\\n2. Goods once sold will not be taken back\\n3. Subject to Mumbai jurisdiction',
        templateSettings: {
          invoice_template: templateType,
          brand_color: brandColor,
          show_logo: false,
          logo_url: null,
          logo_position: 'left' as const,
        },
      }

      // Generate PDF and display using blob URL (proven approach from old app)
      const pdf = generateInvoicePDF(sampleInvoice)
      previewPDFRef.current = pdf
      console.log('✅ PDF generated with', pdf.getNumberOfPages(), 'pages')

      // Create blob URL (like old app does)
      const pdfBlob = pdf.output('blob')
      console.log('📦 PDF Blob size:', (pdfBlob.size / 1024).toFixed(2), 'KB')
      
      const blobUrl = URL.createObjectURL(pdfBlob)
      console.log('🔗 Blob URL created:', blobUrl.substring(0, 50) + '...')
      
      // Store blob URL in state - will be set to iframe once element renders
      setPreviewBlobUrl(blobUrl)
      console.log('📝 Blob URL stored in state, will set once iframe renders')

      toast.success('Preview generated successfully!')
    } catch (error) {
      console.error('Preview generation error:', error)
      toast.error('Failed to generate preview')
      setShowPreview(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  function handleClosePreview() {
    console.log('🗑️ Closing preview modal')
    setShowPreview(false)
    // Revoke blob URL to free memory
    if (previewBlobUrl && previewBlobUrl.startsWith('blob:')) {
      console.log('🧹 Revoking blob URL')
      URL.revokeObjectURL(previewBlobUrl)
    }
    setPreviewBlobUrl(null)
    if (iframeRef.current) {
      iframeRef.current.src = ''
    }
    previewPDFRef.current = null
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 32 }}>Loading...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Template Selection */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-icons">view_quilt</span>
            Invoice Template
          </h3>
          <button
            onClick={handlePreviewTemplate}
            disabled={previewLoading}
            style={{
              padding: '8px 16px',
              background: brandColor,
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: previewLoading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: previewLoading ? 0.7 : 1,
            }}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>{previewLoading ? 'hourglass_empty' : 'preview'}</span>
            {previewLoading ? 'Generating...' : 'Preview'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {templates.map((t) => (
            <div
              key={t.value}
              onClick={() => setTemplateType(t.value as any)}
              style={{
                padding: 16,
                border: templateType === t.value ? `2px solid ${brandColor}` : '1px solid var(--border-color, #e2e8f0)',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: templateType === t.value ? `${brandColor}15` : 'var(--card-bg, #fff)',
                boxShadow: templateType === t.value ? `0 2px 8px ${brandColor}20` : 'none',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 6,
                    background: `${brandColor}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 24, color: brandColor }}>
                    {t.icon}
                  </span>
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t.name}</h4>
                  <p style={{ margin: 4, fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>{t.description}</p>
                </div>
                {templateType === t.value && (
                  <div style={{ color: brandColor, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-icons" style={{ fontSize: 16 }}>check_circle</span>
                    Selected
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save/Reset Buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button
          onClick={handleResetSettings}
          disabled={saving}
          style={{
            padding: '10px 20px',
            border: '1px solid var(--border-color, #e2e8f0)',
            background: 'transparent',
            borderRadius: 4,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: saving ? 0.6 : 1,
          }}
        >
          <span className="material-icons" style={{ fontSize: 18 }}>refresh</span>
          Reset to Default
        </button>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          style={{
            padding: '10px 20px',
            background: brandColor,
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: saving ? 0.7 : 1,
          }}
        >
          <span className="material-icons" style={{ fontSize: 18 }}>save</span>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
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
            zIndex: 9999,
            padding: 16,
          }}
          onClick={handleClosePreview}
        >
          <div
            style={{
              background: 'var(--bg-card, #fff)',
              borderRadius: 8,
              width: '95%',
              maxWidth: 1100,
              height: 'calc(100vh - 40px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: 20,
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-icons">visibility</span>
                Invoice Template Preview
              </h2>
              <button
                onClick={handleClosePreview}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-secondary, #64748b)',
                }}
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                backgroundColor: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {previewLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #64748b)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: '3px solid var(--border-color, #e2e8f0)',
                        borderTop: `3px solid ${brandColor}`,
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px',
                      }}
                    />
                    <p style={{ margin: 0 }}>Generating preview...</p>
                    <style>{`
                      @keyframes spin {
                        to { transform: rotate(360deg); }
                      }
                    `}</style>
                  </div>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  style={{
                    flex: 1,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  }}
                  title="Invoice Preview"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: 16,
                borderTop: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={handleClosePreview}
                style={{
                  padding: '10px 20px',
                  background: brandColor,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span className="material-icons" style={{ fontSize: 18 }}>close</span>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PASSWORD & SECURITY TAB ──────────────────────────────────────
function SecurityTab() {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [hasPinSet, setHasPinSet] = useState(false)
  const [pinNew, setPinNew] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [showPinNew, setShowPinNew] = useState(false)
  const [showPinConfirm, setShowPinConfirm] = useState(false)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [formState, setFormState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const loadPinStatus = React.useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('user_profiles').select('dashboard_pin').eq('id', user.id).single()
      setHasPinSet(!!(data?.dashboard_pin))
    } catch {}
  }, [])

  React.useEffect(() => { loadPinStatus() }, [loadPinStatus])

  async function hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(pin)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async function handleSetPin() {
    if (!/^\d{4}$/.test(pinNew)) {
      toast.error('PIN must be exactly 4 digits')
      return
    }
    if (pinNew !== pinConfirm) {
      toast.error('PINs do not match')
      return
    }
    setPinLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const hashed = await hashPin(pinNew)
      const { error } = await supabase.from('user_profiles').upsert({ id: user.id, dashboard_pin: hashed }, { onConflict: 'id' })
      if (error) throw error
      setHasPinSet(true)
      setPinNew('')
      setPinConfirm('')
      toast.success('Dashboard Privacy PIN set successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to set PIN')
    } finally {
      setPinLoading(false)
    }
  }

  async function handleRemovePin() {
    if (!confirm('Remove your dashboard privacy PIN? Anyone will be able to view dashboard figures without a PIN.')) return
    setPinLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('user_profiles').upsert({ id: user.id, dashboard_pin: null }, { onConflict: 'id' })
      if (error) throw error
      setHasPinSet(false)
      toast.success('Dashboard Privacy PIN removed.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove PIN')
    } finally {
      setPinLoading(false)
    }
  }

  async function handleChangePassword() {
    if (!formState.currentPassword || !formState.newPassword) {
      toast.error('Please fill in all password fields')
      return
    }
    if (formState.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (formState.newPassword !== formState.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (formState.currentPassword === formState.newPassword) {
      toast.error('New password must be different from current password')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: formState.newPassword })
      if (error) throw error
      toast.success('Password changed successfully!')
      setFormState({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Dashboard Privacy PIN */}
      <div className="form-section">
        <h3 className="section-title">
          <span className="material-icons">shield</span>
          Dashboard Privacy PIN
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-secondary, #64748b)' }}>
          Set a 4-digit PIN to protect your dashboard figures. Others must enter this PIN to view revenue data.
        </p>

        <div className="form-row" style={{ marginBottom: 16 }}>
          <span className={`pin-status-badge ${hasPinSet ? 'pin-status-set' : 'pin-status-none'}`}>
            <span className="material-icons" style={{ fontSize: 16 }}>{hasPinSet ? 'shield' : 'lock_open'}</span>
            {hasPinSet ? 'PIN is set — dashboard is protected' : 'No PIN set'}
          </span>
        </div>

        <div className="form-row">
          <label className="form-label-with-icon">
            <span className="material-icons label-icon">pin</span>
            {hasPinSet ? 'Change PIN' : 'New PIN'} (4 digits)
          </label>
          <div className="password-input-wrapper">
            <input
              type={showPinNew ? 'text' : 'password'}
              value={pinNew}
              onChange={(e) => setPinNew(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter 4-digit PIN"
              maxLength={4}
              inputMode="numeric"
            />
            <span className="password-toggle-icon material-icons" onClick={() => setShowPinNew(v => !v)}>
              {showPinNew ? 'visibility' : 'visibility_off'}
            </span>
          </div>
          <small className="form-hint">Must be exactly 4 digits</small>
        </div>

        <div className="form-row">
          <label className="form-label-with-icon">
            <span className="material-icons label-icon">pin</span>
            Confirm PIN
          </label>
          <div className="password-input-wrapper">
            <input
              type={showPinConfirm ? 'text' : 'password'}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Confirm 4-digit PIN"
              maxLength={4}
              inputMode="numeric"
            />
            <span className="password-toggle-icon material-icons" onClick={() => setShowPinConfirm(v => !v)}>
              {showPinConfirm ? 'visibility' : 'visibility_off'}
            </span>
          </div>
        </div>

        <div className="form-actions">
          {hasPinSet && (
            <button type="button" className="btn-secondary" onClick={handleRemovePin} disabled={pinLoading}>
              Remove PIN
            </button>
          )}
          <button type="button" className="btn-primary" onClick={handleSetPin} disabled={pinLoading}>
            {pinLoading ? 'Saving...' : hasPinSet ? 'Update PIN' : 'Set PIN'}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="form-section" id="passwordForm">
        <h3 className="section-title">
          <span className="material-icons">lock</span>
          Change Password
        </h3>

        <div className="form-row">
          <label className="form-label-with-icon">
            <span className="material-icons label-icon">key</span>
            Current Password
          </label>
          <div className="password-input-wrapper">
            <input
              type={showCurrentPw ? 'text' : 'password'}
              value={formState.currentPassword}
              onChange={(e) => setFormState({ ...formState, currentPassword: e.target.value })}
              placeholder="Enter current password"
            />
            <span className="password-toggle-icon material-icons" onClick={() => setShowCurrentPw(v => !v)}>
              {showCurrentPw ? 'visibility' : 'visibility_off'}
            </span>
          </div>
        </div>

        <div className="form-row">
          <label className="form-label-with-icon">
            <span className="material-icons label-icon">lock_reset</span>
            New Password
          </label>
          <div className="password-input-wrapper">
            <input
              type={showNewPw ? 'text' : 'password'}
              value={formState.newPassword}
              onChange={(e) => setFormState({ ...formState, newPassword: e.target.value })}
              placeholder="Enter new password"
            />
            <span className="password-toggle-icon material-icons" onClick={() => setShowNewPw(v => !v)}>
              {showNewPw ? 'visibility' : 'visibility_off'}
            </span>
          </div>
          <small className="form-hint">Password must be at least 6 characters</small>
        </div>

        <div className="form-row">
          <label className="form-label-with-icon">
            <span className="material-icons label-icon">lock_reset</span>
            Confirm New Password
          </label>
          <div className="password-input-wrapper">
            <input
              type={showConfirmPw ? 'text' : 'password'}
              value={formState.confirmPassword}
              onChange={(e) => setFormState({ ...formState, confirmPassword: e.target.value })}
              placeholder="Confirm new password"
            />
            <span className="password-toggle-icon material-icons" onClick={() => setShowConfirmPw(v => !v)}>
              {showConfirmPw ? 'visibility' : 'visibility_off'}
            </span>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setFormState({ currentPassword: '', newPassword: '', confirmPassword: '' })}
          >
            Clear
          </button>
          <button type="button" className="btn-primary" onClick={handleChangePassword} disabled={loading}>
            {loading ? 'Updating...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MY SHOPS TAB ─────────────────────────────────────────────
const EMPTY_MODAL_FORM = { shop_name: '', business_name: '', contact_number_1: '', business_email: '', gst_number: '', business_address: '', is_default: false }

function ShopsTab() {
  const toast = useToast()
  const { user } = useAuth()
  const [shops, setShops] = useState<any[]>([])
  const [loadingShops, setLoadingShops] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingShop, setEditingShop] = useState<any>(null)
  const [modalForm, setModalForm] = useState({ ...EMPTY_MODAL_FORM })
  const [savingShop, setSavingShop] = useState(false)

  const loadShops = React.useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('id, shop_name, business_name, contact_number_1, business_email, gst_number, business_address, is_default, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      setShops(data || [])
    } catch {
      toast.error('Failed to load shops')
    } finally {
      setLoadingShops(false)
    }
  }, [user?.id])

  React.useEffect(() => { loadShops() }, [loadShops])

  function openAddModal() {
    setEditingShop(null)
    setModalForm({ ...EMPTY_MODAL_FORM, is_default: shops.length === 0 })
    setShowModal(true)
  }

  function openEditModal(shop: any) {
    setEditingShop(shop)
    setModalForm({
      shop_name: shop.shop_name || '',
      business_name: shop.business_name || '',
      contact_number_1: shop.contact_number_1 || '',
      business_email: shop.business_email || '',
      gst_number: shop.gst_number || '',
      business_address: shop.business_address || '',
      is_default: shop.is_default || false,
    })
    setShowModal(true)
  }

  async function handleSaveShop() {
    if (!modalForm.shop_name.trim()) {
      toast.error('Shop name is required')
      return
    }
    if (!user?.id) return
    setSavingShop(true)
    try {
      if (editingShop) {
        // If setting as default, clear other defaults first
        if (modalForm.is_default && !editingShop.is_default) {
          await supabase.from('shops').update({ is_default: false }).eq('user_id', user.id)
        }
        const { error } = await supabase.from('shops').update({
          shop_name: modalForm.shop_name.trim(),
          business_name: modalForm.business_name.trim() || null,
          contact_number_1: modalForm.contact_number_1.trim() || null,
          business_email: modalForm.business_email.trim() || null,
          gst_number: modalForm.gst_number.trim().toUpperCase() || null,
          business_address: modalForm.business_address.trim() || null,
          is_default: modalForm.is_default,
        }).eq('id', editingShop.id)
        if (error) throw error
        toast.success('Shop updated!')
      } else {
        if (modalForm.is_default) {
          await supabase.from('shops').update({ is_default: false }).eq('user_id', user.id)
        }
        const { error } = await supabase.from('shops').insert({
          user_id: user.id,
          shop_name: modalForm.shop_name.trim(),
          business_name: modalForm.business_name.trim() || null,
          contact_number_1: modalForm.contact_number_1.trim() || null,
          business_email: modalForm.business_email.trim() || null,
          gst_number: modalForm.gst_number.trim().toUpperCase() || null,
          business_address: modalForm.business_address.trim() || null,
          is_default: modalForm.is_default,
        })
        if (error) throw error
        toast.success('Shop added!')
      }
      setShowModal(false)
      loadShops()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save shop')
    } finally {
      setSavingShop(false)
    }
  }

  async function handleSetDefault(id: string) {
    if (!user?.id) return
    try {
      await supabase.from('shops').update({ is_default: false }).eq('user_id', user.id)
      const { error } = await supabase.from('shops').update({ is_default: true }).eq('id', id)
      if (error) throw error
      setShops(shops.map(s => ({ ...s, is_default: s.id === id })))
      toast.success('Default shop updated!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update default shop')
    }
  }

  async function handleDeleteShop(id: string) {
    const shop = shops.find(s => s.id === id)
    if (shop?.is_default) {
      toast.error('Cannot delete the default shop')
      return
    }
    if (!confirm(`Delete "${shop?.shop_name}"? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from('shops').delete().eq('id', id)
      if (error) throw error
      setShops(shops.filter(s => s.id !== id))
      toast.success('Shop removed!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete shop')
    }
  }

  if (loadingShops) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary, #64748b)' }}>Loading shops...</div>

  return (
    <>
      <div className="form-section">
        <div className="section-header-row">
          <h3 className="section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
            <span className="material-icons">storefront</span>
            My Shops
          </h3>
          <button type="button" className="btn-primary btn-sm" onClick={openAddModal}>
            <span className="material-icons">add</span> Add Shop
          </button>
        </div>

        {shops.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary, #64748b)' }}>
            <span className="material-icons" style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>storefront</span>
            <p style={{ margin: 0 }}>No shops yet. Click &ldquo;Add Shop&rdquo; to get started.</p>
          </div>
        ) : (
          <div className="shops-list">
            {shops.map((shop) => (
              <div key={shop.id} className={`shop-card${shop.is_default ? ' shop-card-active' : ''}`}>
                <div className="shop-card-info">
                  <div className="shop-card-name">
                    <span className="material-icons">storefront</span>
                    {shop.shop_name}
                    {shop.is_default && (
                      <span style={{ background: 'var(--primary, #2845D6)', color: 'white', padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        Default
                      </span>
                    )}
                  </div>
                  {(shop.business_name || shop.business_email || shop.contact_number_1) && (
                    <div className="shop-card-sub">
                      {shop.business_name && <><span className="material-icons" style={{ fontSize: 13 }}>business</span>{shop.business_name}</>}
                      {shop.contact_number_1 && <><span className="material-icons" style={{ fontSize: 13, marginLeft: shop.business_name ? 8 : 0 }}>phone</span>{shop.contact_number_1}</>}
                      {shop.business_email && <><span className="material-icons" style={{ fontSize: 13, marginLeft: 8 }}>email</span>{shop.business_email}</>}
                    </div>
                  )}
                </div>
                <div className="shop-card-actions">
                  <button type="button" className="btn-sm btn-secondary" onClick={() => openEditModal(shop)}>
                    <span className="material-icons">edit</span> Edit
                  </button>
                  {!shop.is_default && (
                    <button type="button" className="btn-sm btn-secondary" onClick={() => handleSetDefault(shop.id)}>
                      <span className="material-icons">check_circle</span> Set Default
                    </button>
                  )}
                  <button type="button" className="btn-sm btn-danger" onClick={() => handleDeleteShop(shop.id)} disabled={shop.is_default}>
                    <span className="material-icons">delete</span> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Shop Modal */}
      {showModal && (
        <div className="shop-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="shop-modal-box">
            <div className="modal-header">
              <h2><span className="material-icons">storefront</span> {editingShop ? 'Edit Shop' : 'Add New Shop'}</h2>
              <button className="btn-close-modal" onClick={() => setShowModal(false)} aria-label="Close">
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-label-with-icon">
                  <span className="material-icons label-icon">store</span>
                  <span>Shop Name <span className="required">*</span></span>
                </label>
                <input type="text" value={modalForm.shop_name} onChange={(e) => setModalForm({ ...modalForm, shop_name: e.target.value })} placeholder="e.g., Main Branch" maxLength={100} />
              </div>
              <div className="form-row">
                <label className="form-label-with-icon">
                  <span className="material-icons label-icon">business</span>
                  <span>Business Name</span>
                </label>
                <input type="text" value={modalForm.business_name} onChange={(e) => setModalForm({ ...modalForm, business_name: e.target.value })} placeholder="e.g., Keen Batteries" maxLength={100} />
              </div>
              <div className="form-row">
                <label className="form-label-with-icon">
                  <span className="material-icons label-icon">phone</span>
                  <span>Phone Number</span>
                </label>
                <input type="tel" value={modalForm.contact_number_1} onChange={(e) => setModalForm({ ...modalForm, contact_number_1: e.target.value })} placeholder="e.g., 9876543210" maxLength={15} />
              </div>
              <div className="form-row">
                <label className="form-label-with-icon">
                  <span className="material-icons label-icon">email</span>
                  <span>Email</span>
                </label>
                <input type="email" value={modalForm.business_email} onChange={(e) => setModalForm({ ...modalForm, business_email: e.target.value })} placeholder="shop@example.com" />
              </div>
              <div className="form-row">
                <label className="form-label-with-icon">
                  <span className="material-icons label-icon">receipt</span>
                  <span>GST Number</span>
                </label>
                <input type="text" value={modalForm.gst_number} onChange={(e) => setModalForm({ ...modalForm, gst_number: e.target.value })} placeholder="e.g., 29ABCDE1234F1Z5" maxLength={15} />
              </div>
              <div className="form-row">
                <label className="form-label-with-icon">
                  <span className="material-icons label-icon">home</span>
                  <span>Address</span>
                </label>
                <textarea value={modalForm.business_address} onChange={(e) => setModalForm({ ...modalForm, business_address: e.target.value })} rows={2} placeholder="Shop address" maxLength={200} />
              </div>
              <div className="form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="shopIsDefaultCheck" checked={modalForm.is_default} onChange={(e) => setModalForm({ ...modalForm, is_default: e.target.checked })} style={{ width: 'auto' }} />
                <label htmlFor="shopIsDefaultCheck" style={{ margin: 0 }}>Set as default shop</label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                <span className="material-icons">close</span> Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveShop} disabled={savingShop}>
                <span className="material-icons">save</span> {savingShop ? 'Saving...' : 'Save Shop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
