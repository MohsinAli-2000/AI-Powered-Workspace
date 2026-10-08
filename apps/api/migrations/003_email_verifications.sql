-- 003_email_verifications.sql
-- Store pending email verifications so users must verify email ownership BEFORE an account is created.
-- Ensures verification tokens are one-time-use, expire after a duration, and cannot be reused.

BEGIN;

CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'CONSUMED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS email_verifications_email_idx ON email_verifications (LOWER(email));
CREATE INDEX IF NOT EXISTS email_verifications_token_hash_idx ON email_verifications (token_hash);

COMMIT;
