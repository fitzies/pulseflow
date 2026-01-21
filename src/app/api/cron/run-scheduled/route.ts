import { prisma } from '@/lib/prisma';

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
    // Find all scheduled automations that are due to run
    // Only for PRO and ULTRA users
    const dueAutomations = await prisma.automation.findMany({
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
    });

    console.log(`[Cron] Found ${dueAutomations.length} automations due to run`);

    if (dueAutomations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, triggered: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine base URL for API calls
    const baseUrl = process.env.APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // Fan-out: trigger each automation in parallel (fire-and-forget)
    // Each automation runs in its own serverless function with its own 300s budget
    const triggerPromises = dueAutomations.map(async (automation) => {
      try {
        // Fire the request but don't wait for completion
        // Using a short timeout since we just need to trigger, not wait for result
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout to trigger

        await fetch(`${baseUrl}/api/automations/${automation.id}/run-cron`, {
          method: 'POST',
          headers: {
            'x-cron-secret': process.env.CRON_SECRET || '',
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }).catch(() => {
          // Ignore abort errors - the request was sent, that's what matters
        }).finally(() => {
          clearTimeout(timeoutId);
        });

        console.log(`[Cron] Triggered automation ${automation.id}`);
        return { automationId: automation.id, triggered: true };
      } catch (error) {
        // Log but don't fail - other automations should still run
        console.error(`[Cron] Failed to trigger automation ${automation.id}:`, error);
        return { automationId: automation.id, triggered: false };
      }
    });

    // Wait for all triggers to be sent (not for automations to complete)
    const results = await Promise.all(triggerPromises);

    const triggeredCount = results.filter((r) => r.triggered).length;
    console.log(`[Cron] Successfully triggered ${triggeredCount}/${dueAutomations.length} automations`);

    return new Response(
      JSON.stringify({
        success: true,
        triggered: triggeredCount,
        total: dueAutomations.length,
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
