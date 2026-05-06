/**
 * lib/gst.ts
 *
 * THE single GST calculator for all pages.
 * Use calcGSTInclusive  → when item price already includes GST
 * Use calcGSTExclusive  → when item price excludes GST (add-on)
 * Use calcInvoiceTotals → to aggregate a full invoice's line items
 *
 * Rounding strategy: each monetary value is rounded to 2 decimal places
 * independently (standard Indian GST practice) to avoid floating-point drift.
 */

/** Supported Indian GST slab rates */
export type GSTRate = 0 | 3 | 5 | 12 | 18 | 28

/** Breakdown returned for a single amount */
export interface GSTBreakdown {
  /** Amount before tax (taxable value) */
  taxableAmount: number
  /** CGST component — 0 for inter-state transactions */
  cgst: number
  /** SGST component — 0 for inter-state transactions */
  sgst: number
  /** IGST component — 0 for intra-state transactions */
  igst: number
  /** Total tax = cgst + sgst OR igst */
  totalTax: number
  /** Grand total = taxableAmount + totalTax */
  totalAmount: number
  /** The GST rate that was applied */
  gstRate: number
}

/** Aggregated totals for an entire invoice */
export interface InvoiceTotals {
  subtotal: number        // sum of all taxable amounts
  totalCGST: number
  totalSGST: number
  totalIGST: number
  totalTax: number
  grandTotal: number      // subtotal + totalTax
  discountSaved: number   // total discount amount saved
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

/** Round to 2 decimal places using standard rounding (0.5 rounds up) */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function splitTax(
  totalTax: number,
  isInterState: boolean
): Pick<GSTBreakdown, 'cgst' | 'sgst' | 'igst'> {
  if (isInterState) {
    return { cgst: 0, sgst: 0, igst: round2(totalTax) }
  }
  // Each half is rounded independently so CGST + SGST always equals totalTax
  const half = round2(totalTax / 2)
  const other = round2(totalTax - half)   // absorbs the 1-paisa rounding difference
  return { cgst: half, sgst: other, igst: 0 }
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Price INCLUDES tax — back-calculates the taxable amount.
 *
 * Example: ₹118 @ 18% GST
 *   taxable = 118 × 100 / 118 = 100.00
 *   tax     = 118 − 100 = 18.00
 *   cgst    = sgst = 9.00
 */
export function calcGSTInclusive(
  inclAmount: number,
  gstRate: number,
  isInterState = false
): GSTBreakdown {
  const taxable = round2((inclAmount * 100) / (100 + gstRate))
  const tax = round2(inclAmount - taxable)
  return {
    taxableAmount: taxable,
    ...splitTax(tax, isInterState),
    totalTax: tax,
    totalAmount: round2(inclAmount),
    gstRate,
  }
}

/**
 * Price EXCLUDES tax — adds GST on top.
 *
 * Example: ₹100 @ 18% GST
 *   tax   = 18.00
 *   total = 118.00
 *   cgst  = sgst = 9.00
 */
export function calcGSTExclusive(
  exclAmount: number,
  gstRate: number,
  isInterState = false
): GSTBreakdown {
  const tax = round2(exclAmount * gstRate / 100)
  const total = round2(exclAmount + tax)
  return {
    taxableAmount: round2(exclAmount),
    ...splitTax(tax, isInterState),
    totalTax: tax,
    totalAmount: total,
    gstRate,
  }
}

/** Input shape for each line item */
export interface LineItem {
  /** GST-inclusive rate per unit */
  rateInclGST: number
  quantity: number
  /** Discount percentage 0–100 */
  discountPercent?: number
  /** Per-item GST slab (%) */
  gstRate: number
  /** True if customer is in a different state */
  isInterState?: boolean
}

/**
 * Calculate per-line and invoice totals for an array of line items.
 * All prices are treated as GST-inclusive.
 * Returns both per-line breakdowns and aggregated InvoiceTotals.
 */
export function calcInvoiceTotals(
  items: LineItem[],
  isInterState = false
): { lines: GSTBreakdown[]; totals: InvoiceTotals } {
  let subtotal = 0
  let totalCGST = 0
  let totalSGST = 0
  let totalIGST = 0
  let totalTax = 0
  let grandTotal = 0
  let discountSaved = 0

  const lines = items.map((item) => {
    const discPct = item.discountPercent ?? 0
    const grossLineInclGST = round2(item.rateInclGST * item.quantity)
    const discountAmt = round2(grossLineInclGST * discPct / 100)
    const netLineInclGST = round2(grossLineInclGST - discountAmt)

    discountSaved += discountAmt

    const breakdown = calcGSTInclusive(netLineInclGST, item.gstRate, isInterState)

    subtotal  += breakdown.taxableAmount
    totalCGST += breakdown.cgst
    totalSGST += breakdown.sgst
    totalIGST += breakdown.igst
    totalTax  += breakdown.totalTax
    grandTotal += breakdown.totalAmount

    return breakdown
  })

  return {
    lines,
    totals: {
      subtotal:     round2(subtotal),
      totalCGST:    round2(totalCGST),
      totalSGST:    round2(totalSGST),
      totalIGST:    round2(totalIGST),
      totalTax:     round2(totalTax),
      grandTotal:   round2(grandTotal),
      discountSaved: round2(discountSaved),
    },
  }
}

/**
 * Convenience: "without-tax" mode — totals with no GST at all.
 */
export function calcInvoiceTotalsNoGST(
  items: Array<{ rate: number; quantity: number; discountPercent?: number }>
): Pick<InvoiceTotals, 'grandTotal' | 'discountSaved'> {
  let grandTotal = 0
  let discountSaved = 0

  items.forEach((item) => {
    const discPct = item.discountPercent ?? 0
    const gross = round2(item.rate * item.quantity)
    const disc = round2(gross * discPct / 100)
    discountSaved += disc
    grandTotal += round2(gross - disc)
  })

  return { grandTotal: round2(grandTotal), discountSaved: round2(discountSaved) }
}
