-- Add database integrity for the selected Free automation.
-- Clear any stale values first, then enforce ON DELETE SET NULL.

UPDATE "User" AS u
SET "freeAutomationId" = NULL
WHERE u."freeAutomationId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Automation" AS a
    WHERE a."id" = u."freeAutomationId"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "User_freeAutomationId_key"
  ON "User"("freeAutomationId");

DO $$
BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_freeAutomationId_fkey"
    FOREIGN KEY ("freeAutomationId") REFERENCES "Automation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
