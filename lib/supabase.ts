/**
 * lib/supabase.ts
 *
 * Single Supabase client for the entire app.
 * Import `supabase` wherever you need DB / auth access.
 * No global window hacks, no polling, no re-initialisation.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  )
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)

// ─── Database types (extend as you add tables) ────────────────────────────

export type UserProfile = {
  id: string
  business_name: string
  mobile: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  gst_number?: string
  email?: string
  invoice_prefix?: string
  starting_invoice_number?: number
  current_invoice_counter?: number
  gst_invoice_counter?: number
  non_gst_invoice_counter?: number
  pan_number?: string
  bank_name?: string
  bank_account?: string
  bank_ifsc?: string
  bank_branch?: string
  logo_url?: string
  quick_bill_enabled?: boolean
}

export type Shop = {
  id: string
  user_id: string
  shop_name: string
  business_name?: string
  business_address?: string
  contact_number_1?: string
  business_email?: string
  gst_number?: string
  upi_id?: string
  logo_url?: string
  brand_color?: string
  invoice_template?: string
  invoice_prefix?: string
  starting_invoice_number?: number
  current_invoice_counter?: number
  is_default?: boolean
  created_at?: string
  updated_at?: string
}

export type InventoryItem = {
  id: string
  user_id: string
  shop_id?: string
  name: string
  description?: string
  opening_stock?: number
  stock: number
  purchase_price?: number
  rate: number
  gst_rate?: number
  hsn_code?: string
  barcode?: string
  low_stock_threshold?: number
  created_at?: string
  updated_at?: string
}

export type Customer = {
  id: string
  user_id: string
  shop_id?: string
  name: string
  mobile: string
  address?: string
  gst_number?: string
  gst?: string          // legacy alias
  email?: string
  created_at?: string
}

export type InvoiceItem = {
  description: string
  hsn_code?: string
  serial_no?: string
  quantity: number
  rate: number           // inclusive of GST (or exclusive when taxMode='without-tax')
  rateInclGST?: number   // explicit inclusive rate (use when stored)
  discount_percent?: number
  discountPercent?: number
  gstRate: number        // per-item GST %
  amount: number         // final amount for this line
  subtotal?: number      // excl GST
  inventory_id?: string
}

export type Invoice = {
  id: string
  user_id: string
  shop_id?: string
  invoice_number: string
  customer_name: string
  customer_mobile: string
  customer_address?: string
  customer_gst?: string
  date: string               // real DB column (YYYY-MM-DD)
  due_date?: string
  items: InvoiceItem[] | string
  total_amount: number
  subtotal?: number
  gst_amount?: number
  gst_rate?: number
  discount_amount?: number
  tax_mode?: string      // 'with-tax' | 'without-tax'
  taxMode?: string       // legacy alias
  is_inter_state?: boolean
  payment_type?: string  // 'cash' | 'credit' | 'upi' | etc.
  payment_status?: string
  terms_conditions?: string
  notes?: string
  is_quick_bill?: boolean
  created_at?: string
  updated_at?: string
}

export type Quotation = Omit<Invoice, 'invoice_number'> & {
  quotation_number: string
  valid_until?: string
  status?: 'draft' | 'sent' | 'accepted' | 'rejected'
}

export type Expense = {
  id: string
  user_id: string
  shop_id?: string
  description: string
  amount: number
  category?: string
  expense_date: string
  payment_method?: string
  notes?: string
  created_at?: string
}

// ─── Suppliers ────────────────────────────────────────────────────────────

export type Supplier = {
  id: string
  user_id: string
  shop_id?: string
  name: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
  gstin?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

// ─── Purchases ────────────────────────────────────────────────────────────

export type PurchaseItem = {
  item_name: string
  inventory_id?: string    // undefined = new item to be created
  hsn_code?: string
  quantity: number
  rate: number             // per unit, excl GST
  gst_rate: number         // %
  gst_amount: number       // calculated
  amount: number           // total incl GST
  is_new_item?: boolean    // true = create new inventory item
}

export type Purchase = {
  id: string
  user_id: string
  shop_id?: string
  supplier_id?: string
  purchase_number: string
  date: string             // YYYY-MM-DD
  items: PurchaseItem[] | string
  subtotal: number
  gst_amount: number
  total_amount: number
  notes?: string
  created_at?: string
  updated_at?: string
}
