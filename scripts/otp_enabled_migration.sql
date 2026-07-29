-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: Add otp_enabled flag to users + document the 'admin' role
-- Run once in your Supabase SQL Editor on an existing database.
-- ══════════════════════════════════════════════════════════════════════════════

-- users.role already stores free-form VARCHAR(50) with no CHECK constraint,
-- so 'admin' (company-scoped manager, between master_admin and user) needs no
-- schema change — only this column is new:
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
