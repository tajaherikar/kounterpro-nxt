'use client'
/**
 * hooks/useAPI.ts
 *
 * TanStack React Query hooks — wraps lib/db.ts for automatic caching & refetch.
 *
 * Usage in components:
 *   const customers = useCustomers(shopId)
 *   const inventory = useInventory(shopId)
 *   etc.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as db from '@/lib/db'
import type { Customer, InventoryItem, Invoice, Supplier, Purchase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

// ─── Shops ────────────────────────────────────────────────────────────────

export function useShops() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shops'],
    queryFn: () => db.fetchShops(),
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // shops rarely change
  })
}

// ─── User Profile ─────────────────────────────────────────────────────────

export function useUserProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: () => db.fetchUserProfile(user!.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  })
}

// ─── Customers ────────────────────────────────────────────────────────────

export function useCustomers(shopId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['customers', shopId],
    queryFn: () => db.fetchCustomers(shopId),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,  // 5 min
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Customer> }) =>
      db.updateCustomer(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

// ─── Inventory ────────────────────────────────────────────────────────────

export function useInventory(shopId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['inventory', shopId],
    queryFn: () => db.fetchInventory(shopId),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,  // 5 min
  })
}

export function useCreateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createInventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<InventoryItem> }) =>
      db.updateInventoryItem(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteInventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}

// ─── Invoices ─────────────────────────────────────────────────────────────

export function useInvoices(shopId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['invoices', shopId],
    queryFn: () => db.fetchInvoices(shopId),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,  // 2 min (more volatile data)
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Invoice> }) =>
      db.updateInvoice(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

// ─── Suppliers ────────────────────────────────────────────────────────────

export function useSuppliers(shopId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['suppliers', shopId],
    queryFn: () => db.fetchSuppliers(shopId),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Supplier> }) =>
      db.updateSupplier(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deleteSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

// ─── Purchases ────────────────────────────────────────────────────────────

export function usePurchases(shopId?: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['purchases', shopId],
    queryFn: () => db.fetchPurchases(shopId),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreatePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.createPurchase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      qc.invalidateQueries({ queryKey: ['inventory'] }) // stock changed
    },
  })
}

export function useDeletePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: db.deletePurchase,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases'] }),
  })
}

