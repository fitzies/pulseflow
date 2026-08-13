-- Phase 1a: apply this first and commit the new PostgreSQL enum value before
-- applying free-tier-phase-1-schema.sql.

DO $$
BEGIN
  ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'FREE' BEFORE 'BASIC';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
