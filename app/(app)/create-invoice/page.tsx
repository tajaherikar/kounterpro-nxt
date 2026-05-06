'use client'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useRouter } from 'next/navigation'

import { useCustomers, useInventory, useInvoices, useCreateInvoice } from '@/hooks/useAPI'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/context/AuthContext'
import { formatRupee } from '@/lib/currency'
import { fetchUserProfile, updateUserProfile, deductInventoryStock } from '@/lib/db'
import InvoiceSuccessModal from '@/components/InvoiceSuccessModal'
import BillPrintModal from '@/components/BillPrintModal'
import type { Customer, InventoryItem, UserProfile, Invoice } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────

type InvoiceMode = 'full' | 'quick'

interface LineItem {
  id: string
  description: string
  inventoryId?: string
  hsnCode: string
  serialNo: string
  quantity: number
  rate: number
  discountPct: number
  gstRate: number
}

interface QBItem {
  id: string
  description: string
  quantity: number
  rate: number
  discountPct: number
  gstRate: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

function newLineItem(): LineItem {
  return { id: genId(), description: '', hsnCode: '', serialNo: '', quantity: 1, rate: 0, discountPct: 0, gstRate: 18 }
}

function newQBItem(): QBItem {
  return { id: genId(), description: '', quantity: 1, rate: 0, discountPct: 0, gstRate: 18 }
}

function r2(n: number) { return Math.round(n * 100) / 100 }

function calcItem(item: LineItem, taxMode: 'with-tax' | 'without-tax') {
  if (taxMode === 'with-tax') {
    const amountIncl = item.quantity * item.rate * (1 - item.discountPct / 100)
    const rateExcl = item.rate / (1 + item.gstRate / 100)
    const amountExcl = item.quantity * rateExcl * (1 - item.discountPct / 100)
    return { amount: amountIncl, subtotal: amountExcl, gstAmt: amountIncl - amountExcl }
  }
  const amount = item.quantity * item.rate * (1 - item.discountPct / 100)
  return { amount, subtotal: amount, gstAmt: 0 }
}

function calcQBItem(item: QBItem, gstEnabled: boolean) {
  const grossAmount = item.quantity * item.rate * (1 - item.discountPct / 100)
  if (!gstEnabled) return { amount: r2(grossAmount), exclGST: r2(grossAmount), gstAmt: 0 }
  const rateExcl = item.rate / (1 + item.gstRate / 100)
  const exclGST = r2(item.quantity * rateExcl * (1 - item.discountPct / 100))
  const amount = r2(grossAmount)
  return { amount, exclGST, gstAmt: r2(amount - exclGST) }
}

function generateInvoiceNum(
  profile: UserProfile | null,
  invoices: Array<{ invoice_number?: string | null; tax_mode?: string | null }>,
  isGstEnabled: boolean = true
): string {
  if (profile?.invoice_prefix) {
    // For custom prefix: use separate counters for GST and non-GST
    // BUT also check actual invoices to find the highest number (in case counter is out of sync)
    
    // Filter invoices by tax mode
    const relevantInvoices = invoices.filter(inv => {
      if (isGstEnabled) {
        return !inv.tax_mode || inv.tax_mode === 'with-tax'
      } else {
        return inv.tax_mode === 'without-tax'
      }
    })
    
    // Find the highest number from actual invoices
    let maxInvoiceNumber = 0
    relevantInvoices.forEach(invoice => {
      const invoiceNum = String(invoice.invoice_number ?? '')
      const prefix = isGstEnabled ? profile.invoice_prefix : `${profile.invoice_prefix}NT`
      // Match custom prefix format: KP-001, KPNT-001, etc.
      const pattern = new RegExp(`^${prefix}-0*(\\d+)`)
      const match = invoiceNum.match(pattern)
      if (match) {
        const num = parseInt(match[1])
        if (num > maxInvoiceNumber) {
          maxInvoiceNumber = num
        }
      }
    })
    
    // Use the higher of: counter-based next number OR max found in invoices + 1
    const startingNum = profile.starting_invoice_number ?? 1
    const profileCounter = isGstEnabled ? (profile.gst_invoice_counter ?? 0) : (profile.non_gst_invoice_counter ?? 0)
    const counterBasedNum = startingNum + profileCounter
    const nextNum = Math.max(counterBasedNum, maxInvoiceNumber + 1)
    
    const paddedNum = String(nextNum).padStart(4, '0')
    const suffix = isGstEnabled ? '' : 'NT'
    return `${profile.invoice_prefix}${suffix}-${paddedNum}`
  }
  
  // Legacy format: K0001/MM/YY/FY or KNT0001/MM/YY/FY for non-GST
  const now = new Date()
  const month = now.getMonth() + 1
  const yr = now.getFullYear()
  const fyStart = month >= 4 ? String(yr).slice(-2) : String(yr - 1).slice(-2)
  const fyEnd = month >= 4 ? String(yr + 1).slice(-2) : String(yr).slice(-2)
  
  // Filter invoices by tax mode to get the correct max number
  const relevantInvoices = invoices.filter(inv => {
    if (isGstEnabled) {
      return !inv.tax_mode || inv.tax_mode === 'with-tax'
    } else {
      return inv.tax_mode === 'without-tax'
    }
  })
  
  const maxNum = Math.max(0, ...relevantInvoices.map(inv => {
    const invoiceNum = String(inv.invoice_number ?? '')
    const prefix = isGstEnabled ? 'K' : 'KNT'
    const pattern = new RegExp(`${prefix}(\\d+)\\/`)
    const m = invoiceNum.match(pattern)
    return m ? parseInt(m[1]) : 0
  }))
  
  const prefix = isGstEnabled ? 'K' : 'KNT'
  return `${prefix}${String(maxNum + 1).padStart(4, '0')}/${month}/${fyStart}/${fyEnd}`
}

const DEFAULT_TERMS =
  '1. Goods once sold will not be taken back or exchanged.\n' +
  '2. All disputes are subject to local jurisdiction only.\n' +
  '3. E. & O.E.'

// ─── Mode switcher inline styles ──────────────────────────────────────────

const switcherStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  background: '#f0f3ff', border: '1.5px solid #e0e4f8',
  borderRadius: 28, padding: 4, gap: 2, marginBottom: 14,
}
const tabBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 18px', borderRadius: 22, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s',
  background: 'transparent', border: 'none', color: '#6b7280',
}
const tabActive: React.CSSProperties = {
  ...tabBase, background: '#2845D6', color: '#fff',
  boxShadow: '0 2px 6px rgba(40,69,214,.25)',
}

// ─── Page shell ───────────────────────────────────────────────────────────

export default function CreateInvoicePage() {
  return <CreateInvoiceContent />
}

// ─── Main content ─────────────────────────────────────────────────────────

