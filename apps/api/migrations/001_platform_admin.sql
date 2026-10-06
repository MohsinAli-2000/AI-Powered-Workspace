-- 001_platform_admin.sql
-- Platform administration: a product-owner flag on users and a suspension state on organizations.
-- Idempotent: safe to run more than once (`npm run platform-admin -- migrate` in apps/api).

BEGIN;

-- Platform admins operate the product itself. This is NOT an organization role and grants no access to
-- any organization's documents or conversations.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- A suspended organization keeps all of its data, but none of its members can use it until reactivated.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_status_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS organizations_status_idx ON organizations (status);

COMMIT;
