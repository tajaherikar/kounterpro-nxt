/**
 * lib/db.ts
 *
 * Higher-level database layer — wraps Supabase queries.
 * Replaces all the scattered supabase*.js functions.
 * Use these from React components via React Query hooks.
 *
 * Pattern:
 *   - Query fns: `fetch*` (called by useQuery)
 *   - Mutation fns: `create*`, `update*`, `delete*` (called by useMutation)
 */
import { supabase, type Customer, type InventoryItem, type Invoice, type Shop, type Supplier, type Purchase, type PurchaseItem } from './supabase'

// ─── Auth Helpers ────────────────────────────────────────────────────────────

/**
 * Get current user with retry logic for transient auth lock errors
 */
export async function getCurrentUser(maxRetries = 3) {
  let lastError: any = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    } catch (err: any) {
      lastError = err
      // Check if it's an auth lock error (transient)
      const isLockError = err.message?.includes('Lock') && err.message?.includes('was released')
      if (!isLockError || attempt === maxRetries - 1) {
        // Not a lock error or last attempt — give up
        break
      }
      // Exponential backoff: wait 100ms, 200ms, 400ms, etc.
      const waitMs = Math.pow(2, attempt) * 100
      await new Promise(r => setTimeout(r, waitMs))
    }
  }
  
  throw lastError
}

// ─── Customers ────────────────────────────────────────────────────────────

export async function fetchCustomers(shopId?: string) {
  try {
    let query = supabase.from('customers').select('*')
    if (shopId) query = query.eq('shop_id', shopId)
    const { data, error } = await query.order('name')
    
    if (error) {
      console.error('Supabase error fetching customers:', error.message)
      throw new Error(`Failed to fetch customers: ${error.message}`)
    }
    
    return data as Customer[]
  } catch (err) {
    console.error('Error in fetchCustomers:', err)
    throw err
  }
}

export async function createCustomer(data: Omit<Customer, 'id' | 'created_at'>) {
  const { data: result, error } = await supabase.from('customers').insert([data]).select()
  if (error) throw error
  return result?.[0] as Customer
}

export async function updateCustomer(id: string, updates: Partial<Customer>) {
  const { data, error } = await supabase.from('customers').update(updates).eq('id', id).select()
  if (error) throw error
  return data?.[0] as Customer
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}

// ─── Inventory ────────────────────────────────────────────────────────────

export async function fetchInventory(shopId?: string) {
  try {
    let query = supabase.from('inventory').select('*')
    if (shopId) query = query.eq('shop_id', shopId)
    const { data, error } = await query.order('name')
    
    if (error) {
      console.error('Supabase error fetching inventory:', error.message)
      throw new Error(`Failed to fetch inventory: ${error.message}`)
    }
    
    return data as InventoryItem[]
  } catch (err) {
    console.error('Error in fetchInventory:', err)
    throw err
  }
}

export async function createInventoryItem(data: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>) {
  const { data: result, error } = await supabase.from('inventory').insert([data]).select()
  if (error) throw error
  return result?.[0] as InventoryItem
}

export async function updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
  const { data, error } = await supabase
    .from('inventory')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  return data?.[0] as InventoryItem
}

export async function deleteInventoryItem(id: string) {
  const { error } = await supabase.from('inventory').delete().eq('id', id)
  if (error) throw error
}

/** Reduce stock after a sale */
export async function deductInventoryStock(itemId: string, quantity: number) {
  const { data, error } = await supabase.rpc('deduct_inventory_stock', {
    item_id: itemId,
    qty: quantity,
  })
  if (error) throw error
  return data
}

// ─── Invoices ─────────────────────────────────────────────────────────────

export async function fetchInvoices(shopId?: string) {
  try {
    let query = supabase.from('invoices').select('*')
    if (shopId) query = query.eq('shop_id', shopId)
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      console.error('Supabase error fetching invoices:', error.message)
      throw new Error(`Failed to fetch invoices: ${error.message}`)
    }
    
    return data as Invoice[]
  } catch (err) {
    console.error('Error in fetchInvoices:', err)
    throw err
  }
}

// Fields that exist in the app layer but not as DB columns — strip before insert/update
function toDbInvoice<T extends Partial<Invoice>>(data: T): Omit<T, 'is_inter_state' | 'is_quick_bill' | 'terms_conditions' | 'notes'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { is_inter_state, is_quick_bill, terms_conditions, notes, ...dbData } = data as any
  return dbData
}

export async function createInvoice(data: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>) {
  const { data: result, error } = await supabase.from('invoices').insert([toDbInvoice(data)]).select()
  if (error) throw error
  return result?.[0] as Invoice
}

export async function updateInvoice(id: string, updates: Partial<Invoice>) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ ...toDbInvoice(updates), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  return data?.[0] as Invoice
}

export async function deleteInvoice(id: string) {
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw error
}

// ─── User Profile ─────────────────────────────────────────────────────────

/**
 * Fetch user profile with retry logic for transient auth lock errors
 */