function CreateInvoiceContent() {
  const { user } = useAuth()
  const toast = useToast()
  const router = useRouter()
  const { data: customers = [] } = useCustomers()
  const { data: inventoryItems = [] } = useInventory()
  const { data: invoices = [] } = useInvoices()
  const createInvoiceMutation = useCreateInvoice()

  // ── Profile ───────────────────────────────────────────────
  const [profile, setProfile] = useState<UserProfile | null>(null)
  useEffect(() => {
    if (user?.id) {
      fetchUserProfile(user.id)
        .then(p => setProfile(p as UserProfile | null))
        .catch(err => {
          console.warn('Failed to load profile:', err.message)
          // Continue without profile data — app will use defaults
        })
    }
  }, [user?.id])

  // ── Mode selection ────────────────────────────────────────
  const [mode, setMode] = useState<InvoiceMode>('full')
  const quickBillEnabled = profile?.quick_bill_enabled ?? false

  // ── Invoice header ───────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceNumberEditing, setInvoiceNumberEditing] = useState(false)
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0])
  const [gstEnabled, setGstEnabled] = useState(true)

  // Generate invoice number once profile + invoices are loaded, or when GST status changes
  // Only auto-generate if user hasn't manually edited the invoice number
  useEffect(() => {
    if (!invoiceNumberEditing) {
      setInvoiceNumber(generateInvoiceNum(profile, invoices, gstEnabled))
    }
  }, [profile, invoices, gstEnabled, invoiceNumberEditing])

  // ── Tax mode (full invoice only) ───────────────────────────────
  const [taxMode, setTaxMode] = useState<'with-tax' | 'without-tax'>('with-tax')
  const [interState, setInterState] = useState(false)
  const effectiveTaxMode = gstEnabled ? taxMode : 'without-tax'

  // ── Customer (full invoice) ───────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [custName, setCustName] = useState('')
  const [custMobile, setCustMobile] = useState('')
  const [custAddress, setCustAddress] = useState('')
  const [custGST, setCustGST] = useState('')
  const customerRef = useRef<HTMLDivElement>(null)
  const custInputRef = useRef<HTMLInputElement>(null)
  const [custDropPos, setCustDropPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const updateCustDropPos = () => {
    const el = custInputRef.current
    if (!el) {
      setCustDropPos(null)
      return
    }
    const rect = el.getBoundingClientRect()
    setCustDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    if (!q) return customers.slice(0, 8)
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || (c.mobile ?? '').includes(q)
    ).slice(0, 8)
  }, [customers, customerSearch])

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c)
    setCustName(c.name)
    setCustMobile(c.mobile ?? '')
    setCustAddress(c.address ?? '')
    setCustGST(c.gst_number ?? c.gst ?? '')
    setCustomerSearch(c.name)
    setShowCustomerDrop(false)
    setCustDropPos(null)
  }

  function clearCustomer() {
    setSelectedCustomer(null)
    setCustName('')
    setCustMobile('')
    setCustAddress('')
    setCustGST('')
    setCustomerSearch('')
    setCustDropPos(null)
  }

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
        setShowCustomerDrop(false)
        setCustDropPos(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // ── Customer (quick bill - optional) ──────────────────────────
  const [qbCustName, setQbCustName] = useState('')
  const [qbCustMobile, setQbCustMobile] = useState('')

  // ── Line items (full invoice) ─────────────────────────────────
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()])
  const [activeRowAC, setActiveRowAC] = useState<string | null>(null)
  const [rowSearch, setRowSearch] = useState<Record<string, string>>({})

  function updateItem(id: string, field: keyof LineItem, value: unknown) {
    setLineItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  function addItem() { setLineItems(prev => [...prev, newLineItem()]) }

  function removeItem(id: string) {
    setLineItems(prev => prev.length <= 1 ? prev : prev.filter(it => it.id !== id))
  }

  function pickInventory(rowId: string, inv: InventoryItem) {
    setLineItems(prev => prev.map(it => it.id === rowId ? {
      ...it,
      description: inv.name,
      inventoryId: inv.id,
      hsnCode: inv.hsn_code ?? '',
      rate: inv.rate ?? 0,
      gstRate: inv.gst_rate ?? 18,
    } : it))
    setActiveRowAC(null)
    setRowSearch(prev => { const next = { ...prev }; delete next[rowId]; return next })
  }

  const descInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const [acDropPos, setAcDropPos] = useState<{ top: number; left: number; width: number } | null>(null)

  function updateACPos(rowId: string) {
    const el = descInputRefs.current.get(rowId)
    if (!el) { setAcDropPos(null); return }
    const rect = el.getBoundingClientRect()
    setAcDropPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(300, rect.width) })
  }

  function invForRow(rowId: string) {
    const term = (rowSearch[rowId] ?? '').toLowerCase()
    if (!term) return inventoryItems.slice(0, 8)
    return inventoryItems.filter(i =>
      i.name.toLowerCase().includes(term) || (i.hsn_code ?? '').toLowerCase().includes(term)
    ).slice(0, 8)
  }

  // ── Items (quick bill) ────────────────────────────────────────
  const [qbItems, setQbItems] = useState<QBItem[]>([newQBItem()])
  const [qbActiveRowAC, setQbActiveRowAC] = useState<string | null>(null)
  const [qbRowSearch, setQbRowSearch] = useState<Record<string, string>>({})
  const qbDescInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const [qbAcDropPos, setQbAcDropPos] = useState<{ top: number; left: number; width: number } | null>(null)

  function updateQbItem(id: string, field: keyof QBItem, value: unknown) {
    setQbItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  function addQbItem() { setQbItems(prev => [...prev, newQBItem()]) }

  function removeQbItem(id: string) {
    setQbItems(prev => prev.length <= 1 ? prev : prev.filter(it => it.id !== id))
  }

  function pickQbInventory(rowId: string, inv: InventoryItem) {
    setQbItems(prev => prev.map(it => it.id === rowId ? {
      ...it,
      description: inv.name,
      rate: inv.rate ?? 0,
      gstRate: inv.gst_rate ?? 18,
    } : it))
    setQbActiveRowAC(null)
    setQbAcDropPos(null)
    setQbRowSearch(prev => { const next = { ...prev }; delete next[rowId]; return next })
  }

  function updateQbACPos(rowId: string) {
    const el = qbDescInputRefs.current.get(rowId)
    if (!el) { setQbAcDropPos(null); return }
    const rect = el.getBoundingClientRect()
    setQbAcDropPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(280, rect.width) })
  }

  function qbInvForRow(rowId: string) {
    const term = (qbRowSearch[rowId] ?? '').toLowerCase()
    if (!term) return inventoryItems.slice(0, 8)
    return inventoryItems.filter(i =>
      i.name.toLowerCase().includes(term) || (i.hsn_code ?? '').toLowerCase().includes(term)
    ).slice(0, 8)
  }

  // ── Totals (full invoice) ─────────────────────────────────────
  const totals = useMemo(() => {
    let subtotal = 0, gstAmt = 0, discountSaved = 0
    lineItems.forEach(it => {
      const res = calcItem(it, effectiveTaxMode)
      subtotal += res.subtotal
      gstAmt += res.gstAmt
      if (it.discountPct > 0) {
        discountSaved += it.quantity * it.rate * (it.discountPct / 100)
      }
    })
    subtotal = r2(subtotal)
    gstAmt = r2(gstAmt)
    discountSaved = r2(discountSaved)
    const grandTotal = r2(subtotal + gstAmt)
    const half = r2(gstAmt / 2)
    return { subtotal, gstAmt, discountSaved, grandTotal, cgst: half, sgst: r2(gstAmt - half), igst: gstAmt }
  }, [lineItems, effectiveTaxMode])

  // ── Totals (quick bill) ───────────────────────────────────────
  const qbTotals = useMemo(() => {
    let exclSubtotal = 0, totalGST = 0
    qbItems.forEach(it => {
      const { exclGST, gstAmt } = calcQBItem(it, gstEnabled)
      exclSubtotal += exclGST
      totalGST += gstAmt
    })
    exclSubtotal = r2(exclSubtotal)
    totalGST = r2(totalGST)
    const grandTotal = r2(exclSubtotal + totalGST)
    const half = r2(totalGST / 2)
    return { exclSubtotal, totalGST, grandTotal, cgst: half, sgst: r2(totalGST - half), igst: totalGST }
  }, [qbItems, gstEnabled])

  // ── Payment ───────────────────────────────────────────────────
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'upi' | 'card'>('cash')

  // ── Terms (full invoice only) ─────────────────────────────────
  const [termsOpen, setTermsOpen] = useState(false)
  const [termsText, setTermsText] = useState(DEFAULT_TERMS)

  // ── Notes (full invoice only) ─────────────────────────────────
  const [notes, setNotes] = useState('')

  // ── Save state ────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const isLocked = !!savedId

  // Helper to format WhatsApp message
  function formatWhatsAppMessage(invoice: Invoice): string {
    const companyName = profile?.business_name || 'KounterPro'
    const items = Array.isArray(invoice.items) ? invoice.items : []
    
    let message = `*${companyName.toUpperCase()}*\n`
    message += `Tax Invoice\n\n`
    message += `📄 *Invoice No:* ${invoice.invoice_number}\n`
    message += `📅 *Date:* ${invoice.date ? new Date(invoice.date).toLocaleDateString('en-IN') : ''}\n\n`
    
    message += `*Bill To:*\n`
    message += `${invoice.customer_name}\n`
    message += `${invoice.customer_address || ''}\n`
    if (invoice.customer_gst) {
      message += `GST: ${invoice.customer_gst}\n`
    }
    message += `\n`
    
    message += `*Items:*\n`
    message += `━━━━━━━━━━━━━━━━━━\n`
    
    items.forEach((item: any) => {
      message += `${item.description}\n`
      message += `  Qty: ${item.quantity} × ₹${formatRupee(item.rate).replace('₹', '')} = ₹${formatRupee((item.quantity * item.rate) as number).replace('₹', '')}\n`
    })
    
    message += `━━━━━━━━━━━━━━━━━━\n\n`
    message += `*Total:* ₹${formatRupee(invoice.total_amount || 0).replace('₹', '')}\n\n`
    message += `📄 *PDF Invoice attached*\n`
    message += `Please see the attached PDF document for the complete details.\n\n`
    message += `Thank you for your business! 🙏\n\n`
    message += `_This is a computer generated invoice._`
    
    return message
  }

  // Send WhatsApp
  function handleSendWhatsApp() {
    if (!savedInvoice) return
    
    const mobile = savedInvoice.customer_mobile?.replace(/\D/g, '') || ''
    if (!mobile) {
      toast.error('Customer mobile number is required')
      return
    }
    
    const message = encodeURIComponent(formatWhatsAppMessage(savedInvoice))
    const countryCode = '91' // India
    const whatsappUrl = `https://wa.me/${countryCode}${mobile}?text=${message}`
    
    toast.info('💡 Tip: After WhatsApp opens, attach the PDF invoice before sending')
    window.open(whatsappUrl, '_blank')
  }

  // Download PDF directly
  function handleDownloadPDF() {
    if (!savedInvoice) return
    // Trigger the print dialog which can be saved as PDF
    const printWindow = window.open('', '_blank', 'width=960,height=650')
    if (!printWindow) {
      toast.error('Could not open print window')
      return
    }

    const brandColor = '#2845D6'
    const invoiceDate = new Date(savedInvoice.date || Date.now()).toLocaleDateString('en-IN')
    const items = Array.isArray(savedInvoice.items) ? savedInvoice.items : []
    
    const rows = items
      .map((item: any, i: number) => `
        <tr>
          <td style="padding:8px;text-align:left;border-bottom:1px solid #e5e7eb">${i + 1}</td>
          <td style="padding:8px;text-align:left;border-bottom:1px solid #e5e7eb">${item.description || ''}</td>
          ${item.hsn_code ? `<td style="padding:8px;text-align:center;font-size:11px;border-bottom:1px solid #e5e7eb">${item.hsn_code}</td>` : ''}
          <td style="padding:8px;text-align:center;border-bottom:1px solid #e5e7eb">${item.quantity}</td>
          <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb">₹${item.rate || 0}</td>
          ${item.gstRate ? `<td style="padding:8px;text-align:center;border-bottom:1px solid #e5e7eb">${item.gstRate}%</td>` : ''}
          <td style="padding:8px;text-align:right;font-weight:600;border-bottom:1px solid #e5e7eb">₹${(item.quantity * item.rate)}</td>
        </tr>
      `)
      .join('')

    const statusColor: Record<string, string> = {
      paid: '#dcfce7',
      unpaid: '#fee2e2',
    }
    const statusText: Record<string, string> = {
      paid: '#065f46',
      unpaid: '#b91c1c',
    }

    const paidStatus = savedInvoice.payment_status === 'paid' ? 'Paid' : 'Unpaid'
    const statusBg = statusColor[savedInvoice.payment_status || 'unpaid'] || '#fee2e2'
    const statusTextColor = statusText[savedInvoice.payment_status || 'unpaid'] || '#b91c1c'

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${savedInvoice.invoice_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 12px; color: #1a1a1a; padding: 24px; max-width: 960px; margin: 0 auto; }
    .container { background: white; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid ${brandColor}; }
    .business-name { font-size: 18px; font-weight: 800; color: ${brandColor}; margin-bottom: 4px; }
    .business-meta { font-size: 11px; color: #666; line-height: 1.5; }
    .invoice-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .invoice-number { font-size: 18px; font-weight: 700; color: ${brandColor}; margin: 4px 0; }
    .invoice-date { font-size: 11px; color: #666; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 10px; font-weight: 600; background: ${statusBg}; color: ${statusTextColor}; margin-top: 8px; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .party-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; }
    .party-label { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px; }
    .party-name { font-size: 12px; font-weight: 600; margin-bottom: 2px; }
    .party-detail { font-size: 11px; color: #666; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    thead tr { background: ${brandColor}; color: white; }
    th { padding: 8px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    tbody tr:nth-child(even) { background: #fafafa; }
    .summary { display: flex; justify-content: flex-end; margin: 20px 0; }
    .summary-table { width: 280px; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
    .summary-row.total { font-weight: 700; font-size: 13px; color: ${brandColor}; border-top: 2px solid ${brandColor}; border-bottom: none; padding-top: 8px; }
    .footer { text-align: center; font-size: 10px; color: #999; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
    @media print { @page { margin: 0.5cm; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="business-name">${profile?.business_name?.toUpperCase() || 'BUSINESS'}</div>
        ${profile?.address ? `<div class="business-meta">${profile.address}</div>` : ''}
        ${profile?.mobile ? `<div class="business-meta">Ph: ${profile.mobile}</div>` : ''}
        ${profile?.gst_number ? `<div class="business-meta">GST: ${profile.gst_number}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div class="invoice-title">Tax Invoice</div>
        <div class="invoice-number">#${savedInvoice.invoice_number}</div>
        <div class="invoice-date">${invoiceDate}</div>
        <div class="status-badge">${paidStatus}</div>
      </div>
    </div>

    <div class="parties">
      <div class="party-box">
        <div class="party-label">Bill To</div>
        <div class="party-name">${savedInvoice.customer_name}</div>
        ${savedInvoice.customer_mobile ? `<div class="party-detail">Phone: ${savedInvoice.customer_mobile}</div>` : ''}
        ${savedInvoice.customer_gst ? `<div class="party-detail">GST: ${savedInvoice.customer_gst}</div>` : ''}
        ${savedInvoice.customer_address ? `<div class="party-detail">${savedInvoice.customer_address}</div>` : ''}
      </div>
      <div class="party-box">
        <div class="party-label">Invoice Details</div>
        <div class="party-detail">Invoice No: ${savedInvoice.invoice_number}</div>
        <div class="party-detail">Date: ${invoiceDate}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 5%">#</th>
          <th style="width: 50%">Description</th>
          ${items.some((i: any) => i.hsn_code) ? `<th style="width: 10%;">HSN</th>` : ''}
          <th style="width: 10%;text-align:center">Qty</th>
          <th style="width: 15%;text-align:right">Rate (₹)</th>
          ${items.some((i: any) => i.gstRate) ? `<th style="width: 8%;text-align:center">GST%</th>` : ''}
          <th style="width: 15%;text-align:right">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-table">
        <div class="summary-row">
          <span>Subtotal</span>
          <span style="text-align:right;font-weight:600">₹${savedInvoice.subtotal || 0}</span>
        </div>
        ${savedInvoice.tax_mode === 'with-tax' && (savedInvoice.gst_amount ?? 0) > 0 ? `
          <div class="summary-row">
            <span>GST</span>
            <span style="text-align:right;font-weight:600">₹${savedInvoice.gst_amount ?? 0}</span>
          </div>
        ` : ''}
        <div class="summary-row total">
          <span>Total</span>
          <span>₹${savedInvoice.total_amount}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for your business!</p>
      <p style="margin-top: 4px">This is a computer-generated invoice</p>
    </div>
  </div>
</body>
</html>
    `

    printWindow.document.write(htmlContent)
    setTimeout(() => {
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }, 500)
  }

  async function handleSave() {
    if (mode === 'full') {
      return handleSaveFull()
    } else {
      return handleSaveQuick()
    }
  }

  async function handleSaveFull() {
    const effName = custName.trim() || selectedCustomer?.name || 'Walk-in Customer'
    if (!invoiceNumber.trim()) { toast.error('Invoice number is required'); return }
    if (lineItems.some(it => !it.description.trim())) { toast.error('All items need a description'); return }
    if (lineItems.some(it => it.rate <= 0)) { toast.error('All items need a rate greater than 0'); return }
    setSaving(true)
    try {
      const items = lineItems.map(it => {
        const { amount, subtotal } = calcItem(it, effectiveTaxMode)
        return {
          description: it.description,
          hsn_code: it.hsnCode || undefined,
          serial_no: it.serialNo || undefined,
          quantity: it.quantity,
          rate: it.rate,
          discount_percent: it.discountPct || undefined,
          gstRate: it.gstRate,
          amount: r2(amount),
          subtotal: r2(subtotal),
          inventory_id: it.inventoryId,
        }
      })

      const saved = await createInvoiceMutation.mutateAsync({
        user_id: user!.id,
        invoice_number: invoiceNumber,
        customer_name: effName,
        customer_mobile: custMobile,
        customer_address: custAddress || undefined,
        customer_gst: custGST || undefined,
        date: invoiceDate,
        items,
        total_amount: totals.grandTotal,
        subtotal: totals.subtotal,
        gst_amount: gstEnabled ? totals.gstAmt : 0,
        tax_mode: effectiveTaxMode,
        is_inter_state: interState,
        payment_type: paymentType,
        terms_conditions: termsText,
        notes: notes || undefined,
        is_quick_bill: false,
      })

      // Deduct inventory stock
      for (const it of lineItems) {
        if (it.inventoryId) {
          await deductInventoryStock(it.inventoryId, it.quantity).catch(() => null)
        }
      }

      // Increment counter if using custom prefix
      if (profile?.invoice_prefix && user?.id) {
        if (gstEnabled) {
          await updateUserProfile(user.id, {
            gst_invoice_counter: (profile.gst_invoice_counter ?? 0) + 1,
          }).catch(() => null)
        } else {
          await updateUserProfile(user.id, {
            non_gst_invoice_counter: (profile.non_gst_invoice_counter ?? 0) + 1,
          }).catch(() => null)
        }
      }

      setSavedId(saved?.id ?? null)
      setSavedInvoice(saved)
      setShowSuccessModal(true)
      toast.success('Invoice saved!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save invoice')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveQuick() {
    if (!invoiceNumber.trim()) { toast.error('Invoice number is required'); return }
    if (qbItems.some(it => !it.description.trim())) { toast.error('All items need a description'); return }
    if (qbItems.some(it => it.rate <= 0)) { toast.error('All items need a rate greater than 0'); return }
    setSaving(true)
    try {
      const invoiceItems = qbItems.map(it => {
        const { amount, exclGST } = calcQBItem(it, gstEnabled)
        return {
          description: it.description,
          quantity: it.quantity,
          rate: it.rate,
          discount_percent: it.discountPct || undefined,
          gstRate: it.gstRate,
          amount,
          subtotal: exclGST,
        }
      })

      const saved = await createInvoiceMutation.mutateAsync({
        user_id: user!.id,
        invoice_number: invoiceNumber,
        customer_name: qbCustName.trim() || 'Walk-in Customer',
        customer_mobile: qbCustMobile,
        date: invoiceDate,
        items: invoiceItems,
        total_amount: qbTotals.grandTotal,
        subtotal: gstEnabled ? qbTotals.exclSubtotal : qbTotals.grandTotal,
        gst_amount: gstEnabled ? qbTotals.totalGST : 0,
        tax_mode: gstEnabled ? 'with-tax' : 'without-tax',
        is_inter_state: interState,
        payment_type: paymentType,
        is_quick_bill: true,
      })

      if (profile?.invoice_prefix && user?.id) {
        if (gstEnabled) {
          await updateUserProfile(user.id, {
            gst_invoice_counter: (profile.gst_invoice_counter ?? 0) + 1,
          }).catch(() => null)
        } else {
          await updateUserProfile(user.id, {
            non_gst_invoice_counter: (profile.non_gst_invoice_counter ?? 0) + 1,
          }).catch(() => null)
        }
      }

      setSavedId(saved?.id ?? null)
      setSavedInvoice(saved)
      setShowSuccessModal(true)
      toast.success('Bill saved!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save bill')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{paddingBottom: 48 }}>

      {/* Mode switcher - only show if quick bill is enabled */}
      {quickBillEnabled && (
        <div style={switcherStyle}>
          <button
            type="button"
            style={mode === 'full' ? tabActive : tabBase}
            onClick={() => setMode('full')}
            disabled={isLocked}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>receipt_long</span>
            Full Invoice
          </button>
          <button
            type="button"
            style={mode === 'quick' ? tabActive : tabBase}
            onClick={() => setMode('quick')}
            disabled={isLocked}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>bolt</span>
            Quick Invoice
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* FULL INVOICE MODE */}
      {/* ════════════════════════════════════════════════════════════════ */}

      {mode === 'full' && (
        <>

      {/* Header strip: Invoice No / Date / GST toggle */}
      <div className="inv-header-strip">
        <div className="inv-header-field inv-header-field--invoiceno">
          <label className="inv-label">Invoice No</label>
          <div className="invoice-number-field">
            {invoiceNumberEditing ? (
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                onBlur={() => setInvoiceNumberEditing(false)}
                onKeyDown={e => e.key === 'Enter' && setInvoiceNumberEditing(false)}
                autoFocus
                style={{ border: '1.5px solid #2845D6', borderRadius: 6, padding: '4px 8px', fontSize: 14, outline: 'none', width: 140 }}
              />
            ) : (
              <>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', letterSpacing: .5 }}>
                  {invoiceNumber || '\u2026'}
                </span>
                {!isLocked && (
                  <button type="button" className="edit-invoice-number-btn" onClick={() => setInvoiceNumberEditing(true)}>
                    <span className="material-icons" style={{ fontSize: 14 }}>edit</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="inv-header-field inv-header-field--date">
          <label className="inv-label">Invoice Date</label>
          <input
            type="date"
            value={invoiceDate}
            onChange={e => setInvoiceDate(e.target.value)}
            disabled={isLocked}
            style={{ border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', fontSize: 13 }}
          />
        </div>

        <div className="inv-header-field inv-header-field--gst">
          <label className="inv-label">GST</label>
          <div className="gst-onoff-wrap">
            <label className="gst-onoff-switch">
              <input
                type="checkbox"
                checked={gstEnabled}
                onChange={e => {
                  setGstEnabled(e.target.checked)
                  setInvoiceNumberEditing(false) // Reset so invoice number auto-regenerates
                }}
                disabled={isLocked}
              />
              <span className="gst-onoff-slider"></span>
            </label>
            <span className="gst-onoff-label">{gstEnabled ? 'ON' : 'OFF'}</span>
          </div>
        </div>
      </div>

      {/* Tax mode + inter-state row */}
      {gstEnabled && (
        <div className="inv-block" style={{ padding: '10px 16px', marginBottom: 12, marginTop: 12, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Tax Mode:</span>
          <div className="gst-mode-pills">
            {(['with-tax', 'without-tax'] as const).map(tm => (
              <label
                key={tm}
                className="gst-pill"
                style={taxMode === tm ? { background: '#2845D6', color: '#fff', borderColor: '#2845D6' } : {}}
              >
                <input type="radio" name="taxMode" value={tm} checked={taxMode === tm} onChange={() => setTaxMode(tm)} disabled={isLocked} style={{ display: 'none' }} />
                {tm === 'with-tax' ? 'Rate incl. GST' : 'Rate excl. GST'}
              </label>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={interState} onChange={e => setInterState(e.target.checked)} disabled={isLocked} />
            Inter-state supply (IGST)
          </label>
        </div>
      )}

      {/* Customer block */}
      <div className="inv-block" ref={customerRef} style={{ marginTop: 12 }}>
          <div className="inv-block-title">
            <span className="material-icons" style={{ fontSize: 16 }}>person</span> Customer
          </div>
          {selectedCustomer ? (
            <div className="cust-card-main">
              <div className="cust-avatar">{custName.charAt(0).toUpperCase()}</div>
              <div className="cust-info">
                <div className="cust-name">{custName}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{custMobile}</div>
                {custGST && <div style={{ fontSize: 12, color: '#6b7280' }}>GST: {custGST}</div>}
                {custAddress && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{custAddress}</div>}
              </div>
              <button type="button" className="cust-edit-btn" onClick={clearCustomer} disabled={isLocked}>
                <span className="material-icons" style={{ fontSize: 14 }}>edit</span> Change
              </button>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <input
                  ref={custInputRef}
                  type="text"
                  className="inv-search-input"
                  placeholder="Search or enter customer name…"
                  value={customerSearch}
                  onChange={e => {
                    setCustomerSearch(e.target.value)
                    setCustName(e.target.value)
                    setShowCustomerDrop(true)
                    setTimeout(() => updateCustDropPos(), 0)
                  }}
                  onFocus={() => {
                    setShowCustomerDrop(true)
                    setTimeout(() => updateCustDropPos(), 0)
                  }}
                  disabled={isLocked}
                />
              </div>
              {showCustomerDrop && filteredCustomers.length > 0 && custDropPos && (
                <div
                  style={{
                    position: 'fixed',
                    top: `${custDropPos.top}px`,
                    left: `${custDropPos.left}px`,
                    width: `${custDropPos.width}px`,
                    background: 'white',
                    border: '1.5px solid #e5e7eb',
                    borderRadius: '6px',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    zIndex: 9999,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  {filteredCustomers.map(c => (
                    <div
                      key={c.id}
                      onMouseDown={() => selectCustomer(c)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                    >
                      <strong style={{ fontSize: '14px', color: '#1f2937' }}>{c.name}</strong>
                      {c.mobile && (
                        <span style={{ marginLeft: 8, color: '#9ca3af', fontSize: 12 }}>
                          {c.mobile}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="customer-secondary-fields">
                <div className="inv-field-compact">
                  <label>Mobile</label>
                  <input type="tel" value={custMobile} onChange={e => setCustMobile(e.target.value)} placeholder="10-digit mobile" maxLength={12} disabled={isLocked} />
                </div>
                <div className="inv-field-compact">
                  <label>GSTIN</label>
                  <input type="text" value={custGST} onChange={e => setCustGST(e.target.value.toUpperCase())} placeholder="GST number (optional)" maxLength={15} disabled={isLocked} />
                </div>
                <div className="inv-field-compact" style={{ gridColumn: 'span 2' }}>
                  <label>Address</label>
                  <textarea
                    value={custAddress}
                    onChange={e => setCustAddress(e.target.value)}
                    rows={2}
                    placeholder="Billing address (optional)"
                    disabled={isLocked}
                    style={{ resize: 'vertical', width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

      {/* Items block - FULL MODE */}
      <div className="inv-block inv-items-block" style={{ marginTop: 16 }}>
        <div className="inv-block-title">
          <span className="material-icons" style={{ fontSize: 16 }}>list_alt</span> Items
        </div>
        <div style={{ overflowX: 'auto', position: 'relative' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#6b7280', minWidth: 180 }}>Description</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 12, fontWeight: 600, color: '#6b7280', width: 70 }}>HSN</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 12, fontWeight: 600, color: '#6b7280', width: 60 }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 12, fontWeight: 600, color: '#6b7280', width: 80 }}>Rate</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 12, fontWeight: 600, color: '#6b7280', width: 60 }}>Disc %</th>
                {gstEnabled && <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 12, fontWeight: 600, color: '#6b7280', width: 70 }}>GST %</th>}
                <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#6b7280', width: 90 }}>Amount</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map(it => {
                const { amount } = calcItem(it, effectiveTaxMode)
                return (
                  <tr key={it.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 10px', position: 'relative' }}>
                      <input
                        ref={el => { if (el) descInputRefs.current.set(it.id, el); else descInputRefs.current.delete(it.id) }}
                        type="text"
                        value={rowSearch[it.id] !== undefined ? rowSearch[it.id] : it.description}
                        onChange={e => {
                          const v = e.target.value
                          setRowSearch(prev => ({ ...prev, [it.id]: v }))
                          updateItem(it.id, 'description', v)
                          setActiveRowAC(it.id)
                          updateACPos(it.id)
                        }}
                        onFocus={() => { setActiveRowAC(it.id); updateACPos(it.id) }}
                        onBlur={() => setTimeout(() => { setActiveRowAC(null); setAcDropPos(null) }, 160)}
                        placeholder="Item description"
                        disabled={isLocked}
                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, background: 'transparent' }}
                      />
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                      {it.hsnCode}
                    </td>
                    <td style={{ padding: '6px' }}>
                      <div className="qty-stepper">
                        <button type="button" className="qty-btn qty-dec" onClick={() => updateItem(it.id, 'quantity', Math.max(0.01, it.quantity - 1))} disabled={isLocked}>−</button>
                        <input
                          type="number"
                          value={it.quantity}
                          min={0.01}
                          onChange={e => updateItem(it.id, 'quantity', Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                          disabled={isLocked}
                          style={{ width: 40, textAlign: 'center', border: 'none', outline: 'none', fontSize: 13, background: 'transparent' }}
                        />
                        <button type="button" className="qty-btn qty-inc" onClick={() => updateItem(it.id, 'quantity', it.quantity + 1)} disabled={isLocked}>+</button>
                      </div>
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        type="number"
                        value={it.rate || ''}
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        onChange={e => updateItem(it.id, 'rate', parseFloat(e.target.value) || 0)}
                        disabled={isLocked}
                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, background: 'transparent', textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        type="number"
                        value={it.discountPct || ''}
                        min={0}
                        max={100}
                        step={0.5}
                        placeholder="0"
                        onChange={e => updateItem(it.id, 'discountPct', Math.min(100, parseFloat(e.target.value) || 0))}
                        disabled={isLocked}
                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, background: 'transparent', textAlign: 'center' }}
                      />
                    </td>
                    {gstEnabled && (
                      <td style={{ padding: '6px' }}>
                        <select
                          value={it.gstRate}
                          onChange={e => updateItem(it.id, 'gstRate', parseInt(e.target.value))}
                          disabled={isLocked}
                          style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 4, padding: '3px 4px', fontSize: 12 }}
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </td>
                    )}
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: '#1a1a2e' }}>
                      {formatRupee(amount)}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        disabled={lineItems.length <= 1 || isLocked}
                        style={{ background: 'none', border: 'none', cursor: lineItems.length <= 1 ? 'not-allowed' : 'pointer', color: '#ef4444', opacity: lineItems.length <= 1 ? .3 : 1, padding: 2 }}
                      >
                        <span className="material-icons" style={{ fontSize: 16 }}>remove_circle_outline</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Add item + totals row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12, flexWrap: 'wrap', gap: 12 }}>
          <button type="button" className="btn-add-item" onClick={addItem} disabled={isLocked}>
            <span className="material-icons" style={{ fontSize: 16 }}>add</span> Add Item
          </button>

          <div style={{ minWidth: 220 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span>Subtotal</span>
              <span>{formatRupee(totals.subtotal)}</span>
            </div>
            {totals.discountSaved > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span>Discount</span>
                <span>−{formatRupee(totals.discountSaved)}</span>
              </div>
            )}
            {gstEnabled && interState && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span>IGST ({(totals.gstAmt / totals.subtotal * 100).toFixed(1)}%)</span>
                <span>{formatRupee(totals.igst)}</span>
              </div>
            )}
            {gstEnabled && !interState && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span>CGST ({(totals.cgst / totals.subtotal * 100).toFixed(1)}%)</span>
                  <span>{formatRupee(totals.cgst)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span>SGST ({(totals.sgst / totals.subtotal * 100).toFixed(1)}%)</span>
                  <span>{formatRupee(totals.sgst)}</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#1a1a2e', padding: '6px 0', borderTop: '2px solid #e5e7eb', marginTop: 2 }}>
              <span>TOTAL</span>
              <span>{formatRupee(totals.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="inv-block" style={{ marginTop: 12 }}>
        <div className="inv-block-title">
          <span className="material-icons" style={{ fontSize: 16 }}>payments</span> Payment Method
        </div>
        <div className="payment-pills">
          {(['cash', 'credit'] as const).map(pm => (
            <label key={pm} className="payment-pill">
              <input type="radio" name="pmtType" value={pm} checked={paymentType === pm} onChange={() => setPaymentType(pm)} disabled={isLocked} />
              <span>
                <span className="material-icons">{pm === 'cash' ? 'payments' : 'credit_card'}</span>
                {pm === 'cash' ? 'Cash' : 'Credit'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Terms & Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 12 }}>
        <div className="inv-block">
          <div className="inv-block-title">
            <span className="material-icons" style={{ fontSize: 16 }}>description</span> Terms & Conditions
          </div>
          <button
            type="button"
            onClick={() => setTermsOpen(!termsOpen)}
            disabled={isLocked}
            style={{
              background: 'none',
              border: 'none',
              color: '#2845D6',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
              padding: 0,
              opacity: isLocked ? 0.5 : 1,
              textDecoration: 'underline',
            }}
          >
            {termsOpen ? 'Hide' : 'Edit'}
          </button>
          {termsOpen && (
            <textarea
              value={termsText}
              onChange={e => setTermsText(e.target.value)}
              disabled={isLocked}
              rows={4}
              style={{
                width: '100%',
                marginTop: 8,
                border: '1.5px solid #e5e7eb',
                borderRadius: 6,
                padding: '8px',
                fontSize: 12,
                fontFamily: 'monospace',
                resize: 'vertical',
              }}
            />
          )}
        </div>

        <div className="inv-block">
          <div className="inv-block-title">
            <span className="material-icons" style={{ fontSize: 16 }}>note</span> Notes
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            disabled={isLocked}
            rows={4}
            placeholder="Additional notes (optional)"
            style={{
              width: '100%',
              marginTop: 8,
              border: '1.5px solid #e5e7eb',
              borderRadius: 6,
              padding: '8px',
              fontSize: 12,
              resize: 'vertical',
            }}
          />
        </div>
      </div>

      {/* Inventory autocomplete portal - FULL MODE */}
      {activeRowAC && acDropPos && typeof document !== 'undefined' && invForRow(activeRowAC).length > 0 &&
        ReactDOM.createPortal(
          <div
            className="autocomplete-dropdown"
            style={{ position: 'fixed', top: acDropPos.top, left: acDropPos.left, width: acDropPos.width, zIndex: 9999 }}
          >
            {invForRow(activeRowAC).map(inv => (
              <div key={inv.id} className="autocomplete-item" onMouseDown={() => pickInventory(activeRowAC, inv)}>
                <span style={{ fontWeight: 600 }}>{inv.name}</span>
                {inv.hsn_code && <span style={{ marginLeft: 6, color: '#9ca3af', fontSize: 11 }}>HSN: {inv.hsn_code}</span>}
                <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 12 }}>{formatRupee(inv.rate)}</span>
              </div>
            ))}
          </div>,
          document.body
        )
      }

        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* QUICK BILL MODE */}
      {/* ════════════════════════════════════════════════════════════════ */}

      {mode === 'quick' && (
        <>

      {/* Bill info */}
      <div className="inv-block">
        <div className="inv-block-title">
          <span className="material-icons" style={{ fontSize: 16 }}>receipt</span> Bill Info
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Bill No</label>
            {invoiceNumberEditing ? (
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                onBlur={() => setInvoiceNumberEditing(false)}
                onKeyDown={e => e.key === 'Enter' && setInvoiceNumberEditing(false)}
                autoFocus
                style={{ border: '1.5px solid #2845D6', borderRadius: 6, padding: '6px 8px', fontSize: 14, outline: 'none', width: '100%' }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{invoiceNumber || '\u2026'}</span>
                {!isLocked && (
                  <button
                    type="button"
                    className="edit-invoice-number-btn"
                    onClick={() => setInvoiceNumberEditing(true)}
                  >
                    <span className="material-icons" style={{ fontSize: 14 }}>edit</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 140px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              disabled={isLocked}
              style={{ border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', fontSize: 13, width: '100%' }}
            />
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>GST</label>
            <div className="gst-onoff-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="gst-onoff-switch">
                <input type="checkbox" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)} disabled={isLocked} />
                <span className="gst-onoff-slider"></span>
              </label>
              <span className="gst-onoff-label">{gstEnabled ? 'ON' : 'OFF'}</span>
            </div>
          </div>

          {gstEnabled && (
            <div style={{ flex: '0 0 auto' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginTop: 18 }}>
                <input type="checkbox" checked={interState} onChange={e => setInterState(e.target.checked)} disabled={isLocked} />
                IGST (inter-state)
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Customer (optional) */}
      <div className="inv-block" style={{ marginTop: 12 }}>
        <div className="inv-block-title">
          <span className="material-icons" style={{ fontSize: 16 }}>person_outline</span>
          Customer
          <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6, fontSize: 11, color: '#9ca3af' }}>(optional)</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Name</label>
            <input
              type="text"
              value={qbCustName}
              onChange={e => setQbCustName(e.target.value)}
              placeholder="Walk-in Customer"
              disabled={isLocked}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}
            />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Mobile</label>
            <input
              type="tel"
              value={qbCustMobile}
              onChange={e => setQbCustMobile(e.target.value)}
              placeholder="Phone number"
              maxLength={12}
              disabled={isLocked}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}
            />
          </div>
        </div>
      </div>

      {/* Items - QUICK MODE */}
      <div className="inv-block" style={{ marginTop: 12 }}>
        <div className="inv-block-title">
          <span className="material-icons" style={{ fontSize: 16 }}>list</span> Items
        </div>
        <div style={{ overflowX: 'auto', position: 'relative' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#6b7280', minWidth: 160 }}>Description</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 12, fontWeight: 600, color: '#6b7280', width: 80 }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', fontSize: 12, fontWeight: 600, color: '#6b7280', width: 90 }}>Rate (₹)</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 12, fontWeight: 600, color: '#6b7280', width: 60 }}>Disc %</th>
                {gstEnabled && <th style={{ textAlign: 'center', padding: '8px 6px', fontSize: 12, fontWeight: 600, color: '#6b7280', width: 70 }}>GST %</th>}
                <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#6b7280', width: 90 }}>Amount</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {qbItems.map(it => {
                const { amount } = calcQBItem(it, gstEnabled)
                return (
                  <tr key={it.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 10px', position: 'relative' }}>
                      <input
                        ref={el => { if (el) qbDescInputRefs.current.set(it.id, el); else qbDescInputRefs.current.delete(it.id) }}
                        type="text"
                        value={qbRowSearch[it.id] !== undefined ? qbRowSearch[it.id] : it.description}
                        onChange={e => {
                          const v = e.target.value
                          setQbRowSearch(prev => ({ ...prev, [it.id]: v }))
                          updateQbItem(it.id, 'description', v)
                          setQbActiveRowAC(it.id)
                          updateQbACPos(it.id)
                        }}
                        onFocus={() => { setQbActiveRowAC(it.id); updateQbACPos(it.id) }}
                        onBlur={() => setTimeout(() => { setQbActiveRowAC(null); setQbAcDropPos(null) }, 160)}
                        placeholder="Item description"
                        disabled={isLocked}
                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, background: 'transparent' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <div className="qty-stepper">
                        <button type="button" className="qty-btn qty-dec" onClick={() => updateQbItem(it.id, 'quantity', Math.max(0.01, it.quantity - 1))} disabled={isLocked}>−</button>
                        <input
                          type="number"
                          value={it.quantity}
                          min={0.01}
                          onChange={e => updateQbItem(it.id, 'quantity', Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                          disabled={isLocked}
                          style={{ width: 40, textAlign: 'center', border: 'none', outline: 'none', fontSize: 13, background: 'transparent' }}
                        />
                        <button type="button" className="qty-btn qty-inc" onClick={() => updateQbItem(it.id, 'quantity', it.quantity + 1)} disabled={isLocked}>+</button>
                      </div>
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        type="number"
                        value={it.rate || ''}
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        onChange={e => updateQbItem(it.id, 'rate', parseFloat(e.target.value) || 0)}
                        disabled={isLocked}
                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, background: 'transparent', textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input
                        type="number"
                        value={it.discountPct || ''}
                        min={0}
                        max={100}
                        step={0.5}
                        placeholder="0"
                        onChange={e => updateQbItem(it.id, 'discountPct', Math.min(100, parseFloat(e.target.value) || 0))}
                        disabled={isLocked}
                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, background: 'transparent', textAlign: 'center' }}
                      />
                    </td>
                    {gstEnabled && (
                      <td style={{ padding: '6px' }}>
                        <select
                          value={it.gstRate}
                          onChange={e => updateQbItem(it.id, 'gstRate', parseInt(e.target.value))}
                          disabled={isLocked}
                          style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 4, padding: '3px 4px', fontSize: 12 }}
                        >
                          <option value={0}>0%</option>
                          <option value={3}>3%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </td>
                    )}
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontSize: 13, color: '#1a1a2e' }}>
                      {formatRupee(amount)}
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      <button
                        type="button"
                        onClick={() => removeQbItem(it.id)}
                        disabled={qbItems.length <= 1 || isLocked}
                        style={{ background: 'none', border: 'none', cursor: qbItems.length <= 1 ? 'not-allowed' : 'pointer', color: '#ef4444', opacity: qbItems.length <= 1 ? .3 : 1, padding: 2 }}
                      >
                        <span className="material-icons" style={{ fontSize: 16 }}>remove_circle_outline</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Add item + totals row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12, flexWrap: 'wrap', gap: 12 }}>
          <button type="button" className="btn-add-item" onClick={addQbItem} disabled={isLocked}>
            <span className="material-icons" style={{ fontSize: 16 }}>add</span> Add Item
          </button>

          <div style={{ minWidth: 220 }}>
            {gstEnabled && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span>Subtotal (excl. GST)</span>
                <span>{formatRupee(qbTotals.exclSubtotal)}</span>
              </div>
            )}
            {gstEnabled && interState && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span>IGST ({(qbTotals.totalGST / qbTotals.exclSubtotal * 100).toFixed(1)}%)</span>
                <span>{formatRupee(qbTotals.igst)}</span>
              </div>
            )}
            {gstEnabled && !interState && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span>CGST ({(qbTotals.cgst / qbTotals.exclSubtotal * 100).toFixed(1)}%)</span>
                  <span>{formatRupee(qbTotals.cgst)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span>SGST ({(qbTotals.sgst / qbTotals.exclSubtotal * 100).toFixed(1)}%)</span>
                  <span>{formatRupee(qbTotals.sgst)}</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#1a1a2e', padding: '6px 0', borderTop: '2px solid #e5e7eb', marginTop: 2 }}>
              <span>TOTAL</span>
              <span>{formatRupee(qbTotals.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="inv-block" style={{ marginTop: 12 }}>
        <div className="inv-block-title">
          <span className="material-icons" style={{ fontSize: 16 }}>payments</span> Payment Method
        </div>
        <div className="payment-pills">
          {(['cash', 'upi', 'card'] as const).map(pm => (
            <label key={pm} className="payment-pill">
              <input
                type="radio"
                name="qbPayType"
                value={pm}
                checked={paymentType === pm}
                onChange={() => setPaymentType(pm)}
                disabled={isLocked}
              />
              <span>
                <span className="material-icons">
                  {pm === 'cash' ? 'payments' : pm === 'upi' ? 'qr_code' : 'credit_card'}
                </span>
                {pm === 'cash' ? 'Cash' : pm === 'upi' ? 'UPI' : 'Card'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Inventory autocomplete portal - QUICK MODE */}
      {qbActiveRowAC && qbAcDropPos && typeof document !== 'undefined' && qbInvForRow(qbActiveRowAC).length > 0 &&
        ReactDOM.createPortal(
          <div
            className="autocomplete-dropdown"
            style={{ position: 'fixed', top: qbAcDropPos.top, left: qbAcDropPos.left, width: qbAcDropPos.width, zIndex: 9999 }}
          >
            {qbInvForRow(qbActiveRowAC).map(inv => (
              <div key={inv.id} className="autocomplete-item" onMouseDown={() => pickQbInventory(qbActiveRowAC, inv)}>
                <span style={{ fontWeight: 600 }}>{inv.name}</span>
                {inv.hsn_code && <span style={{ marginLeft: 6, color: '#9ca3af', fontSize: 11 }}>HSN: {inv.hsn_code}</span>}
                <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 12 }}>{formatRupee(inv.rate)}</span>
              </div>
            ))}
          </div>,
          document.body
        )
      }

        </>
      )}

      {/* Actions */}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn-secondary" onClick={() => router.push('/reports')} disabled={saving}>
          Cancel
        </button>
        {savedId ? (
          <button type="button" className="btn-primary" onClick={() => setShowPrintModal(true)}>
            <span className="material-icons" style={{ fontSize: 16 }}>receipt</span> View Invoice
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : mode === 'full' ? 'Save Invoice' : 'Save Bill'}
          </button>
        )}
      </div>

      {/* Success Modal */}
      <InvoiceSuccessModal
        isOpen={showSuccessModal}
        invoice={savedInvoice}
        onClose={() => {
          setShowSuccessModal(false)
          // Reset form after closing modal
          setMode('full')
          setSavedId(null)
          setSavedInvoice(null)
          // Reset form fields would go here if needed
        }}
        onView={() => {
          setShowSuccessModal(false)
          setShowPrintModal(true)
        }}
        onDownload={() => {
          setShowSuccessModal(false)
          handleDownloadPDF()
        }}
        onWhatsApp={() => {
          setShowSuccessModal(false)
          handleSendWhatsApp()
        }}
      />

      {/* Print Modal */}
      {showPrintModal && savedInvoice && (() => {
        const gstEnabled = savedInvoice.tax_mode === 'with-tax'
        const gstAmount = savedInvoice.gst_amount || 0
        const isInterState = savedInvoice.is_inter_state || false
        let cgst: number | undefined
        let sgst: number | undefined
        let igst: number | undefined

        if (gstEnabled) {
          if (isInterState) {
            igst = gstAmount
          } else {
            // Split GST evenly between CGST and SGST
            cgst = parseFloat((gstAmount / 2).toFixed(2))
            sgst = parseFloat((gstAmount - cgst).toFixed(2))
          }
        }

        return (
          <BillPrintModal
            isOpen={showPrintModal}
            bill={{
              id: savedInvoice.id,
              invoiceNumber: savedInvoice.invoice_number,
              customerName: savedInvoice.customer_name,
              customerPhone: savedInvoice.customer_mobile,
              customerAddress: savedInvoice.customer_address,
              customerGST: savedInvoice.customer_gst,
              date: savedInvoice.date || new Date().toISOString().split('T')[0],
              items: (savedInvoice.items as any[])?.map((item: any) => ({
                description: item.description,
                quantity: item.quantity,
                rate: item.rate,
                hsn: item.hsn_code,
                gstRate: item.gstRate,
              })),
              subtotal: savedInvoice.subtotal || 0,
              taxAmount: gstAmount,
              total: savedInvoice.total_amount || 0,
              notes: savedInvoice.notes,
              gstEnabled,
              isInterState,
              cgst,
              sgst,
              igst,
            }}
            businessProfile={{
              business_name: profile?.business_name,
              business_address: profile?.address,
              contact_number_1: profile?.mobile,
              gst_number: profile?.gst_number,
            }}
            onClose={() => setShowPrintModal(false)}
          />
        )
      })()}
    </div>
  )
}
