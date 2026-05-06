-- ============================================================
-- Purchases table
-- Run AFTER add-suppliers-table.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS purchases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id          UUID REFERENCES shops(id) ON DELETE SET NULL,
  supplier_id      UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_number  TEXT NOT NULL,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  -- items stored as JSONB array (same pattern as invoices)
  items            JSONB NOT NULL DEFAULT '[]',
  subtotal         DECIMAL(14,2) NOT NULL DEFAULT 0,
  gst_amount       DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-Level Security
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own purchases"
  ON purchases FOR ALL
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_user_shop    ON purchases(user_id, shop_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier     ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date         ON purchases(date DESC);
