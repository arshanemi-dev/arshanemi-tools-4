-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: Add address fields + a simple wallet-credits ledger to users
-- Run once in your Supabase SQL Editor on an existing database.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS address1 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address2 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS wallet_credits_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_credits_used  INTEGER NOT NULL DEFAULT 0;
