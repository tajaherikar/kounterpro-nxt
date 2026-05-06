-- Migration: Add profile columns to user_profiles table
-- Run this in Supabase SQL Editor

-- Add missing columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS logo_position VARCHAR(20) DEFAULT 'left',
ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS invoice_prefix VARCHAR(20) DEFAULT 'INV',
ADD COLUMN IF NOT EXISTS starting_invoice_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_invoice_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS quick_bill_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS selected_template VARCHAR(50) DEFAULT 'classic';
