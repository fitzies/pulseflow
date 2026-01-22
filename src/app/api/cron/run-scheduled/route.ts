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
    // Clean up stale executions (RUNNING for more than 10 minutes)
    const staleThreshold = new Date(now.getTime() - 10 * 60 * 1000);
    const staleCleanup = await prisma.execution.updateMany({
      where: {
        status: 'RUNNING',
        startedAt: { lt: staleThreshold },
      },
      data: {
        status: 'FAILED',
        error: 'Execution timed out',
        finishedAt: now,
      },
    });

    if (staleCleanup.count > 0) {
      console.log(`[Cron] Cleaned up ${staleCleanup.count} stale executions`);
    }

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
    const triggerPromises = dueAutomations.map(async (automation) => {
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
            return { automationId: automation.id, triggered: false, error: 'auth_failed' };
          }
          
          console.log(`[Cron] Triggered automation ${automation.id} (status: ${response.status})`);
          return { automationId: automation.id, triggered: true };
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          
          // AbortError means timeout - request was sent and is processing
          if (fetchError.name === 'AbortError') {
            console.log(`[Cron] Triggered automation ${automation.id} (processing)`);
            return { automationId: automation.id, triggered: true };
          }
          throw fetchError;
        }
      } catch (error) {
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
