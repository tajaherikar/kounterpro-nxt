# 📝 Implementation Examples

## Example 1: Using BillPrintModal in a Reports Page

```typescript
'use client'

import React, { useState } from 'react'
import BillPrintModal from '@/components/BillPrintModal'
import { Printer } from 'lucide-react'

export default function ReportsPage() {
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)

  // Your bills data
  const [bills, setBills] = useState([
    {
      id: '1',
      invoiceNumber: 'INV-001',
      customerName: 'John Doe',
      customerPhone: '+91 98765 43210',
      customerEmail: 'john@example.com',
      customerGST: '29AAFCK5055K1Z5',
      customerAddress: '123 Main St, New York, NY 10001',
      date: '2025-04-20',
      dueDate: '2025-05-20',
      items: [
        {
          id: '1',
          description: 'Widget A',
          hsn: '1001',
          quantity: 5,
          price: 100,
          gstRate: 18,
          total: 590, // After tax
        },
        {
          id: '2',
          description: 'Service B',
          hsn: '1002',
          quantity: 2,
          price: 250,
          gstRate: 18,
          total: 590,
        },
      ],
      subtotal: 1000,
      cgst: 90,
      sgst: 90,
      igst: 0,
      taxAmount: 180,
      total: 1180,
      status: 'unpaid',
      gstEnabled: true,
      isInterState: false,
    },
  ])

  const businessProfile = {
    business_name: 'Keen Batteries',
    business_address: 'Indra Auto Nagar, Rangeen Maujid Road, Bijapur',
    contact_number_1: '+91 6361082439',
    contact_number_2: '+91 8088573717',
    business_email: 'keenbatteries@gmail.com',
    gst_number: '29AVLPA7490C1ZH',
  }

  const handlePrintBill = (bill) => {
    setSelectedBill(bill)
    setShowPrintModal(true)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Invoice #</th>
              <th className="px-6 py-3 text-left font-semibold">Customer</th>
              <th className="px-6 py-3 text-left font-semibold">Date</th>
              <th className="px-6 py-3 text-right font-semibold">Total</th>
              <th className="px-6 py-3 text-left font-semibold">Status</th>
              <th className="px-6 py-3 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-3 font-medium">{bill.invoiceNumber}</td>
                <td className="px-6 py-3">{bill.customerName}</td>
                <td className="px-6 py-3">
                  {new Date(bill.date).toLocaleDateString('en-IN')}
                </td>
                <td className="px-6 py-3 text-right font-medium">
                  ₹{bill.total.toLocaleString('en-IN')}
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      bill.status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : bill.status === 'partial'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {bill.status === 'paid' ? 'Paid' : bill.status === 'partial' ? 'Partial' : 'Unpaid'}
                  </span>
                </td>
                <td className="px-6 py-3 text-center">
                  <button
                    onClick={() => handlePrintBill(bill)}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Print Modal */}
      <BillPrintModal
        isOpen={showPrintModal}
        bill={selectedBill}
        businessProfile={businessProfile}
        onClose={() => {
          setShowPrintModal(false)
          setSelectedBill(null)
        }}
      />
    </div>
  )
}
```

---

## Example 2: Integration with Existing Invoice List

```typescript
// In your invoices page or component

import BillPrintModal from '@/components/BillPrintModal'
import { useCallback, useState } from 'react'

export default function InvoicesPage() {
  // ... existing code ...

  const [showPrintModal, setShowPrintModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  const handleViewInvoice = useCallback((invoice) => {
    setSelectedInvoice(invoice)
    setShowPrintModal(true)
  }, [])

  return (
    <>
      {/* Your existing table/list */}
      <div className="space-y-4">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="flex items-center justify-between p-4 bg-white rounded-lg shadow"
          >
            <div>
              <h3 className="font-semibold">{invoice.invoiceNumber}</h3>
              <p className="text-sm text-gray-600">{invoice.customerName}</p>
            </div>
            <button
              onClick={() => handleViewInvoice(invoice)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View & Print
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      <BillPrintModal
        isOpen={showPrintModal}
        bill={selectedInvoice}
        businessProfile={businessProfile}
        onClose={() => {
          setShowPrintModal(false)
          setSelectedInvoice(null)
        }}
      />
    </>
  )
}
```

---

## Example 3: Creating a Bill from Form Data

