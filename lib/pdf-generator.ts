import jsPDF from 'jspdf'
import { formatRupeePDF } from './currency'
import { round2 } from './gst'

export interface InvoiceItem {
  id: string
  productName: string
  description?: string
  quantity: number
  price: number
  discount?: number
  gstRate?: number
  hsn?: string
  serialNumbers?: string
  total: number
}

export interface TemplateSettings {
  invoice_template?: 'classic' | 'modern' | 'gst_format' | 'retail'
  brand_color?: string
  logo_url?: string | null
  logo_position?: 'left' | 'center' | 'right'
  show_logo?: boolean
}

export interface InvoiceData {
  id: string
  invoiceNumber: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  customerGST?: string
  customerAddress?: string
  date: string
  dueDate?: string
  items: InvoiceItem[]
  subtotal: number
  taxAmount: number
  total: number
  status: 'paid' | 'unpaid' | 'partial'
  amountPaid?: number
  notes?: string
  termsConditions?: string
  businessName?: string
  businessEmail?: string
  businessPhone?: string
  businessAddress?: string
  gstNumber?: string
  upiId?: string
  cgst?: number
  sgst?: number
  igst?: number
  isInterState?: boolean
  gstEnabled?: boolean
  templateSettings?: TemplateSettings
}

/**
 * Returns the correct CGST/SGST or IGST rows for the summary section.
 * Uses pre-computed values if present; falls back to splitting taxAmount evenly.
 */
function buildGSTRows(invoice: InvoiceData): Array<{ label: string; value: string }> {
  if (invoice.taxAmount <= 0) return []
  const halfTax = round2(invoice.taxAmount / 2)
  const cgst = invoice.cgst ?? halfTax
  const sgst = invoice.sgst ?? round2(invoice.taxAmount - halfTax)
  const igst = invoice.igst ?? 0
  const subtotal = invoice.subtotal || invoice.taxAmount / 0.18 // fallback if subtotal missing
  const gstRate = subtotal > 0 ? (invoice.taxAmount / subtotal * 100).toFixed(1) : '0'
  const cgstRate = subtotal > 0 ? (cgst / subtotal * 100).toFixed(1) : '0'
  const sgstRate = subtotal > 0 ? (sgst / subtotal * 100).toFixed(1) : '0'
  
  if (invoice.isInterState || igst > 0) {
    return [{ label: `IGST (${gstRate}%):`, value: formatRupeePDF(igst > 0 ? igst : invoice.taxAmount) }]
  }
  return [
    { label: `CGST (${cgstRate}%):`, value: formatRupeePDF(cgst) },
    { label: `SGST (${sgstRate}%):`, value: formatRupeePDF(sgst) },
  ]
}

/**
 * Helper function to convert hex color to RGB array
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [40, 69, 214]
}

/**
 * Apply brand color to PDF text
 */
function applyBrandColor(pdf: jsPDF, colorHex: string) {
  const [r, g, b] = hexToRgb(colorHex)
  pdf.setTextColor(r, g, b)
}

/**
 * Apply brand color as fill
 */
function applyBrandFillColor(pdf: jsPDF, colorHex: string) {
  const [r, g, b] = hexToRgb(colorHex)
  pdf.setFillColor(r, g, b)
}

/**
 * Reset text color to black
 */
function resetTextColor(pdf: jsPDF) {
  pdf.setTextColor(0, 0, 0)
}

export function generateInvoicePDF(invoice: InvoiceData): jsPDF {
  // Template settings with defaults
  const brandColor = invoice.templateSettings?.brand_color || '#2845D6'
  const templateType = invoice.templateSettings?.invoice_template || 'classic'

  // Route to different template generators
  switch (templateType) {
    case 'modern':
      return generateModernTemplate(invoice, brandColor)
    case 'gst_format':
      return generateGSTTemplate(invoice, brandColor)
    case 'retail':
      return generateRetailTemplate(invoice, brandColor)
    case 'classic':
    default:
      return generateClassicTemplate(invoice, brandColor)
  }
}

/**
 * Classic Template - Traditional formal invoice with full details
 */
