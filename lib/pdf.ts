/**
 * lib/pdf.ts
 *
 * PDF generation utilities for invoices and reports
 * Uses html2pdf library for client-side PDF generation
 */

export interface PDFOptions {
  filename?: string
  margin?: number | [number, number] | [number, number, number, number]
  image?: { type: string; quality: number }
  html2canvas?: { scale: number }
  jsPDF?: { orientation: 'portrait' | 'landscape'; unit: string; format: string }
}

/**
 * Generate and download PDF from HTML element
 * Note: html2pdf is loaded dynamically to avoid build issues
 */
export async function downloadPDF(elementId: string, filename: string = 'document.pdf', options: PDFOptions = {}) {
  try {
    // @ts-ignore - html2pdf doesn't have proper TS types
    const html2pdfModule = await import('html2pdf.js')
    const html2pdf = html2pdfModule.default || html2pdfModule

    const element = document.getElementById(elementId)
    if (!element) {
      console.error(`Element with id "${elementId}" not found`)
      return
    }

    const opt: any = {
      margin: options.margin ?? [10, 10, 10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait' as const, unit: 'mm', format: 'a4' },
      ...options,
    }

    // @ts-ignore - html2pdf library types are incomplete
    html2pdf().set(opt).from(element).save()
  } catch (error) {
    console.error('Error generating PDF:', error)
  }
}

/**
 * Generate PDF as blob (for email or API upload)
 */
export async function generatePDFBlob(elementId: string, options: PDFOptions = {}): Promise<Blob | null> {
  try {
    // @ts-ignore - html2pdf doesn't have proper TS types
    const html2pdfModule = await import('html2pdf.js')
    const html2pdf = html2pdfModule.default || html2pdfModule

    const element = document.getElementById(elementId)
    if (!element) {
      throw new Error(`Element with id "${elementId}" not found`)
    }

    const opt: any = {
      margin: options.margin ?? [10, 10, 10, 10],
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait' as const, unit: 'mm', format: 'a4' },
      ...options,
    }

    return new Promise<Blob | null>((resolve, reject) => {
      // @ts-ignore - html2pdf library types are incomplete
      html2pdf()
        .set(opt)
        .from(element)
        .outputPdf('blob')
        .then((blob: Blob) => resolve(blob))
        .catch((err: Error) => {
          console.error('PDF generation failed:', err)
          resolve(null)
        })
    })
  } catch (error) {
    console.error('Error generating PDF blob:', error)
    return null
  }
}

/**
 * Generate invoice PDF with proper formatting
 */
export async function downloadInvoicePDF(invoiceNumber: string, elementId: string = 'invoice-preview') {
  const filename = `Invoice-${invoiceNumber}-${new Date().toISOString().split('T')[0]}.pdf`
  await downloadPDF(elementId, filename, {
    margin: [15, 10, 15, 10],
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
  })
}
