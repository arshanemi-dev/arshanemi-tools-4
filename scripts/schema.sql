-- ══════════════════════════════════════════════════════════════════════════════
-- Arshanemi — PostgreSQL Schema (Supabase)
-- Run this in your Supabase SQL Editor to set up all tables.
-- ══════════════════════════════════════════════════════════════════════════════

-- 0. companies — one row per tenant; created at signup before users row
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255),                         -- filled later if not given at signup
  slug        VARCHAR(255) UNIQUE,                  -- snake_case derived from name; null until name set
  email       VARCHAR(255) UNIQUE NOT NULL,         -- must be unique across all companies
  phone       VARCHAR(50),
  website     VARCHAR(500),
  address     TEXT,
  -- blob storage prefix segment: starts as "co_<nanoid>" then becomes slug once name is set
  folder_id   VARCHAR(255) UNIQUE NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_email     ON companies(email);
CREATE INDEX IF NOT EXISTS idx_companies_slug      ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_folder_id ON companies(folder_id);

-- 1. layout_settings — key/value JSON store for all site content & settings
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS layout_settings (
  id         SERIAL PRIMARY KEY,
  key        VARCHAR(255) UNIQUE NOT NULL,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_layout_settings_key ON layout_settings(key);

-- 2. users — admin and regular user accounts
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE,
  mobile        VARCHAR(20)  UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'user',   -- 'master_admin' | 'admin' | 'user'
  company_id    UUID REFERENCES companies(id) ON DELETE SET NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  otp_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,     -- require login OTP for this user
  address1      VARCHAR(255),
  address2      VARCHAR(255),
  address_city    VARCHAR(255),
  address_state   VARCHAR(255),
  address_country VARCHAR(255) DEFAULT 'India',
  address_pincode VARCHAR(20),
  company_name  VARCHAR(255),                            -- invoicing/GST business name (not the tenant company_id)
  gst_number    VARCHAR(50),
  wallet_credits_total INTEGER NOT NULL DEFAULT 0,       -- credits granted (admin-managed)
  wallet_credits_used  INTEGER NOT NULL DEFAULT 0,       -- credits consumed
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_mobile     ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_role       ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- 2b. user_settings — one row per user; tools_access is the JSON list of tool
--     slugs that user can open. Room for more per-user settings later.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tools_access JSONB       NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 3. user_otp — one-time passwords for password reset (60 s TTL)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_otp (
  id         SERIAL PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL,   -- email or mobile number
  otp_code   VARCHAR(10)  NOT NULL,
  type       VARCHAR(20)  NOT NULL,   -- 'email' | 'mobile'
  purpose    VARCHAR(50)  NOT NULL DEFAULT 'reset_password',
  expires_at TIMESTAMPTZ  NOT NULL,   -- NOW() + 60 seconds
  used       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_otp_identifier ON user_otp(identifier);
CREATE INDEX IF NOT EXISTS idx_user_otp_expires    ON user_otp(expires_at);

-- Auto-delete expired OTP rows (runs every minute in Supabase via pg_cron)
-- If pg_cron is enabled, uncomment the block below:
-- SELECT cron.schedule(
--   'delete-expired-otps',
--   '* * * * *',
--   $$ DELETE FROM user_otp WHERE expires_at < NOW() $$
-- );

-- ══════════════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — enable after setup
-- ══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE layout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_otp         ENABLE ROW LEVEL SECURITY;

-- layout_settings: public read, service-role write
CREATE POLICY "Public can read layout_settings"
  ON layout_settings FOR SELECT
  USING (TRUE);

CREATE POLICY "Service role can write layout_settings"
  ON layout_settings FOR ALL
  USING (auth.role() = 'service_role');

-- companies: service-role full access only
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages companies"
  ON companies FOR ALL
  USING (auth.role() = 'service_role');

-- users: service-role full access only (sensitive data)
CREATE POLICY "Service role manages users"
  ON users FOR ALL
  USING (auth.role() = 'service_role');

-- user_settings: service-role full access only
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages user_settings"
  ON user_settings FOR ALL
  USING (auth.role() = 'service_role');

-- user_otp: service-role full access only
CREATE POLICY "Service role manages user_otp"
  ON user_otp FOR ALL
  USING (auth.role() = 'service_role');

-- 4. files_expiry — named file records with expiry tracking
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS files_expiry (
  id         TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL UNIQUE,
  expiry_at  TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_expiry_name      ON files_expiry(name);
CREATE INDEX IF NOT EXISTS idx_files_expiry_expiry_at ON files_expiry(expiry_at);

ALTER TABLE files_expiry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages files_expiry"
  ON files_expiry FOR ALL
  USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════════════════
-- Seed default admin user (password: Admin@1234  — change after first login)
-- Run: SELECT crypt('Admin@1234', gen_salt('bf')) to get the hash, then insert.
-- Or use the npm run seed command which does this automatically via bcryptjs.
-- ══════════════════════════════════════════════════════════════════════════════
