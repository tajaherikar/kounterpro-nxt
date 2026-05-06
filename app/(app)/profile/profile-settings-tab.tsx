// ProfileSettingsTab - Better organized layout matching old app
import React, { useState } from 'react'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { generateColorScheme, applyCSSColorScheme, saveColorScheme } from '@/lib/colors'
import { getCurrentUser } from '@/lib/db'

export function ProfileSettingsTab() {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [profile, setProfile] = useState({
    businessName: '',
    businessAddress: '',
    contactNumber1: '',
    contactNumber2: '',
    businessEmail: '',
    gstNumber: '',
    upiId: '',
    logoUrl: '',
    logoPosition: 'left' as const,
    showLogo: true,
    invoicePrefix: 'INV',
    startingInvoiceNumber: 1,
    currentInvoiceNumber: 1,
    termsConditions: '',
    quickBillEnabled: false,
    selectedTemplate: 'classic' as const,
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [brandColor, setBrandColor] = useState('#2845D6')
  const colorPresets = [
    { color: 'var(--primary-blue, #2845D6)', name: 'Blue' },
    { color: '#4CAF50', name: 'Green' },
    { color: '#F44336', name: 'Red' },
    { color: '#FF9800', name: 'Orange' },
    { color: '#9C27B0', name: 'Purple' },
    { color: '#00BCD4', name: 'Cyan' },
    { color: '#607D8B', name: 'Gray' },
    { color: '#212121', name: 'Black' },
  ]

  const loadProfileMemo = React.useCallback(async () => {
    try {
      const user = await getCurrentUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Profile query error:', error)
        return
      }

      if (data) {
        setProfile({
          businessName: data.business_name || '',
          businessAddress: data.business_address || '',
          contactNumber1: data.contact_number_1 || '',
          contactNumber2: data.contact_number_2 || '',
          businessEmail: data.business_email || '',
          gstNumber: data.gst_number || '',
          upiId: data.upi_id || '',
          logoUrl: data.logo_url || '',
          logoPosition: data.logo_position || 'left',
          showLogo: data.show_logo !== false,
          invoicePrefix: data.invoice_prefix || 'INV',
          startingInvoiceNumber: data.starting_invoice_number || 1,
          currentInvoiceNumber: data.current_invoice_number || 1,
          termsConditions: data.terms_conditions || '',
          quickBillEnabled: data.quick_bill_enabled || false,
          selectedTemplate: data.selected_template || 'classic',
        })
        if (data.logo_url) setLogoPreview(data.logo_url)
        const color = data.brand_color || '#2845D6'
        setBrandColor(color)
        const scheme = generateColorScheme(color)
        applyCSSColorScheme(scheme)
        saveColorScheme(scheme)
      }
    } catch (err: any) {
      console.warn('Failed to load profile (retried):', err.message)
    }
  }, [])

  React.useEffect(() => {
    loadProfileMemo()
  }, [loadProfileMemo])

  async function handleSave() {
    setLoading(true)
    try {
      const user = await getCurrentUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('user_profiles').upsert({
        id: user.id,
        business_name: profile.businessName,
        business_address: profile.businessAddress,
        contact_number_1: profile.contactNumber1,
        contact_number_2: profile.contactNumber2,
        business_email: profile.businessEmail,
        gst_number: profile.gstNumber,
        upi_id: profile.upiId,
        logo_url: profile.logoUrl,
        logo_position: profile.logoPosition,
        show_logo: profile.showLogo,
        invoice_prefix: profile.invoicePrefix,
        starting_invoice_number: profile.startingInvoiceNumber,
        current_invoice_number: profile.currentInvoiceNumber,
        terms_conditions: profile.termsConditions,
        quick_bill_enabled: profile.quickBillEnabled,
        selected_template: profile.selectedTemplate,
        brand_color: brandColor,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

      if (error) throw error
      toast.success('Profile saved successfully!')
      const scheme = generateColorScheme(brandColor)
      applyCSSColorScheme(scheme)
      saveColorScheme(scheme)
      setIsEditing(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PNG, JPEG, or SVG file')
      e.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be smaller than 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setLogoPreview(dataUrl)
      setProfile({ ...profile, logoUrl: dataUrl })
    }
    reader.readAsDataURL(file)
  }

  const fieldStyle = {
    label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 },
    input: {
      width: '100%',
      padding: '10px 12px',
      border: '1px solid var(--border-color, #e2e8f0)',
      borderRadius: 6,
      fontSize: 14,
      opacity: !isEditing ? 0.6 : 1,
      cursor: !isEditing ? 'default' : 'text',
    },
  }

  return (
    <form>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* BASIC INFORMATION */}
        <section style={{ padding: '20px', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8 }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, marginBottom: 16, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary, #64748b)' }}>
            <span className="material-icons" style={{ fontSize: 18 }}>info</span>
            Basic Information
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={fieldStyle.label as any}>Business Name <span style={{ color: 'red' }}>*</span></label>
              <input type="text" value={profile.businessName} onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} disabled={!isEditing} placeholder="e.g., KounterPro" style={fieldStyle.input as any} />
            </div>
            <div>
              <label style={fieldStyle.label as any}>Business Address <span style={{ color: 'red' }}>*</span></label>
              <textarea value={profile.businessAddress} onChange={(e) => setProfile({ ...profile, businessAddress: e.target.value })} disabled={!isEditing} rows={3} placeholder="Enter complete business address" style={{ ...fieldStyle.input as any, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={fieldStyle.label as any}>Contact Number 1 <span style={{ color: 'red' }}>*</span></label>
                <input type="tel" value={profile.contactNumber1} onChange={(e) => setProfile({ ...profile, contactNumber1: e.target.value })} disabled={!isEditing} maxLength={10} placeholder="10-digit mobile" style={fieldStyle.input as any} />
              </div>
              <div>
                <label style={fieldStyle.label as any}>Contact Number 2 (optional)</label>
                <input type="tel" value={profile.contactNumber2} onChange={(e) => setProfile({ ...profile, contactNumber2: e.target.value })} disabled={!isEditing} maxLength={10} placeholder="10-digit mobile" style={fieldStyle.input as any} />
              </div>
            </div>
            <div>
              <label style={fieldStyle.label as any}>Business Email <span style={{ color: 'red' }}>*</span></label>
              <input type="email" value={profile.businessEmail} onChange={(e) => setProfile({ ...profile, businessEmail: e.target.value })} disabled={!isEditing} placeholder="business@example.com" style={fieldStyle.input as any} />
            </div>
          </div>
        </section>

        {/* BUSINESS LOGO */}
        <section style={{ padding: '20px', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8 }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, marginBottom: 16, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary, #64748b)' }}>
            <span className="material-icons" style={{ fontSize: 18 }}>image</span>
            Business Logo
          </h4>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ width: 100, height: 100, background: 'var(--card-bg-hover, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {logoPreview ? <img src={logoPreview} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span className="material-icons" style={{ fontSize: 40, color: 'var(--text-secondary, #64748b)' }}>image</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <input type="file" id="logoInput" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoUpload} style={{ display: 'none' }} disabled={!isEditing} />
                {isEditing && (
                  <button type="button" onClick={() => document.getElementById('logoInput')?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--primary, #2845D6)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <span className="material-icons" style={{ fontSize: 18 }}>upload</span>
                    Upload Logo
                  </button>
                )}
                {logoPreview && (
                  <button type="button" onClick={() => { setLogoPreview(null); setProfile({ ...profile, logoUrl: '' }); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <span className="material-icons" style={{ fontSize: 18 }}>delete</span>
                    Delete Logo
                  </button>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>PNG, JPEG, SVG • Max 2MB • Recommended: 300x100px</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldStyle.label as any}>Logo Position</label>
              <select value={profile.logoPosition} onChange={(e) => setProfile({ ...profile, logoPosition: e.target.value as any })} disabled={!isEditing} style={fieldStyle.input as any}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-end', gap: 8, fontSize: 13, fontWeight: 600, cursor: isEditing ? 'pointer' : 'default', opacity: isEditing ? 1 : 0.6 }}>
              <input type="checkbox" checked={profile.showLogo} onChange={(e) => setProfile({ ...profile, showLogo: e.target.checked })} disabled={!isEditing} style={{ cursor: isEditing ? 'pointer' : 'default' }} />
              Show Logo on Invoices
            </label>
          </div>
        </section>

        {/* TAX INFORMATION */}
        <section style={{ padding: '20px', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8 }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, marginBottom: 16, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary, #64748b)' }}>
            <span className="material-icons" style={{ fontSize: 18 }}>account_balance</span>
            Tax Information
          </h4>
          <div>
            <label style={fieldStyle.label as any}>GST Number (optional)</label>
            <input type="text" value={profile.gstNumber} onChange={(e) => setProfile({ ...profile, gstNumber: e.target.value.toUpperCase() })} disabled={!isEditing} maxLength={15} placeholder="e.g., 29AVLPA7490C1ZH" style={{ ...fieldStyle.input as any, fontFamily: 'monospace' }} />
            <small style={{ display: 'block', color: 'var(--text-secondary, #64748b)', marginTop: 6 }}>15-character GST identification number</small>
          </div>
        </section>

        {/* PAYMENT INFORMATION */}
        <section style={{ padding: '20px', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8 }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, marginBottom: 16, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary, #64748b)' }}>
            <span className="material-icons" style={{ fontSize: 18 }}>wallet</span>
            Payment Information
          </h4>
          <div>
            <label style={fieldStyle.label as any}>UPI ID (optional)</label>
            <input type="text" value={profile.upiId} onChange={(e) => setProfile({ ...profile, upiId: e.target.value })} disabled={!isEditing} placeholder="e.g., yourname@paytm" style={fieldStyle.input as any} />
            <small style={{ display: 'block', color: 'var(--text-secondary, #64748b)', marginTop: 6 }}>For payment QR code generation</small>
          </div>
        </section>

        {/* INVOICE SETTINGS */}
        <section style={{ padding: '20px', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8 }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, marginBottom: 16, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary, #64748b)' }}>
            <span className="material-icons" style={{ fontSize: 18 }}>description</span>
            Invoice Settings
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={fieldStyle.label as any}>Invoice Number Prefix (optional)</label>
              <input type="text" value={profile.invoicePrefix} onChange={(e) => setProfile({ ...profile, invoicePrefix: e.target.value.toUpperCase() })} disabled={!isEditing} maxLength={20} placeholder="e.g., INV" style={{ ...fieldStyle.input as any, textTransform: 'uppercase' }} />
              <small style={{ display: 'block', color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>Custom prefix (e.g., INV, SHOP)</small>
            </div>
            <div>
              <label style={fieldStyle.label as any}>Starting Invoice Number (optional)</label>
              <input type="number" value={profile.startingInvoiceNumber} onChange={(e) => setProfile({ ...profile, startingInvoiceNumber: parseInt(e.target.value) || 1 })} disabled={!isEditing} min={1} max={999999} placeholder="e.g., 1" style={fieldStyle.input as any} />
              <small style={{ display: 'block', color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>First invoice number in sequence</small>
            </div>
            <div>
              <label style={fieldStyle.label as any}>Preview</label>
              <div style={{ padding: '10px 12px', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 6, fontSize: 14, fontWeight: 700, color: 'var(--primary, #2845D6)', background: 'var(--primary-light, #f0f3ff)', textAlign: 'center' }}>
                {profile.invoicePrefix}-{String(profile.currentInvoiceNumber).padStart(4, '0')}
              </div>
            </div>
          </div>
          <div>
            <label style={fieldStyle.label as any}>Terms & Conditions (optional)</label>
            <textarea value={profile.termsConditions} onChange={(e) => setProfile({ ...profile, termsConditions: e.target.value })} disabled={!isEditing} rows={4} placeholder="Enter terms and conditions to appear on all invoices..." style={{ ...fieldStyle.input as any, fontFamily: 'inherit', resize: 'vertical' }} />
            <small style={{ display: 'block', color: 'var(--text-secondary, #64748b)', marginTop: 6 }}>If left empty, default terms will be used</small>
          </div>
        </section>

        {/* QUICK BILL MODE */}
        <section style={{ padding: '20px', background: 'var(--success-light, #dcfce7)', border: '1px solid var(--success, #16a34a)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success, #16a34a)' }}>
                <span className="material-icons">flash_on</span>
                Enable Quick Bill
              </h4>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary, #1e293b)' }}>Simplified invoice creation for walk-in customers without entering details.</p>
            </div>
            <button 
              type="button"
              onClick={() => setProfile({ ...profile, quickBillEnabled: !profile.quickBillEnabled })}
              disabled={!isEditing}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                padding: '8px 14px',
                background: profile.quickBillEnabled ? 'var(--success, #16a34a)' : '#e2e8f0',
                color: profile.quickBillEnabled ? 'white' : 'var(--text-secondary, #64748b)',
                border: 'none',
                borderRadius: 6, 
                cursor: isEditing ? 'pointer' : 'default',
                fontWeight: 600, 
                fontSize: 13,
                opacity: isEditing ? 1 : 0.7,
                flexShrink: 0
              }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>
                {profile.quickBillEnabled ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              {profile.quickBillEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </section>

        {/* Brand Color Section */}
        <section style={{ padding: '20px', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-icons">palette</span>
            Application Brand Color
          </h4>
          <p style={{ fontSize: 12, color: 'var(--text-secondary, #64748b)', marginBottom: 12 }}>
            This color will be applied as primary color throughout the application and on invoices.
          </p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="color"
              value={brandColor}
              onChange={(e) => isEditing && setBrandColor(e.target.value)}
              disabled={!isEditing}
              style={{ width: 60, height: 40, border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 4, cursor: isEditing ? 'pointer' : 'default' }}
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => isEditing && /^#[0-9A-Fa-f]{6}$/.test(e.target.value) && setBrandColor(e.target.value)}
              disabled={!isEditing}
              placeholder="#2845D6"
              maxLength={7}
              style={{ padding: '8px 12px', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 4, fontSize: 13, fontFamily: 'monospace', width: 120 }}
            />
          </div>
          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary, #64748b)' }}>Quick Presets:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {colorPresets.map((preset) => (
              <button
                key={preset.color}
                type="button"
                onClick={() => isEditing && setBrandColor(preset.color)}
                title={preset.name}
                disabled={!isEditing}
                style={{
                  width: 36, height: 36, borderRadius: 4, background: preset.color,
                  border: brandColor === preset.color ? '3px solid #000' : '1px solid rgba(0,0,0,0.1)',
                  cursor: isEditing ? 'pointer' : 'default',
                  boxShadow: brandColor === preset.color ? `0 0 0 2px white, 0 0 0 4px ${preset.color}` : 'none',
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary, #64748b)' }}>App-Wide Preview:</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120, padding: 10, background: brandColor, color: '#fff', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>Primary Color</div>
            <div style={{ flex: 1, minWidth: 120, padding: 10, background: `${brandColor}20`, color: brandColor, border: `2px solid ${brandColor}`, borderRadius: 4, fontSize: 13, fontWeight: 600 }}>Light Variant</div>
            <div style={{ flex: 1, minWidth: 120, padding: 10, background: '#f8fafc', color: brandColor, border: `1px solid ${brandColor}`, borderRadius: 4, fontSize: 13, fontWeight: 600 }}>Border Style</div>
          </div>
        </section>

        {/* ACTION BUTTONS */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          {isEditing ? (
            <>
              <button type="button" onClick={() => setIsEditing(false)} style={{ padding: '10px 24px', background: 'transparent', color: 'var(--text-primary, #1e293b)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={loading} style={{ padding: '10px 24px', background: 'var(--primary, #2845D6)', color: 'white', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setIsEditing(true)} style={{ padding: '10px 24px', background: 'var(--primary, #2845D6)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
              Edit Profile
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
