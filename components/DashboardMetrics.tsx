'use client'

/**
 * components/DashboardMetrics.tsx
 * 
 * Split metrics calculation into two phases:
 * 1. Quick metrics: pending payments, invoice count (already in memory)
 * 2. Expensive metrics: COGS, trends, top products (deferred with Suspense)
 * 
 * Allows dashboard to paint faster with quick metrics visible immediately
 */

import React, { useMemo } from 'react'
import { formatINR } from '@/lib/currency'

interface MetricsProps {
  invoices: Array<{ total_amount?: number | string; payment_status?: string }>
  expenses: Array<{ amount?: number | string }>
  inventory: Array<{ name: string; purchase_price?: number | string }>
  curRange: { start: string; end: string }
  prevRange: { start: string; end: string } | null
  fmt: (amount: number) => string
}

export interface QuickMetrics {
  pendingCount: number
  pendingAmount: number
  invoiceCount: number
  lowStockCount: number
}

export interface ExpensiveMetrics {
  sales: number
  totalExpenses: number
  cogs: number
  netProfit: number
  salesTrend: number
  topProduct: { name: string; qty: number }
  topCategory: { name: string; amount: number }
}

/**
 * Calculate metrics that are quick (don't require iteration)
 * These are computed synchronously and don't block rendering
 */
export function useQuickMetrics(
  invoices: MetricsProps['invoices'],
  inventory: MetricsProps['inventory']
): QuickMetrics {
  return useMemo(() => {
    // Quick: filter by status (simple O(n) scan)
    const pending = invoices.filter(inv => inv.payment_status && inv.payment_status.toLowerCase() !== 'paid')
    const pendingAmount = pending.reduce((s, inv) => s + parseFloat(inv.total_amount?.toString() || '0'), 0)

    // Quick: inventory low stock (simple O(n) scan)
    const lowStockCount = inventory.filter(
      item => parseFloat((item as any).stock?.toString() || '0') <= parseFloat((item as any).low_stock_threshold?.toString() || '10')
    ).length

    return {
      pendingCount: pending.length,
      pendingAmount,
      invoiceCount: invoices.length,
      lowStockCount,
    }
  }, [invoices, inventory])
}

/**
 * Calculate metrics that require expensive operations
 * These are deferred and can be wrapped in Suspense
 */
export function useExpensiveMetrics(
  invoices: MetricsProps['invoices'],
  expenses: MetricsProps['expenses'],
  inventory: MetricsProps['inventory'],
  curRange: MetricsProps['curRange'],
  prevRange: MetricsProps['prevRange'],
  filterItems: (items: any[], start: string, end: string) => any[]
): ExpensiveMetrics {
  return useMemo(() => {
    const curInvoices = filterItems(invoices, curRange.start, curRange.end)
    const curExpenses = filterItems(expenses, curRange.start, curRange.end)
    const sales = curInvoices.reduce((s, inv) => s + parseFloat(inv.total_amount?.toString() || '0'), 0)
    const totalExpenses = curExpenses.reduce((s, exp) => s + parseFloat(exp.amount?.toString() || '0'), 0)

    // COGS calculation (expensive - iterates invoices × items)
    const priceMap = new Map<string, number>()
    inventory.forEach(item => {
      priceMap.set(item.name, parseFloat((item as any).purchase_price?.toString() || '0'))
    })
    let cogs = 0
    curInvoices.forEach(inv => {
      try {
        const items = (inv as any).items
          ? (typeof (inv as any).items === 'string' ? JSON.parse((inv as any).items) : (inv as any).items)
          : []
        if (Array.isArray(items)) {
          items.forEach((it: any) => {
            const itemName = it.description || it.item_name || it.name || ''
            cogs += (priceMap.get(itemName) || 0) * parseFloat(it.quantity?.toString() || '0')
          })
        }
      } catch { /* skip */ }
    })

    const netProfit = sales - totalExpenses - cogs

    // Sales trend (requires previous period calculation)
    let salesTrend = 0
    if (prevRange) {
      const prevSales = filterItems(invoices, prevRange.start, prevRange.end)
        .reduce((s, inv) => s + parseFloat(inv.total_amount?.toString() || '0'), 0)
      salesTrend = prevSales > 0 ? ((sales - prevSales) / prevSales) * 100 : 0
    }

    // Top product (expensive - iterates invoices × items)
    const productMap = new Map<string, number>()
    curInvoices.forEach(inv => {
      try {
        const items = (inv as any).items
          ? (typeof (inv as any).items === 'string' ? JSON.parse((inv as any).items) : (inv as any).items)
          : []
        if (Array.isArray(items)) {
          items.forEach((it: any) => {
            const name = it.description || it.item_name || it.name || 'Unknown'
            productMap.set(name, (productMap.get(name) || 0) + parseFloat(it.quantity?.toString() || '0'))
          })
        }
      } catch { /* skip */ }
    })
    let topProduct = { name: 'No sales in period', qty: 0 }
    productMap.forEach((qty, name) => { if (qty > topProduct.qty) topProduct = { name, qty } })

    // Top category (iterates expenses)
    const catMap = new Map<string, number>()
    curExpenses.forEach(exp => {
      const cat = (exp as any).category || 'Other'
      catMap.set(cat, (catMap.get(cat) || 0) + parseFloat(exp.amount?.toString() || '0'))
    })
    let topCategory = { name: 'No expenses in period', amount: 0 }
    catMap.forEach((amount, name) => { if (amount > topCategory.amount) topCategory = { name, amount } })

    return {
      sales,
      totalExpenses,
      cogs,
      netProfit,
      salesTrend,
      topProduct,
      topCategory,
    }
  }, [invoices, expenses, inventory, curRange, prevRange, filterItems])
}
