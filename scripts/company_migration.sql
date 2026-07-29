-- ══════════════════════════════════════════════════════════════════════════════
-- Migration: Add companies table + company_id FK on users
-- Run once in your Supabase SQL Editor on an existing database.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255),
  slug        VARCHAR(255) UNIQUE,
  email       VARCHAR(255) UNIQUE NOT NULL,
  phone       VARCHAR(50),
  website     VARCHAR(500),
  address     TEXT,
  folder_id   VARCHAR(255) UNIQUE NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_email     ON companies(email);
CREATE INDEX IF NOT EXISTS idx_companies_slug      ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_folder_id ON companies(folder_id);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages companies"
  ON companies FOR ALL
  USING (auth.role() = 'service_role');

-- 2. Add company_id column to existing users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