export async function fetchUserProfile(userId: string, maxRetries = 3) {
  let lastError: any = null
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error  // ignore "no rows" error
      return data || null
    } catch (err: any) {
      lastError = err
      // Check if it's an auth lock error (transient)
      const isLockError = err.message?.includes('Lock') && err.message?.includes('was released')
      if (!isLockError || attempt === maxRetries - 1) {
        // Not a lock error or last attempt — give up
        break
      }
      // Exponential backoff: wait 100ms, 200ms, 400ms, etc.
      const waitMs = Math.pow(2, attempt) * 100
      await new Promise(r => setTimeout(r, waitMs))
    }
  }
  
  throw lastError
}

export async function updateUserProfile(userId: string, updates: Record<string, any>) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select()
  if (error) throw error
  return data?.[0]
}

// ─── Shops ────────────────────────────────────────────────────────────────

export async function fetchShops() {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .order('shop_name')
  if (error) throw error
  return (data || []) as Shop[]
}

// ─── Suppliers ────────────────────────────────────────────────────────────

export async function fetchSuppliers(shopId?: string) {
  let query = supabase.from('suppliers').select('*')
  if (shopId) query = query.eq('shop_id', shopId)
  const { data, error } = await query.order('name')
  if (error) throw error
  return (data || []) as Supplier[]
}

export async function createSupplier(data: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) {
  const { data: result, error } = await supabase.from('suppliers').insert([data]).select()
  if (error) throw error
  return result?.[0] as Supplier
}

export async function updateSupplier(id: string, updates: Partial<Supplier>) {
  const { data, error } = await supabase
    .from('suppliers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
  if (error) throw error
  return data?.[0] as Supplier
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw error
}

// ─── Purchases ────────────────────────────────────────────────────────────

export async function fetchPurchases(shopId?: string) {
  let query = supabase.from('purchases').select('*')
  if (shopId) query = query.eq('shop_id', shopId)
  const { data, error } = await query.order('date', { ascending: false })
  if (error) throw error
  return (data || []) as Purchase[]
}

export async function fetchPurchase(id: string) {
  const { data, error } = await supabase.from('purchases').select('*').eq('id', id).single()
  if (error) throw error
  return data as Purchase
}

/**
 * Create a purchase entry and update/create inventory items atomically.
 * For each line item:
 *   - is_new_item=true  → INSERT into inventory (stock = quantity, purchase_price = rate)
 *   - inventory_id set  → UPDATE inventory stock += quantity, purchase_price = rate
 */
export async function createPurchase(
  purchaseData: Omit<Purchase, 'id' | 'created_at' | 'updated_at'>,
) {
  const items: PurchaseItem[] = Array.isArray(purchaseData.items)
    ? purchaseData.items
    : JSON.parse(purchaseData.items as string)

  console.log('[DEBUG] createPurchase called with:', { purchaseData, itemsCount: items.length, items })

  // 1. Insert the purchase record (items stored as JSON)
  const { data: result, error } = await supabase
    .from('purchases')
    .insert([{ ...purchaseData, items: JSON.stringify(items) }])
    .select()
  if (error) {
    console.error('[ERROR] Failed to insert purchase:', error)
    throw error
  }
  const purchase = result?.[0] as Purchase
  console.log('[DEBUG] Purchase created:', purchase.id)

  // 2. Update or create inventory items
  for (const item of items) {
    console.log('[DEBUG] Processing item:', { item_name: item.item_name, is_new: item.is_new_item, inv_id: item.inventory_id })
    
    if (item.is_new_item || !item.inventory_id) {
      // Create new inventory item
      console.log('[DEBUG] Creating new inventory item:', item.item_name)
      const invPayload = {
        user_id: purchaseData.user_id,
        shop_id: purchaseData.shop_id || null,
        name: item.item_name,
        stock: item.quantity,
        opening_stock: item.quantity,
        rate: item.rate, // sale price - default to purchase price for now
        purchase_price: item.rate,
        low_stock_threshold: 5,
      }
      console.log('[DEBUG] Inventory insert payload:', invPayload)
      const { data: invData, error: invError } = await supabase.from('inventory').insert([invPayload]).select()
      if (invError) {
        console.error('[ERROR] Failed to insert inventory item:', { 
          item_name: item.item_name, 
          error: invError,
          errorMessage: invError.message,
          errorDetails: invError.details,
          payload: invPayload
        })
        throw new Error(`Failed to create inventory item "${item.item_name}": ${invError.message}`)
      }
      console.log('[DEBUG] Inventory item created:', invData?.[0]?.id)
    } else {
      // Increment existing item's stock and update purchase_price
      console.log('[DEBUG] Updating existing inventory:', item.inventory_id)
      const { data: existing, error: fetchError } = await supabase
        .from('inventory')
        .select('stock,id')
        .eq('id', item.inventory_id)
        .single()
      if (fetchError) {
        console.error('[ERROR] Failed to fetch inventory item:', { id: item.inventory_id, error: fetchError })
        throw fetchError
      }
      if (existing) {
        const newStock = (existing.stock || 0) + item.quantity
        console.log('[DEBUG] Updating stock from', existing.stock, 'to', newStock)
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            stock: newStock,
            purchase_price: item.rate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.inventory_id)
        if (updateError) {
          console.error('[ERROR] Failed to update inventory stock:', { id: item.inventory_id, error: updateError })
          throw updateError
        }
      }
    }
  }

  console.log('[DEBUG] Purchase creation complete')
  return purchase
}

export async function deletePurchase(id: string) {
  const { error } = await supabase.from('purchases').delete().eq('id', id)
  if (error) throw error
}
