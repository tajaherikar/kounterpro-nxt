-- ============================================================
-- Suppliers table
-- Run this in your Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id       UUID REFERENCES shops(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  gstin         TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-Level Security
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own suppliers"
  ON suppliers FOR ALL
  USING (auth.uid() = user_id);

-- Index on user + shop for fast lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_user_shop ON suppliers(user_id, shop_id);
