-- Run after the Free-tier application deployment is healthy.
-- Existing paid BASIC subscribers remain on their grandfathered plan.

UPDATE "User"
SET "plan" = 'FREE'
WHERE "plan" IS NULL;

UPDATE "Automation" AS a
SET
  "triggerMode" = 'MANUAL',
  "cronExpression" = NULL,
  "nextRunAt" = NULL,
  "priceTriggerLpAddress" = NULL,
  "priceTriggerOperator" = NULL,
  "priceTriggerValue" = NULL,
  "priceTriggerLastTriggeredAt" = NULL
FROM "User" AS u
WHERE a."userId" = u."id"
  AND u."plan" = 'FREE'
  AND a."triggerMode" <> 'MANUAL';

UPDATE "User" AS u
SET "freeAutomationId" = (
  SELECT a."id"
  FROM "Automation" AS a
  WHERE a."userId" = u."id"
  ORDER BY a."createdAt" ASC, a."id" ASC
  LIMIT 1
)
WHERE u."plan" = 'FREE'
  AND u."freeAutomationId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Automation" AS a WHERE a."userId" = u."id"
  );
