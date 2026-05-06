/**
 * lib/currency.ts
 *
 * Indian number formatting utilities.
 * Single source of truth — import formatINR wherever you display money.
 */

/**
 * Format a number in Indian currency format with 2 decimal places.
 * e.g. 821000 → "8,21,000.00"
 */
export function formatINR(amount: number | string): string {
  const num = parseFloat(String(amount))
  if (isNaN(num)) return '0.00'

  const fixed = Math.abs(num).toFixed(2)
  const [intPart, decPart] = fixed.split('.')

  let formatted = ''
  if (intPart.length <= 3) {
    formatted = intPart
  } else {
    const lastThree = intPart.slice(-3)
    const remaining = intPart.slice(0, -3)
    formatted = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
  }

  return (num < 0 ? '-' : '') + formatted + '.' + decPart
}

/**
 * Same as formatINR but prefixed with ₹
 */
export function formatRupee(amount: number | string): string {
  return '₹' + formatINR(amount)
}

/**
 * Format for PDFs (no rupee symbol for better alignment)
 */
export function formatRupeePDF(amount: number | string): string {
  return formatINR(amount)
}

/**
 * Parse a potentially-formatted Indian currency string back to a number.
 * Handles "₹", commas, whitespace.
 */
export function parseINR(value: string): number {
  const cleaned = value.replace(/[₹,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}