```typescript
'use client'

import { useState } from 'react'
import BillPrintModal from '@/components/BillPrintModal'

export default function CreateBillPage() {
  const [billData, setBillData] = useState({
    invoiceNumber: 'INV-001',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    items: [{ description: '', quantity: 1, price: 0, gstRate: 18 }],
    notes: '',
  })

  const [showPrint, setShowPrint] = useState(false)
  const [generatedBill, setGeneratedBill] = useState(null)

  const handleGenerateBill = (e) => {
    e.preventDefault()

    // Calculate totals
    const subtotal = billData.items.reduce((sum, item) => sum + item.quantity * item.price, 0)
    const taxAmount = subtotal * 0.18 // 18% GST
    const total = subtotal + taxAmount

    const bill = {
      id: Date.now().toString(),
      invoiceNumber: billData.invoiceNumber,
      customerName: billData.customerName,
      customerPhone: billData.customerPhone,
      customerEmail: billData.customerEmail,
      date: new Date().toISOString(),
      items: billData.items,
      subtotal,
      cgst: taxAmount / 2,
      sgst: taxAmount / 2,
      igst: 0,
      taxAmount,
      total,
      status: 'unpaid',
      gstEnabled: true,
      isInterState: false,
      notes: billData.notes,
    }

    setGeneratedBill(bill)
    setShowPrint(true)
  }

  return (
    <>
      <form onSubmit={handleGenerateBill} className="max-w-2xl mx-auto space-y-6">
        {/* Customer Details */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Customer Details</h2>
          <input
            type="text"
            placeholder="Customer Name"
            value={billData.customerName}
            onChange={(e) => setBillData({ ...billData, customerName: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
          <input
            type="email"
            placeholder="Customer Email"
            value={billData.customerEmail}
            onChange={(e) => setBillData({ ...billData, customerEmail: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
          <input
            type="tel"
            placeholder="Customer Phone"
            value={billData.customerPhone}
            onChange={(e) => setBillData({ ...billData, customerPhone: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        {/* Items */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Items</h2>
          {billData.items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Description"
                value={item.description}
                onChange={(e) => {
                  const newItems = [...billData.items]
                  newItems[idx].description = e.target.value
                  setBillData({ ...billData, items: newItems })
                }}
                className="px-4 py-2 border rounded-lg"
              />
              <input
                type="number"
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) => {
                  const newItems = [...billData.items]
                  newItems[idx].quantity = parseInt(e.target.value) || 0
                  setBillData({ ...billData, items: newItems })
                }}
                className="px-4 py-2 border rounded-lg"
              />
              <input
                type="number"
                placeholder="Price"
                value={item.price}
                onChange={(e) => {
                  const newItems = [...billData.items]
                  newItems[idx].price = parseFloat(e.target.value) || 0
                  setBillData({ ...billData, items: newItems })
                }}
                className="px-4 py-2 border rounded-lg"
              />
              <input
                type="number"
                placeholder="GST%"
                value={item.gstRate}
                onChange={(e) => {
                  const newItems = [...billData.items]
                  newItems[idx].gstRate = parseInt(e.target.value) || 18
                  setBillData({ ...billData, items: newItems })
                }}
                className="px-4 py-2 border rounded-lg"
              />
            </div>
          ))}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold mb-2">Notes</label>
          <textarea
            value={billData.notes}
            onChange={(e) => setBillData({ ...billData, notes: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
            rows={3}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
        >
          Generate & Print Invoice
        </button>
      </form>

      {/* Print Modal */}
      <BillPrintModal
        isOpen={showPrint}
        bill={generatedBill}
        businessProfile={{
          business_name: 'Your Business',
          business_address: '123 Main St, City',
          contact_number_1: '+91 XXXXXXXXXX',
          gst_number: '29XXXXX0000X0Z0',
        }}
        onClose={() => {
          setShowPrint(false)
          setGeneratedBill(null)
        }}
      />
    </>
  )
}
```

---

## Example 4: API Integration

```typescript
// Fetch invoice from API and print

import { useQuery } from '@tanstack/react-query'
import BillPrintModal from '@/components/BillPrintModal'
import { useState } from 'react'

export default function PrintInvoiceFromID({ invoiceId }) {
  const [showPrint, setShowPrint] = useState(false)

  // Fetch invoice
  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${invoiceId}`)
      return res.json()
    },
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <>
      <button
        onClick={() => setShowPrint(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Print Invoice
      </button>

      <BillPrintModal
        isOpen={showPrint}
        bill={invoice}
        businessProfile={{
          business_name: 'Your Business',
          business_address: '123 Main St, City',
          contact_number_1: '+91 XXXXXXXXXX',
          gst_number: '29XXXXX0000X0Z0',
        }}
        onClose={() => setShowPrint(false)}
      />
    </>
  )
}
```

---

## Quick Copy-Paste Usage

```typescript
import BillPrintModal from '@/components/BillPrintModal'
import { useState } from 'react'

function MyComponent() {
  const [showPrint, setShowPrint] = useState(false)
  const [bill, setBill] = useState(null)

  return (
    <>
      <button onClick={() => { setBill(myBillObject); setShowPrint(true) }}>
        Print
      </button>

      <BillPrintModal
        isOpen={showPrint}
        bill={bill}
        businessProfile={myBusinessProfile}
        onClose={() => setShowPrint(false)}
      />
    </>
  )
}
```

---

## Next Steps

1. ✅ Copy `BillPrintModal.tsx` to your `components/` folder
2. ✅ Import in your page/component
3. ✅ Pass `bill`, `businessProfile`, and callbacks
4. ✅ Test the print dialog
5. ✅ Customize colors/styling as needed
