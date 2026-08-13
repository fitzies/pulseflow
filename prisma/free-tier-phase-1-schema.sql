-- Phase 1b: apply after free-tier-phase-1.sql completes.
-- This migration is additive and backwards-compatible with the old app.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "freeAutomationId" TEXT;

ALTER TABLE "User"
  ALTER COLUMN "plan" SET DEFAULT 'FREE';

CREATE TABLE IF NOT EXISTS "DailyRunUsage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "utcDate" TEXT NOT NULL,
  "runCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyRunUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyRunUsage_userId_utcDate_key"
  ON "DailyRunUsage"("userId", "utcDate");

CREATE INDEX IF NOT EXISTS "DailyRunUsage_utcDate_idx"
  ON "DailyRunUsage"("utcDate");

DO $$
BEGIN
  ALTER TABLE "DailyRunUsage"
    ADD CONSTRAINT "DailyRunUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
