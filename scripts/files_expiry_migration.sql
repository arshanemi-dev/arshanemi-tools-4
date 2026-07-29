-- Migration: add files_expiry table
-- Run this in the Supabase SQL Editor if you have an existing deployment.

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