function generateClassicTemplate(invoice: InvoiceData, brandColor: string): jsPDF {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - 2 * margin

  let yPosition = margin

  // ═══════════════════════ HEADER SECTION ═══════════════════════
  pdf.setFontSize(18)
  pdf.setFont('Helvetica', 'bold')
  applyBrandColor(pdf, brandColor)
  pdf.text(invoice.businessName || 'KUNTERPRO', margin, yPosition)
  resetTextColor(pdf)
  yPosition += 8

  // Business details on left
  pdf.setFontSize(9)
  pdf.setFont('Helvetica', 'normal')
  const businessInfo = [
    invoice.businessPhone && `Phone: ${invoice.businessPhone}`,
    invoice.businessEmail && `Email: ${invoice.businessEmail}`,
    invoice.businessAddress && invoice.businessAddress,
    invoice.gstNumber && `GST: ${invoice.gstNumber}`,
  ].filter(Boolean) as string[]

  businessInfo.forEach((line) => {
    pdf.text(line, margin, yPosition)
    yPosition += 3.5
  })

  // Invoice details on right side
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(10)
  applyBrandColor(pdf, brandColor)
  const invoiceno = `INVOICE #: ${invoice.invoiceNumber}`
  pdf.text(invoiceno, pageWidth - margin - pdf.getTextWidth(invoiceno), margin)
  resetTextColor(pdf)

  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(9)
  const dateText = `Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}`
  const dueDateText = `Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'N/A'}`
  const statusText = `Status: ${invoice.status.toUpperCase()}`

  let detailY = margin + 4
  pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), detailY)
  detailY += 4
  pdf.text(dueDateText, pageWidth - margin - pdf.getTextWidth(dueDateText), detailY)
  detailY += 4
  pdf.text(statusText, pageWidth - margin - pdf.getTextWidth(statusText), detailY)

  yPosition = Math.max(yPosition, detailY) + 3

  // ═══════════════════════ CUSTOMER SECTION ═══════════════════════
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('BILL TO:', margin, yPosition)
  yPosition += 4

  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(9)
  const customerLines = [
    `Name: ${invoice.customerName}`,
    invoice.customerPhone && `Phone: ${invoice.customerPhone}`,
    invoice.customerEmail && `Email: ${invoice.customerEmail}`,
    invoice.customerGST && `GST: ${invoice.customerGST}`,
    invoice.customerAddress && `Address: ${invoice.customerAddress}`,
  ].filter(Boolean) as string[]

  customerLines.forEach((line) => {
    const wrapped = pdf.splitTextToSize(line as string, contentWidth * 0.6)
    wrapped.forEach((wrappedLine: string) => {
      pdf.text(wrappedLine, margin, yPosition)
      yPosition += 3
    })
  })

  yPosition += 2

  // ═══════════════════════ ITEMS TABLE ═══════════════════════
  const tableTop = yPosition
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(8)

  // Columns sized to fill full content width (186mm at margin=12)
  // sl(8) + desc(52) + hsn(18) + qty(12) + rate(26) + disc(18) + gst(15) + amount(37) = 186
  const cols = {
    sl:     { x: margin,       width: 8  },
    desc:   { x: margin + 8,   width: 52 },
    hsn:    { x: margin + 60,  width: 18 },
    qty:    { x: margin + 78,  width: 12 },
    rate:   { x: margin + 90,  width: 26 },
    disc:   { x: margin + 116, width: 18 },
    gst:    { x: margin + 134, width: 15 },
    amount: { x: margin + 149, width: 37 },
  }

  // Draw header row with brand color background
  applyBrandFillColor(pdf, brandColor)
  applyBrandColor(pdf, brandColor)
  pdf.rect(margin, yPosition - 3, contentWidth, 4, 'F')
  pdf.setTextColor(255, 255, 255) // White text on brand background
  pdf.text('Sl', cols.sl.x, yPosition)
  pdf.text('Description', cols.desc.x, yPosition)
  pdf.text('HSN', cols.hsn.x, yPosition)
  pdf.text('Qty', cols.qty.x, yPosition)
  pdf.text('Rate (Rs)', cols.rate.x, yPosition)
  pdf.text('Disc %', cols.disc.x, yPosition)
  pdf.text('GST %', cols.gst.x, yPosition)
  const classicAmtHeader = 'Amount (Rs)'
  pdf.text(classicAmtHeader, cols.amount.x + cols.amount.width - pdf.getTextWidth(classicAmtHeader), yPosition)

  resetTextColor(pdf)
  yPosition += 4
  pdf.setDrawColor(180, 180, 180)
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 2

  // Table rows
  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(8)

  const maxItemsPerPage = 10
  let currentPageItems = 0

  invoice.items.forEach((item, idx) => {
    // Check for page break
    if (currentPageItems >= maxItemsPerPage && yPosition > pageHeight - 60) {
      pdf.addPage()
      yPosition = margin

      // Redraw header on new page
      pdf.setFont('Helvetica', 'bold')
      pdf.setFontSize(8)
      applyBrandFillColor(pdf, brandColor)
      pdf.rect(margin, yPosition - 3, contentWidth, 4, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.text('Sl', cols.sl.x, yPosition)
      pdf.text('Description', cols.desc.x, yPosition)
      pdf.text('HSN', cols.hsn.x, yPosition)
      pdf.text('Qty', cols.qty.x, yPosition)
      pdf.text('Rate (Rs)', cols.rate.x, yPosition)
      pdf.text('Disc %', cols.disc.x, yPosition)
      pdf.text('GST %', cols.gst.x, yPosition)
      pdf.text(classicAmtHeader, cols.amount.x + cols.amount.width - pdf.getTextWidth(classicAmtHeader), yPosition)

      resetTextColor(pdf)
      yPosition += 4
      pdf.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 2

      pdf.setFont('Helvetica', 'normal')
      currentPageItems = 0
    }

    // Item row
    pdf.text((idx + 1).toString(), cols.sl.x, yPosition)

    // Description (wrapped)
    const descLines = pdf.splitTextToSize(item.description || item.productName, cols.desc.width)
    let descY = yPosition
    descLines.forEach((line: string, i: number) => {
      pdf.text(line, cols.desc.x, descY)
      descY += 3
    })

    // Other fields
    pdf.text(item.hsn || '-', cols.hsn.x, yPosition)
    pdf.text(item.quantity.toString(), cols.qty.x, yPosition)
    pdf.text(formatRupeePDF(item.price), cols.rate.x, yPosition)
    pdf.text((item.discount || 0).toString() + '%', cols.disc.x, yPosition)
    pdf.text((item.gstRate || 0).toString() + '%', cols.gst.x, yPosition)

    const amountText = formatRupeePDF(item.total)
    pdf.text(amountText, cols.amount.x + cols.amount.width - pdf.getTextWidth(amountText), yPosition)

    const rowHeight = Math.max(descLines.length * 3, 5)
    yPosition += rowHeight + 1

    // Row separator
    pdf.setDrawColor(230, 230, 230)
    pdf.line(margin, yPosition - 0.5, pageWidth - margin, yPosition - 0.5)

    currentPageItems++
  })

  yPosition += 2

  // ═══════════════════════ SUMMARY SECTION ═══════════════════════
  const summaryX = margin + contentWidth - 100
  const summaryRight = pageWidth - margin

  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(9)

  const summaryItems: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: 'Subtotal:', value: formatRupeePDF(invoice.subtotal) },
    ...buildGSTRows(invoice),
  ]

  if (invoice.status === 'paid' || invoice.status === 'partial') {
    if (invoice.amountPaid) {
      summaryItems.push({ label: 'Amount Paid:', value: formatRupeePDF(invoice.amountPaid) })
    }
    if (invoice.status === 'partial') {
      const due = invoice.total - (invoice.amountPaid || 0)
      summaryItems.push({ label: 'Balance Due:', value: formatRupeePDF(due), bold: true })
    }
  }

  summaryItems.forEach((item) => {
    if (item.bold) pdf.setFont('Helvetica', 'bold')
    pdf.text(item.label, summaryX, yPosition)
    const valueWidth = pdf.getTextWidth(item.value)
    pdf.text(item.value, summaryRight - valueWidth, yPosition)
    yPosition += 4
    if (item.bold) pdf.setFont('Helvetica', 'normal')
  })

  yPosition += 2
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(10)
  
  // Draw TOTAL row with wider background rect
  const totalLabelWidth = pdf.getTextWidth('TOTAL:')
  const totalValueWidth = pdf.getTextWidth(formatRupeePDF(invoice.total))
  const rectWidth = totalLabelWidth + totalValueWidth + 15 // Add padding
  
  applyBrandFillColor(pdf, brandColor)
  pdf.rect(summaryX - 2, yPosition - 3, rectWidth + 20, 5, 'F')
  applyBrandColor(pdf, brandColor)
  pdf.setTextColor(255, 255, 255) // White text
  pdf.text('TOTAL:', summaryX, yPosition)
  pdf.text(formatRupeePDF(invoice.total), summaryRight - totalValueWidth, yPosition)

  resetTextColor(pdf)
  yPosition += 6

  // ═══════════════════════ NOTES & TERMS ═══════════════════════
  if (invoice.notes || invoice.termsConditions) {
    pdf.setFont('Helvetica', 'bold')
    pdf.setFontSize(9)

    if (invoice.notes) {
      pdf.text('Notes:', margin, yPosition)
      yPosition += 3
      pdf.setFont('Helvetica', 'normal')
      pdf.setFontSize(8)
      const noteLines = pdf.splitTextToSize(invoice.notes, contentWidth)
      noteLines.forEach((line: string) => {
        pdf.text(line, margin, yPosition)
        yPosition += 2.5
      })
      yPosition += 2
    }

    if (invoice.termsConditions) {
      pdf.setFont('Helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text('Terms & Conditions:', margin, yPosition)
      yPosition += 3
      pdf.setFont('Helvetica', 'normal')
      pdf.setFontSize(7)
      const termLines = pdf.splitTextToSize(invoice.termsConditions, contentWidth)
      termLines.slice(0, 5).forEach((line: string) => {
        pdf.text(line, margin, yPosition)
        yPosition += 2
      })
    }
  }

  // ═══════════════════════ FOOTER ═══════════════════════
  const footerY = pageHeight - 10
  pdf.setFontSize(7)
  pdf.setFont('Helvetica', 'italic')
  applyBrandColor(pdf, brandColor)
  pdf.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' })

  if (invoice.upiId) {
    pdf.text(`UPI: ${invoice.upiId}`, pageWidth / 2, footerY + 3, { align: 'center' })
  }

  resetTextColor(pdf)

  // Return the PDF object (no auto-save for preview compatibility)
  return pdf
}

