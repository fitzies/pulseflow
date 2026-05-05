import { prisma, withRetry } from '@/lib/prisma';
import { getNextRunDate } from '@/lib/cron-utils.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Cron orchestrator only needs 60s to dispatch

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

    const allAutomationsToTrigger = scheduledToFire;

    if (allAutomationsToTrigger.length === 0) {
      await recordCronRun({ status: 'SUCCESS', triggeredCount: 0 });
      return new Response(
        JSON.stringify({ 
          success: true, 
          triggered: 0,
          scheduled: { found: dueAutomations.length, triggered: 0 },
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
    
    console.log(`[Cron] Successfully triggered ${triggeredCount} scheduled automations`);

    await recordCronRun({ status: 'SUCCESS', triggeredCount });

    return new Response(
      JSON.stringify({
        success: true,
        triggered: triggeredCount,
        total: allAutomationsToTrigger.length,
        scheduled: { found: dueAutomations.length, triggered: scheduledTriggered },
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
