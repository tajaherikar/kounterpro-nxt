'use client'

/**
 * components/DashboardCharts.tsx
 * 
 * Lazy-loaded chart components for dashboard
 * Prevents Recharts library from being bundled on non-dashboard pages
 * Saves ~1.7MB on initial page load for other routes
 */

import React from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { formatINR } from '@/lib/currency'

interface ChartData {
  label: string
  sales: number
  expenses: number
  profit: number
}

interface DashboardChartsProps {
  chartData6Mo: ChartData[]
}

export function SalesVsExpensesChart({ data }: { data: ChartData[] }) {
  const fmt = (val: number) => formatINR(val)

  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Sales vs Expenses (6 Months)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(value: any) => fmt(value)} />
          <Legend />
          <Bar dataKey="sales" fill="var(--primary-blue, #2845D6)" name="Sales" />
          <Bar dataKey="expenses" fill="#f59e0b" name="Expenses" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ProfitTrendChart({ data }: { data: ChartData[] }) {
  const fmt = (val: number) => formatINR(val)

  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Profit Trend (6 Months)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(value: any) => fmt(value)} />
          <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Net Profit" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ChartsGrid({ chartData6Mo }: DashboardChartsProps) {
  return (
    <div className="charts-grid">
      <SalesVsExpensesChart data={chartData6Mo} />
      <ProfitTrendChart data={chartData6Mo} />
    </div>
  )
}