/**
 * Modern Template - Full-width colored header band, minimal columns, clean whitespace
 */
function generateModernTemplate(invoice: InvoiceData, brandColor: string): jsPDF {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - 2 * margin

  const [r, g, b] = hexToRgb(brandColor)

  // ── Full-width header band ──────────────────────────────────────
  const bandHeight = 32
  pdf.setFillColor(r, g, b)
  pdf.rect(0, 0, pageWidth, bandHeight, 'F')

  // Business name (large, white, left)
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.setTextColor(255, 255, 255)
  pdf.text(invoice.businessName || 'Business', margin, 14)

  // INVOICE label (small, white, right)
  pdf.setFontSize(9)
  pdf.setFont('Helvetica', 'normal')
  pdf.text('INVOICE', pageWidth - margin - pdf.getTextWidth('INVOICE'), 10)
  pdf.setFontSize(11)
  pdf.setFont('Helvetica', 'bold')
  const invNo = `#${invoice.invoiceNumber}`
  pdf.text(invNo, pageWidth - margin - pdf.getTextWidth(invNo), 18)

  // Date below invoice number
  pdf.setFontSize(8)
  pdf.setFont('Helvetica', 'normal')
  const dateStr = new Date(invoice.date).toLocaleDateString('en-IN')
  pdf.text(dateStr, pageWidth - margin - pdf.getTextWidth(dateStr), 25)

  resetTextColor(pdf)
  let yPos = bandHeight + 10

  // ── Sub-header: contact info left, bill-to right ────────────────
  pdf.setFontSize(8)
  pdf.setFont('Helvetica', 'normal')
  const bizLines = [
    invoice.businessPhone && `Phone: ${invoice.businessPhone}`,
    invoice.businessEmail && `Email: ${invoice.businessEmail}`,
    invoice.businessAddress || '',
    invoice.gstNumber && `GSTIN: ${invoice.gstNumber}`,
  ].filter(Boolean) as string[]

  bizLines.forEach((line) => {
    pdf.text(line, margin, yPos)
    yPos += 4
  })

  const rightX = pageWidth / 2 + 10
  let rightY = bandHeight + 10
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(9)
  applyBrandColor(pdf, brandColor)
  pdf.text('BILL TO', rightX, rightY)
  resetTextColor(pdf)
  rightY += 5
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(invoice.customerName, rightX, rightY)
  rightY += 5
  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(8)
  const custLines = [
    invoice.customerPhone && `Phone: ${invoice.customerPhone}`,
    invoice.customerEmail && `Email: ${invoice.customerEmail}`,
    invoice.customerAddress || '',
    invoice.customerGST && `GST: ${invoice.customerGST}`,
  ].filter(Boolean) as string[]
  custLines.forEach((line) => {
    pdf.text(line as string, rightX, rightY)
    rightY += 4
  })

  yPos = Math.max(yPos, rightY) + 6

  // ── Thin brand accent line ──────────────────────────────────────
  pdf.setDrawColor(r, g, b)
  pdf.setLineWidth(0.6)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  pdf.setLineWidth(0.2)
  yPos += 6

  // ── Items table: Description / Qty / Rate / Amount only ─────────
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setFillColor(r, g, b)
  pdf.rect(margin, yPos - 3, contentWidth, 5, 'F')
  pdf.setTextColor(255, 255, 255)

  const colDesc = margin
  const colQty = margin + 86
  const colRate = margin + 108
  // Amount column: right-align header+data to page margin
  const modernAmtHeader = 'AMOUNT (Rs)'

  pdf.text('DESCRIPTION', colDesc, yPos)
  pdf.text('QTY', colQty, yPos)
  pdf.text('RATE (Rs)', colRate, yPos)
  pdf.text(modernAmtHeader, pageWidth - margin - pdf.getTextWidth(modernAmtHeader), yPos)
  resetTextColor(pdf)
  yPos += 5

  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(8.5)

  invoice.items.forEach((item, idx) => {
    if (yPos > pageHeight - 55) {
      pdf.addPage()
      yPos = margin
      pdf.setFont('Helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setFillColor(r, g, b)
      pdf.rect(margin, yPos - 3, contentWidth, 5, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.text('DESCRIPTION', colDesc, yPos)
      pdf.text('QTY', colQty, yPos)
      pdf.text('RATE (Rs)', colRate, yPos)
      pdf.text(modernAmtHeader, pageWidth - margin - pdf.getTextWidth(modernAmtHeader), yPos)
      resetTextColor(pdf)
      yPos += 5
      pdf.setFont('Helvetica', 'normal')
      pdf.setFontSize(8.5)
    }

    const nameLines = pdf.splitTextToSize(item.description || item.productName, 78)
    nameLines.forEach((line: string, i: number) => pdf.text(line, colDesc, yPos + i * 4))
    pdf.text(item.quantity.toString(), colQty, yPos)
    pdf.text(formatRupeePDF(item.price), colRate, yPos)
    const amtTxt = formatRupeePDF(item.total)
    pdf.text(amtTxt, pageWidth - margin - pdf.getTextWidth(amtTxt), yPos)

    const rowH = Math.max(nameLines.length * 4, 6)
    yPos += rowH

    // Light separator
    pdf.setDrawColor(220, 220, 220)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 1
  })

  yPos += 4

  // ── Totals block ────────────────────────────────────────────────
  const totX = margin + contentWidth - 68
  const totRight = pageWidth - margin
  pdf.setFontSize(9)
  pdf.setFont('Helvetica', 'normal')

  const summaryItems: Array<{ label: string; value: string }> = [
    { label: 'Subtotal', value: formatRupeePDF(invoice.subtotal) },
    ...buildGSTRows(invoice).map(r => ({ label: r.label.replace(':', ''), value: r.value })),
  ]
  if (invoice.amountPaid && (invoice.status === 'paid' || invoice.status === 'partial')) {
    summaryItems.push({ label: 'Paid', value: formatRupeePDF(invoice.amountPaid) })
  }
  summaryItems.forEach(({ label, value }) => {
    pdf.text(label, totX, yPos)
    pdf.text(value, totRight - pdf.getTextWidth(value), yPos)
    yPos += 5
  })

  // Large total row with brand background
  pdf.setFontSize(12)
  pdf.setFont('Helvetica', 'bold')
  pdf.setFillColor(r, g, b)
  pdf.rect(totX - 4, yPos - 4, 70, 7, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.text('TOTAL', totX, yPos)
  const totalTxt = formatRupeePDF(invoice.total)
  pdf.text(totalTxt, totRight - pdf.getTextWidth(totalTxt), yPos)
  resetTextColor(pdf)
  yPos += 10

  // ── Notes / Terms ────────────────────────────────────────────────
  if (invoice.notes) {
    pdf.setFont('Helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.text('Notes:', margin, yPos)
    yPos += 4
    pdf.setFont('Helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.splitTextToSize(invoice.notes, contentWidth).forEach((line: string) => {
      pdf.text(line, margin, yPos)
      yPos += 4
    })
  }

  // ── Footer ───────────────────────────────────────────────────────
  pdf.setFillColor(r, g, b)
  pdf.rect(0, pageHeight - 10, pageWidth, 10, 'F')
  pdf.setFontSize(7)
  pdf.setFont('Helvetica', 'italic')
  pdf.setTextColor(255, 255, 255)
  pdf.text('Thank you for your business!', pageWidth / 2, pageHeight - 4, { align: 'center' })
  if (invoice.upiId) {
    pdf.text(`UPI: ${invoice.upiId}`, pageWidth - margin, pageHeight - 4, { align: 'right' })
  }
  resetTextColor(pdf)

  return pdf
}

/**
 * GST Format Template - India GST-compliant TAX INVOICE
 * Prominent TAX INVOICE title, CGST/SGST split, HSN code column
 */
function generateGSTTemplate(invoice: InvoiceData, brandColor: string): jsPDF {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - 2 * margin

  const [r, g, b] = hexToRgb(brandColor)

  // ── Outer border ─────────────────────────────────────────────────
  pdf.setDrawColor(r, g, b)
  pdf.setLineWidth(0.8)
  pdf.rect(margin - 2, 6, contentWidth + 4, pageHeight - 12)
  pdf.setLineWidth(0.2)

  let yPos = 14

  // ── TAX INVOICE centered title ───────────────────────────────────
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(16)
  applyBrandColor(pdf, brandColor)
  pdf.text('TAX INVOICE', pageWidth / 2, yPos, { align: 'center' })
  resetTextColor(pdf)
  yPos += 3

  pdf.setDrawColor(r, g, b)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 5

  // ── Two-column header: Supplier left | Invoice details right ─────
  const midX = pageWidth / 2 - 5
  const rightCol = pageWidth / 2 + 5

  // LEFT: Supplier/Business info
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(invoice.businessName || 'Business', margin, yPos)
  yPos += 5
  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(8)

  const supplierLines = [
    invoice.businessAddress || '',
    invoice.businessPhone && `Ph: ${invoice.businessPhone}`,
    invoice.businessEmail && `Email: ${invoice.businessEmail}`,
  ].filter(Boolean) as string[]
  supplierLines.forEach((line) => {
    const wrapped = pdf.splitTextToSize(line, midX - margin - 2)
    wrapped.forEach((l: string) => { pdf.text(l, margin, yPos); yPos += 3.5 })
  })

  // GSTIN: rendered prominent
  if (invoice.gstNumber) {
    yPos += 1
    pdf.setFont('Helvetica', 'bold')
    pdf.setFontSize(8.5)
    applyBrandColor(pdf, brandColor)
    pdf.text(`GSTIN: ${invoice.gstNumber}`, margin, yPos)
    resetTextColor(pdf)
    yPos += 4
  }

  // RIGHT: Invoice metadata
  let rightY = 19
  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(8.5)
  const meta = [
    [`Invoice No:`, invoice.invoiceNumber],
    [`Invoice Date:`, new Date(invoice.date).toLocaleDateString('en-IN')],
    [`Due Date:`, invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'N/A'],
    [`Status:`, invoice.status.toUpperCase()],
  ]
  meta.forEach(([label, val]) => {
    pdf.setFont('Helvetica', 'bold')
    pdf.text(label, rightCol, rightY)
    pdf.setFont('Helvetica', 'normal')
    pdf.text(val, rightCol + 26, rightY)
    rightY += 5
  })

  yPos = Math.max(yPos, rightY) + 2

  // Mid separator
  pdf.setDrawColor(r, g, b)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 4

  // ── Bill To section ──────────────────────────────────────────────
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(8.5)
  applyBrandColor(pdf, brandColor)
  pdf.text('BILL TO:', margin, yPos)
  resetTextColor(pdf)
  yPos += 4
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text(invoice.customerName, margin, yPos)
  yPos += 4
  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(8)
  const custLines = [
    invoice.customerPhone && `Ph: ${invoice.customerPhone}`,
    invoice.customerEmail && `Email: ${invoice.customerEmail}`,
    invoice.customerAddress || '',
    invoice.customerGST && `GSTIN: ${invoice.customerGST}`,
  ].filter(Boolean) as string[]
  custLines.forEach((line) => {
    pdf.text(line as string, margin, yPos)
    yPos += 4
  })

  yPos += 2
  pdf.setDrawColor(180, 180, 180)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 4

  // ── Items table (with HSN column) ────────────────────────────────
  // Columns fill full content width (186mm at margin=12, right=198)
  // sl(8) + desc(52) + hsn(20) + qty(12) + rate(28) + gst(14) + amt(52) = 186
  const hCols = {
    sl:   { x: margin,       w: 8  },
    desc: { x: margin + 8,   w: 52 },
    hsn:  { x: margin + 60,  w: 20 },
    qty:  { x: margin + 80,  w: 12 },
    rate: { x: margin + 92,  w: 28 },
    gst:  { x: margin + 120, w: 14 },
    amt:  { x: margin + 134, w: 52 },  // x+w = 12+134+52 = 198 = right margin
  }

  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.setFillColor(r, g, b)
  pdf.rect(margin, yPos - 3, contentWidth, 5, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.text('Sl', hCols.sl.x, yPos)
  pdf.text('Description', hCols.desc.x, yPos)
  pdf.text('HSN/SAC', hCols.hsn.x, yPos)
  pdf.text('Qty', hCols.qty.x, yPos)
  pdf.text('Rate (Rs)', hCols.rate.x, yPos)
  pdf.text('GST %', hCols.gst.x, yPos)
  // Right-align Amount header to match right-aligned values
  const gstAmtHeader = 'Amount (Rs)'
  pdf.text(gstAmtHeader, pageWidth - margin - pdf.getTextWidth(gstAmtHeader), yPos)
  resetTextColor(pdf)
  yPos += 5

  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(8)

  invoice.items.forEach((item, idx) => {
    if (yPos > pageHeight - 65) {
      pdf.addPage()
      yPos = 14
      pdf.setFont('Helvetica', 'bold')
      pdf.setFontSize(7.5)
      pdf.setFillColor(r, g, b)
      pdf.rect(margin, yPos - 3, contentWidth, 5, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.text('Sl', hCols.sl.x, yPos)
      pdf.text('Description', hCols.desc.x, yPos)
      pdf.text('HSN/SAC', hCols.hsn.x, yPos)
      pdf.text('Qty', hCols.qty.x, yPos)
      pdf.text('Rate (Rs)', hCols.rate.x, yPos)
      pdf.text('GST %', hCols.gst.x, yPos)
      pdf.text(gstAmtHeader, pageWidth - margin - pdf.getTextWidth(gstAmtHeader), yPos)
      resetTextColor(pdf)
      yPos += 5
      pdf.setFont('Helvetica', 'normal')
      pdf.setFontSize(8)
    }

    pdf.text((idx + 1).toString(), hCols.sl.x, yPos)
    const descLines = pdf.splitTextToSize(item.description || item.productName, hCols.desc.w)
    descLines.forEach((l: string, i: number) => pdf.text(l, hCols.desc.x, yPos + i * 3.5))
    pdf.text(item.hsn || '-', hCols.hsn.x, yPos)
    pdf.text(item.quantity.toString(), hCols.qty.x, yPos)
    pdf.text(formatRupeePDF(item.price), hCols.rate.x, yPos)
    pdf.text(`${item.gstRate || 0}%`, hCols.gst.x, yPos)
    const amtTxt = formatRupeePDF(item.total)
    pdf.text(amtTxt, hCols.amt.x + hCols.amt.w - pdf.getTextWidth(amtTxt), yPos)

    const rh = Math.max(descLines.length * 3.5, 5)
    yPos += rh
    pdf.setDrawColor(220, 220, 220)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 1
  })

  yPos += 3

  // ── GST Summary: CGST + SGST split ──────────────────────────────
  const sumX = margin + contentWidth - 90
  const sumRight = pageWidth - margin

  pdf.setFontSize(8.5)
  pdf.setFont('Helvetica', 'normal')

  const gstRows: Array<{ label: string; value: string }> = [
    { label: 'Taxable Amount:', value: formatRupeePDF(invoice.subtotal) },
    ...buildGSTRows(invoice),
  ]
  if (invoice.amountPaid && (invoice.status === 'paid' || invoice.status === 'partial')) {
    gstRows.push({ label: 'Amount Paid:', value: formatRupeePDF(invoice.amountPaid) })
  }

  gstRows.forEach(({ label, value }) => {
    pdf.setFont('Helvetica', 'normal')
    pdf.text(label, sumX, yPos)
    pdf.text(value, sumRight - pdf.getTextWidth(value), yPos)
    yPos += 5
  })

  // ── Total due ────────────────────────────────────────────────────
  pdf.setFillColor(r, g, b)
  pdf.rect(sumX - 2, yPos - 4, sumRight - sumX + 2, 6, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('TOTAL DUE:', sumX, yPos)
  const totalTxt = formatRupeePDF(invoice.status === 'partial' ? invoice.total - (invoice.amountPaid || 0) : invoice.total)
  pdf.text(totalTxt, sumRight - pdf.getTextWidth(totalTxt), yPos)
  resetTextColor(pdf)
  yPos += 8

  // ── Notes / Terms ────────────────────────────────────────────────
  if (invoice.notes || invoice.termsConditions) {
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 4

    if (invoice.notes) {
      pdf.setFont('Helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.text('Notes:', margin, yPos)
      yPos += 4
      pdf.setFont('Helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.splitTextToSize(invoice.notes, contentWidth).forEach((line: string) => {
        pdf.text(line, margin, yPos)
        yPos += 3.5
      })
    }

    if (invoice.termsConditions) {
      pdf.setFont('Helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.text('Terms & Conditions:', margin, yPos)
      yPos += 4
      pdf.setFont('Helvetica', 'normal')
      pdf.setFontSize(7.5)
      pdf.splitTextToSize(invoice.termsConditions, contentWidth).slice(0, 5).forEach((line: string) => {
        pdf.text(line, margin, yPos)
        yPos += 3
      })
    }
  }

  // ── Signature line ───────────────────────────────────────────────
  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(8)
  const sigY = pageHeight - 20
  pdf.setDrawColor(100, 100, 100)
  pdf.line(pageWidth - margin - 50, sigY, pageWidth - margin, sigY)
  pdf.text('Authorised Signatory', pageWidth - margin - 46, sigY + 4)

  // ── Footer ───────────────────────────────────────────────────────
  pdf.setFontSize(7)
  pdf.setFont('Helvetica', 'italic')
  pdf.setDrawColor(r, g, b)
  pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
  applyBrandColor(pdf, brandColor)
  pdf.text('This is a computer generated invoice. Thank you for your business.', pageWidth / 2, pageHeight - 7, { align: 'center' })
  if (invoice.upiId) pdf.text(`UPI: ${invoice.upiId}`, margin, pageHeight - 7)
  resetTextColor(pdf)

  return pdf
}

/**
 * Retail Template - Receipt-style compact format, centered, no HSN/GST columns
 */
function generateRetailTemplate(invoice: InvoiceData, brandColor: string): jsPDF {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - 2 * margin

  const [r, g, b] = hexToRgb(brandColor)

  let yPos = 12

  // ── Business name centered ───────────────────────────────────────
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(18)
  applyBrandColor(pdf, brandColor)
  pdf.text(invoice.businessName || 'Business', pageWidth / 2, yPos, { align: 'center' })
  resetTextColor(pdf)
  yPos += 5

  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(8)
  const bizCenter = [
    invoice.businessAddress || '',
    invoice.businessPhone && `Ph: ${invoice.businessPhone}`,
    invoice.gstNumber && `GST: ${invoice.gstNumber}`,
  ].filter(Boolean) as string[]
  bizCenter.forEach((line) => {
    pdf.text(line, pageWidth / 2, yPos, { align: 'center' })
    yPos += 3.5
  })

  // ── Dashed separator ─────────────────────────────────────────────
  yPos += 1
  pdf.setDrawColor(r, g, b)
  pdf.setLineDashPattern([1, 1], 0)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  pdf.setLineDashPattern([], 0)
  yPos += 4

  // ── Invoice info (centered pair) ─────────────────────────────────
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(9)
  applyBrandColor(pdf, brandColor)
  pdf.text('SALES RECEIPT', pageWidth / 2, yPos, { align: 'center' })
  resetTextColor(pdf)
  yPos += 4
  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(`Receipt No: ${invoice.invoiceNumber}`, margin, yPos)
  const dateStr = new Date(invoice.date).toLocaleDateString('en-IN')
  pdf.text(`Date: ${dateStr}`, pageWidth - margin - pdf.getTextWidth(`Date: ${dateStr}`), yPos)
  yPos += 5

  // Customer
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(8.5)
  pdf.text(`Customer: ${invoice.customerName}`, margin, yPos)
  yPos += 4
  if (invoice.customerPhone) {
    pdf.setFont('Helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.text(`Ph: ${invoice.customerPhone}`, margin, yPos)
    yPos += 4
  }

  // ── Dashed separator ─────────────────────────────────────────────
  pdf.setDrawColor(150, 150, 150)
  pdf.setLineDashPattern([1, 1], 0)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  pdf.setLineDashPattern([], 0)
  yPos += 4

  // ── Items table: Item | Qty | Price | Amount ─────────────────────
  // Columns fill full content width (182mm at margin=14, right=196)
  // desc(80) + qty(14) + rate(30) + amt(58) = 182
  const rCols = {
    desc: { x: margin,       w: 80 },
    qty:  { x: margin + 80,  w: 14 },
    rate: { x: margin + 94,  w: 30 },
    amt:  { x: margin + 124, w: 58 },  // x+w = 14+124+58 = 196 = right margin
  }

  // Header
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setFillColor(r, g, b)
  pdf.rect(margin, yPos - 3, contentWidth, 5, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.text('ITEM', rCols.desc.x, yPos)
  pdf.text('QTY', rCols.qty.x, yPos)
  pdf.text('PRICE', rCols.rate.x, yPos)
  // Right-align AMOUNT header to match right-aligned values
  const amtHeader = 'AMOUNT'
  pdf.text(amtHeader, pageWidth - margin - pdf.getTextWidth(amtHeader), yPos)
  resetTextColor(pdf)
  yPos += 5

  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(8.5)

  invoice.items.forEach((item, idx) => {
    if (yPos > pageHeight - 55) {
      pdf.addPage()
      yPos = 12
      pdf.setFont('Helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setFillColor(r, g, b)
      pdf.rect(margin, yPos - 3, contentWidth, 5, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.text('ITEM', rCols.desc.x, yPos)
      pdf.text('QTY', rCols.qty.x, yPos)
      pdf.text('PRICE', rCols.rate.x, yPos)
      pdf.text(amtHeader, pageWidth - margin - pdf.getTextWidth(amtHeader), yPos)
      resetTextColor(pdf)
      yPos += 5
      pdf.setFont('Helvetica', 'normal')
      pdf.setFontSize(8.5)
    }

    const nameLines = pdf.splitTextToSize(item.description || item.productName, rCols.desc.w)
    nameLines.forEach((l: string, i: number) => pdf.text(l, rCols.desc.x, yPos + i * 4))
    pdf.text(item.quantity.toString(), rCols.qty.x, yPos)
    pdf.text(formatRupeePDF(item.price), rCols.rate.x, yPos)
    const amtTxt = formatRupeePDF(item.total)
    pdf.text(amtTxt, rCols.amt.x + rCols.amt.w - pdf.getTextWidth(amtTxt), yPos)

    const rh = Math.max(nameLines.length * 4, 6)
    yPos += rh
    pdf.setDrawColor(220, 220, 220)
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 1
  })

  // ── Dashed separator ─────────────────────────────────────────────
  yPos += 2
  pdf.setDrawColor(100, 100, 100)
  pdf.setLineDashPattern([1, 1], 0)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  pdf.setLineDashPattern([], 0)
  yPos += 5

  // ── Totals (right-aligned) ───────────────────────────────────────
  const totRight = pageWidth - margin
  const totLabelX = margin + contentWidth - 50
  pdf.setFont('Helvetica', 'normal')
  pdf.setFontSize(9)

  if (invoice.taxAmount > 0) {
    pdf.text('Subtotal:', totLabelX, yPos)
    const stTxt = formatRupeePDF(invoice.subtotal)
    pdf.text(stTxt, totRight - pdf.getTextWidth(stTxt), yPos)
    yPos += 5
    buildGSTRows(invoice).forEach(({ label, value }) => {
      pdf.text(label, totLabelX, yPos)
      pdf.text(value, totRight - pdf.getTextWidth(value), yPos)
      yPos += 5
    })
  }

  if (invoice.amountPaid && (invoice.status === 'paid' || invoice.status === 'partial')) {
    pdf.text('Paid:', totLabelX, yPos)
    const paidTxt = formatRupeePDF(invoice.amountPaid)
    pdf.text(paidTxt, totRight - pdf.getTextWidth(paidTxt), yPos)
    yPos += 5
  }

  // Bold total
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(12)
  applyBrandColor(pdf, brandColor)
  pdf.text('TOTAL:', totLabelX, yPos)
  const totalTxt = formatRupeePDF(invoice.total)
  pdf.text(totalTxt, totRight - pdf.getTextWidth(totalTxt), yPos)
  resetTextColor(pdf)
  yPos += 8

  // ── Dashed separator ─────────────────────────────────────────────
  pdf.setDrawColor(r, g, b)
  pdf.setLineDashPattern([1, 1], 0)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  pdf.setLineDashPattern([], 0)
  yPos += 5

  // ── Notes ────────────────────────────────────────────────────────
  if (invoice.notes) {
    pdf.setFont('Helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.splitTextToSize(invoice.notes, contentWidth).forEach((line: string) => {
      pdf.text(line, pageWidth / 2, yPos, { align: 'center' })
      yPos += 4
    })
    yPos += 2
  }

  // ── Thank you footer (centered) ──────────────────────────────────
  pdf.setFont('Helvetica', 'bold')
  pdf.setFontSize(9)
  applyBrandColor(pdf, brandColor)
  pdf.text('** Thank you for shopping with us! **', pageWidth / 2, yPos, { align: 'center' })
  resetTextColor(pdf)
  yPos += 5
  if (invoice.upiId) {
    pdf.setFont('Helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.text(`UPI: ${invoice.upiId}`, pageWidth / 2, yPos, { align: 'center' })
  }

  return pdf
}

export function generateMultipleInvoicesPDF(invoices: InvoiceData[]) {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15

  invoices.forEach((invoice, invoiceIndex) => {
    if (invoiceIndex > 0) {
      pdf.addPage()
    }

    let yPosition = margin

    // Header
    pdf.setFontSize(14)
    pdf.setFont('Helvetica', 'bold')
    pdf.text('INVOICE', margin, yPosition)
    yPosition += 8

    // Invoice details
    pdf.setFontSize(9)
    pdf.setFont('Helvetica', 'normal')
    pdf.text(`Invoice #: ${invoice.invoiceNumber}`, margin, yPosition)
    yPosition += 4
    pdf.text(`Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}`, margin, yPosition)
    yPosition += 4
    pdf.text(`Customer: ${invoice.customerName}`, margin, yPosition)
    yPosition += 8

    // Items table (simplified for multiple invoices)
    const items = invoice.items.slice(0, 3) // Show first 3 items
    pdf.text('Items:', margin, yPosition)
    yPosition += 4

    items.forEach((item) => {
      pdf.text(
        `${item.productName} x${item.quantity} = ${formatRupeePDF(item.total)}`,
        margin + 5,
        yPosition
      )
      yPosition += 4
    })

    // Total
    pdf.setFont('Helvetica', 'bold')
    pdf.text(`Total: ${formatRupeePDF(invoice.total)}`, margin, yPosition + 2)
  })

  pdf.save(`Invoices-Report-${new Date().toISOString().split('T')[0]}.pdf`)
}
