import { prisma, withRetry } from '@/lib/prisma';
import { getTokenPriceUSD, evaluatePriceCondition } from '@/lib/blockchain-functions';
import { getNextRunDate } from '@/lib/cron-utils.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Cron orchestrator only needs 60s to dispatch

type StaleCleanupResult = {
  success: boolean;
  cleaned?: number;
  error?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

async function recordCronRun(data: {
  status: 'SUCCESS' | 'FAILED';
  triggeredCount?: number;
  error?: string;
}) {
  try {
    await withRetry(() => prisma.cronRun.create({ data }), 2, 250);
  } catch (error) {
    console.error('[Cron] Failed to record cron run:', error);
  }
}

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date();

  try {
    const warnings: string[] = [];
    let staleCleanup: StaleCleanupResult = { success: true, cleaned: 0 };

    // Clean up stale executions (RUNNING for more than 10 minutes)
    try {
      const staleThreshold = new Date(now.getTime() - 10 * 60 * 1000);
      const staleCleanupResult = await withRetry(() =>
        prisma.execution.updateMany({
          where: {
            status: 'RUNNING',
            startedAt: { lt: staleThreshold },
          },
          data: {
            status: 'FAILED',
            error: 'Execution timed out',
            finishedAt: now,
          },
        })
      );

      staleCleanup = { success: true, cleaned: staleCleanupResult.count };

      if (staleCleanupResult.count > 0) {
        console.log(`[Cron] Cleaned up ${staleCleanupResult.count} stale executions`);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      staleCleanup = { success: false, error: errorMessage };
      warnings.push('Stale execution cleanup failed; stale RUNNING rows may suppress due automations.');
      console.error('[Cron] Stale execution cleanup failed:', error);
    }

    // Find all scheduled automations that are due to run
    // Only for PRO and ULTRA users
    const dueAutomations = await withRetry(() =>
      prisma.automation.findMany({
        where: {
          triggerMode: 'SCHEDULE',
          nextRunAt: {
            lte: now,
          },
          executions: {
            none: {
              status: 'RUNNING',
            },
          },
          user: {
            plan: {
              in: ['PRO', 'ULTRA'],
            },
          },
        },
        select: {
          id: true,
          cronExpression: true,
        },
      })
    );

    console.log(`[Cron] Found ${dueAutomations.length} scheduled automations due to run`);

    // Find all price trigger automations that are past their cooldown
    // Only for PRO and ULTRA users
    const priceTriggerAutomations = await withRetry(() =>
      prisma.automation.findMany({
        where: {
          triggerMode: 'PRICE_TRIGGER',
          priceTriggerLpAddress: { not: null },
          priceTriggerOperator: { not: null },
          priceTriggerValue: { not: null },
          executions: {
            none: {
              status: 'RUNNING',
            },
          },
          user: {
            plan: {
              in: ['PRO', 'ULTRA'],
            },
          },
        },
        select: {
          id: true,
          priceTriggerLpAddress: true,
          priceTriggerOperator: true,
          priceTriggerValue: true,
          priceTriggerCooldownMinutes: true,
          priceTriggerLastTriggeredAt: true,
        },
      })
    );

    console.log(`[Cron] Found ${priceTriggerAutomations.length} price trigger automations to check`);

    // Check price triggers and collect those that should fire
    const priceTriggerResults: { id: string; shouldTrigger: boolean; price?: number; reason?: string }[] = [];
    
    for (const automation of priceTriggerAutomations) {
      // Check cooldown
      const cooldownMinutes = automation.priceTriggerCooldownMinutes ?? 15;
      const cooldownMs = cooldownMinutes * 60 * 1000;
      
      if (automation.priceTriggerLastTriggeredAt) {
        const timeSinceLastTrigger = now.getTime() - automation.priceTriggerLastTriggeredAt.getTime();
        if (timeSinceLastTrigger < cooldownMs) {
          priceTriggerResults.push({
            id: automation.id,
            shouldTrigger: false,
            reason: `Cooldown active (${Math.ceil((cooldownMs - timeSinceLastTrigger) / 60000)} min remaining)`,
          });
          continue;
        }
      }

      // Fetch current USD price
      try {
        const priceData = await getTokenPriceUSD(automation.priceTriggerLpAddress!);
        
        if (!priceData.isValid) {
          priceTriggerResults.push({
            id: automation.id,
            shouldTrigger: false,
            reason: priceData.error || 'Invalid LP address',
          });
          continue;
        }

        // Evaluate condition using USD price
        const conditionMet = evaluatePriceCondition(
          priceData.priceUSD,
          automation.priceTriggerOperator!,
          automation.priceTriggerValue!
        );

        priceTriggerResults.push({
          id: automation.id,
          shouldTrigger: conditionMet,
          price: priceData.priceUSD,
          reason: conditionMet 
            ? `Price $${priceData.priceUSD.toFixed(6)} ${automation.priceTriggerOperator} $${automation.priceTriggerValue}` 
            : `Condition not met: $${priceData.priceUSD.toFixed(6)} ${automation.priceTriggerOperator} $${automation.priceTriggerValue}`,
        });
      } catch (error) {
        console.error(`[Cron] Failed to check price for automation ${automation.id}:`, error);
        priceTriggerResults.push({
          id: automation.id,
          shouldTrigger: false,
          reason: error instanceof Error ? error.message : 'Price check failed',
        });
      }
    }

    // Collect automations to trigger
    const priceTriggerToFire = priceTriggerResults.filter(r => r.shouldTrigger);
    console.log(`[Cron] ${priceTriggerToFire.length} price triggers will fire`);

    // Atomically claim scheduled automations before dispatching. This prevents
    // overlapping scheduler ticks from sending the same due automation twice.
    const scheduledToFire: { id: string; type: 'scheduled' }[] = [];
    for (const automation of dueAutomations) {
      if (!automation.cronExpression) {
        continue;
      }

      const nextRunAt = await getNextRunDate(automation.cronExpression, now);
      const claim = await withRetry(() =>
        prisma.automation.updateMany({
          where: {
            id: automation.id,
            triggerMode: 'SCHEDULE',
            cronExpression: automation.cronExpression,
            nextRunAt: {
              lte: now,
            },
            executions: {
              none: {
                status: 'RUNNING',
              },
            },
            user: {
              plan: {
                in: ['PRO', 'ULTRA'],
              },
            },
          },
          data: {
            nextRunAt,
          },
        }),
        2,
        250
      );

      if (claim.count === 1) {
        scheduledToFire.push({ id: automation.id, type: 'scheduled' });
      } else {
        console.log(`[Cron] Skipped scheduled automation ${automation.id}; it was already claimed or is running`);
      }
    }

    // Claim price triggers before dispatching for the same reason.
    const priceTriggerAutomationById = new Map(priceTriggerAutomations.map((a) => [a.id, a]));
    const priceTriggersToFireClaimed: { id: string; type: 'price_trigger' }[] = [];
    for (const trigger of priceTriggerToFire) {
      const automation = priceTriggerAutomationById.get(trigger.id);
      if (!automation) {
        continue;
      }

      const cooldownMinutes = automation.priceTriggerCooldownMinutes ?? 15;
      const cooldownThreshold = new Date(now.getTime() - cooldownMinutes * 60 * 1000);
      const claim = await withRetry(() =>
        prisma.automation.updateMany({
          where: {
            id: trigger.id,
            triggerMode: 'PRICE_TRIGGER',
            executions: {
              none: {
                status: 'RUNNING',
              },
            },
            OR: [
              { priceTriggerLastTriggeredAt: null },
              { priceTriggerLastTriggeredAt: { lte: cooldownThreshold } },
            ],
            user: {
              plan: {
                in: ['PRO', 'ULTRA'],
              },
            },
          },
          data: {
            priceTriggerLastTriggeredAt: now,
          },
        }),
        2,
        250
      );

      if (claim.count === 1) {
        priceTriggersToFireClaimed.push({ id: trigger.id, type: 'price_trigger' });
      } else {
        console.log(`[Cron] Skipped price trigger automation ${trigger.id}; it was already claimed or is running`);
      }
    }

    // Combine scheduled and price trigger automations
    const allAutomationsToTrigger = [
      ...scheduledToFire,
      ...priceTriggersToFireClaimed,
    ];

    if (allAutomationsToTrigger.length === 0) {
      await recordCronRun({ status: 'SUCCESS', triggeredCount: 0 });
      return new Response(
        JSON.stringify({ 
          success: true, 
          triggered: 0,
          scheduled: { found: dueAutomations.length, triggered: 0 },
          priceTriggers: { found: priceTriggerAutomations.length, triggered: 0, results: priceTriggerResults },
          staleCleanup,
          warnings,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const workerUrl = process.env.WORKER_URL;
    if (!workerUrl) {
      throw new Error('WORKER_URL environment variable is not set');
    }

    console.log(`[Cron] Using worker URL: ${workerUrl}`);

    const workerHeaders: Record<string, string> = {
      'x-cron-secret': process.env.CRON_SECRET || '',
      'Content-Type': 'application/json',
    };

    // Fan-out: send each automation to the Railway worker (fire-and-forget)
    // Worker responds 202 immediately and runs execution in the background
    const triggerPromises = allAutomationsToTrigger.map(async (automation) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(`${workerUrl}/run-automation`, {
            method: 'POST',
            headers: workerHeaders,
            body: JSON.stringify({ automationId: automation.id, type: automation.type }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.status === 401) {
            console.error(`[Cron] Worker auth failed for ${automation.id} - check CRON_SECRET on Railway`);
            return { automationId: automation.id, type: automation.type, triggered: false, error: 'auth_failed' };
          }

          console.log(`[Cron] Dispatched ${automation.type} automation ${automation.id} to worker (status: ${response.status})`);
          return { automationId: automation.id, type: automation.type, triggered: true };
        } catch (fetchError: any) {
          clearTimeout(timeoutId);

          // AbortError means 202 was sent but connection timed out — worker is processing
          if (fetchError.name === 'AbortError') {
            console.log(`[Cron] Dispatched ${automation.type} automation ${automation.id} to worker (processing)`);
            return { automationId: automation.id, type: automation.type, triggered: true };
          }
          throw fetchError;
        }
      } catch (error) {
        console.error(`[Cron] Failed to dispatch automation ${automation.id} to worker:`, error);
        return { automationId: automation.id, type: automation.type, triggered: false };
      }
    });

    // Wait for all triggers to be sent (not for automations to complete)
    const results = await Promise.all(triggerPromises);

    const triggeredCount = results.filter((r) => r.triggered).length;
    const scheduledTriggered = results.filter((r) => r.triggered && r.type === 'scheduled').length;
    const priceTriggered = results.filter((r) => r.triggered && r.type === 'price_trigger').length;
    
    console.log(`[Cron] Successfully triggered ${triggeredCount} automations (${scheduledTriggered} scheduled, ${priceTriggered} price triggers)`);

    await recordCronRun({ status: 'SUCCESS', triggeredCount });

    return new Response(
      JSON.stringify({
        success: true,
        triggered: triggeredCount,
        total: allAutomationsToTrigger.length,
        scheduled: { found: dueAutomations.length, triggered: scheduledTriggered },
        priceTriggers: { found: priceTriggerAutomations.length, triggered: priceTriggered, results: priceTriggerResults },
        staleCleanup,
        warnings,
        results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Cron] Critical error:', error);
    await recordCronRun({
      status: 'FAILED',
      error: getErrorMessage(error),
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: getErrorMessage(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
