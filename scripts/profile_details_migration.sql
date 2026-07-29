-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: Add invoicing/profile details to users (company name, GST
-- number, structured address) — Profile page KYC/invoicing section.
-- Run once in your Supabase SQL Editor on an existing database.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_name      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS gst_number        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address_city      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_state     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_country   VARCHAR(255) DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS address_pincode   VARCHAR(20);
