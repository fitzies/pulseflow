import { prisma, withRetry } from '@/lib/prisma';
import { getTokenPriceUSD, evaluatePriceCondition } from '@/lib/blockchain-functions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Cron orchestrator only needs 60s to dispatch

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
    // Clean up stale executions (RUNNING for more than 10 minutes)
    const staleThreshold = new Date(now.getTime() - 10 * 60 * 1000);
    const staleCleanup = await withRetry(() =>
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

    if (staleCleanup.count > 0) {
      console.log(`[Cron] Cleaned up ${staleCleanup.count} stale executions`);
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
          user: {
            plan: {
              in: ['PRO', 'ULTRA'],
            },
          },
        },
        select: {
          id: true,
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

    // Combine scheduled and price trigger automations
    const allAutomationsToTrigger = [
      ...dueAutomations.map(a => ({ id: a.id, type: 'scheduled' as const })),
      ...priceTriggerToFire.map(a => ({ id: a.id, type: 'price_trigger' as const })),
    ];

    if (allAutomationsToTrigger.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          triggered: 0,
          scheduled: { found: dueAutomations.length, triggered: 0 },
          priceTriggers: { found: priceTriggerAutomations.length, triggered: 0, results: priceTriggerResults },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine base URL for API calls
    // IMPORTANT: Set APP_URL env var to your production domain to avoid preview deployment protection issues
    const baseUrl = process.env.APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    console.log(`[Cron] Using base URL: ${baseUrl}`);

    // Build headers - include bypass secret if set (for Vercel Deployment Protection)
    const headers: Record<string, string> = {
      'x-cron-secret': process.env.CRON_SECRET || '',
      'Content-Type': 'application/json',
    };
    
    // Add Vercel deployment protection bypass if configured
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    }

    // Fan-out: trigger each automation in parallel (fire-and-forget)
    // Each automation runs in its own serverless function with its own 300s budget
    const triggerPromises = allAutomationsToTrigger.map(async (automation) => {
      try {
        const url = `${baseUrl}/api/automations/${automation.id}/run-cron`;
        const controller = new AbortController();
        
        // Give it 10s to get initial response (enough to check auth, not wait for completion)
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers,
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          // If we got a quick response, check if it was an auth error
          if (response.status === 401) {
            console.error(`[Cron] Auth failed for ${automation.id} - check APP_URL or VERCEL_AUTOMATION_BYPASS_SECRET`);
            return { automationId: automation.id, type: automation.type, triggered: false, error: 'auth_failed' };
          }
          
          // Update lastTriggeredAt for price triggers
          if (automation.type === 'price_trigger') {
            await withRetry(() =>
              prisma.automation.update({
                where: { id: automation.id },
                data: { priceTriggerLastTriggeredAt: now },
              })
            );
          }
          
          console.log(`[Cron] Triggered ${automation.type} automation ${automation.id} (status: ${response.status})`);
          return { automationId: automation.id, type: automation.type, triggered: true };
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          
          // AbortError means timeout - request was sent and is processing
          if (fetchError.name === 'AbortError') {
            // Update lastTriggeredAt for price triggers even on timeout (request was sent)
            if (automation.type === 'price_trigger') {
              await withRetry(() =>
                prisma.automation.update({
                  where: { id: automation.id },
                  data: { priceTriggerLastTriggeredAt: now },
                })
              );
            }
            console.log(`[Cron] Triggered ${automation.type} automation ${automation.id} (processing)`);
            return { automationId: automation.id, type: automation.type, triggered: true };
          }
          throw fetchError;
        }
      } catch (error) {
        console.error(`[Cron] Failed to trigger automation ${automation.id}:`, error);
        return { automationId: automation.id, type: automation.type, triggered: false };
      }
    });

    // Wait for all triggers to be sent (not for automations to complete)
    const results = await Promise.all(triggerPromises);

    const triggeredCount = results.filter((r) => r.triggered).length;
    const scheduledTriggered = results.filter((r) => r.triggered && r.type === 'scheduled').length;
    const priceTriggered = results.filter((r) => r.triggered && r.type === 'price_trigger').length;
    
    console.log(`[Cron] Successfully triggered ${triggeredCount} automations (${scheduledTriggered} scheduled, ${priceTriggered} price triggers)`);

    return new Response(
      JSON.stringify({
        success: true,
        triggered: triggeredCount,
        total: allAutomationsToTrigger.length,
        scheduled: { found: dueAutomations.length, triggered: scheduledTriggered },
        priceTriggers: { found: priceTriggerAutomations.length, triggered: priceTriggered, results: priceTriggerResults },
        results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Cron] Critical error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
