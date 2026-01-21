import { prisma } from '@/lib/prisma';
import { executeAutomationChain } from '@/lib/automation-runner';
import { getNextRunDate } from '@/lib/cron-utils.server';
import type { Node, Edge } from '@xyflow/react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for Pro plan

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
  const results: Array<{ automationId: string; success: boolean; error?: string }> = [];

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
      include: {
        user: {
          select: {
            id: true,
            plan: true,
          },
        },
      },
    });

    console.log(`[Cron] Found ${dueAutomations.length} automations due to run`);

    // Execute each automation
    for (const automation of dueAutomations) {
      try {
        // Parse the automation definition
        const definition = automation.definition as { nodes?: Node[]; edges?: Edge[] } | null;
        const nodes = definition?.nodes || [];
        const edges = definition?.edges || [];

        if (nodes.length === 0) {
          console.log(`[Cron] Skipping automation ${automation.id}: no nodes`);
          results.push({ automationId: automation.id, success: false, error: 'No nodes' });
          continue;
        }

        // Create execution record
        const execution = await prisma.execution.create({
          data: {
            userId: automation.user.id,
            automationId: automation.id,
            status: 'RUNNING',
          },
        });

        try {
          // Execute the automation
          const { results: nodeResults } = await executeAutomationChain(
            automation.id,
            nodes,
            edges
          );

          // Helper to serialize results
          const serializeResult = (result: any): any => {
            if (!result) return null;
            if (result.hash && result.blockNumber !== undefined) {
              return {
                hash: result.hash,
                blockHash: result.blockHash,
                blockNumber: result.blockNumber?.toString(),
                transactionIndex: result.transactionIndex,
                from: result.from,
                to: result.to,
                gasUsed: result.gasUsed?.toString(),
                status: result.status,
              };
            }
            return JSON.parse(
              JSON.stringify(result, (_, v) =>
                typeof v === 'bigint' ? v.toString() : v === undefined ? null : v
              )
            );
          };

          // Log each node result
          for (const nodeResult of nodeResults) {
            const node = nodes.find((n) => n.id === nodeResult.nodeId);
            await prisma.executionLog.create({
              data: {
                executionId: execution.id,
                nodeId: nodeResult.nodeId,
                nodeType: node?.type || 'unknown',
                input: node?.data?.config ?? undefined,
                output: serializeResult(nodeResult.result),
              },
            });
          }

          // Update execution status to SUCCESS
          await prisma.execution.update({
            where: { id: execution.id },
            data: {
              status: 'SUCCESS',
              finishedAt: new Date(),
            },
          });

          // Calculate and update next run time
          if (automation.cronExpression) {
            const nextRun = await getNextRunDate(automation.cronExpression);
            await prisma.automation.update({
              where: { id: automation.id },
              data: {
                lastRunAt: now,
                nextRunAt: nextRun,
              },
            });
          }

          console.log(`[Cron] Automation ${automation.id} completed successfully`);
          results.push({ automationId: automation.id, success: true });
        } catch (executionError) {
          const errorMessage = executionError instanceof Error
            ? executionError.message
            : 'Unknown execution error';

          // Update execution status to FAILED
          await prisma.execution.update({
            where: { id: execution.id },
            data: {
              status: 'FAILED',
              error: errorMessage,
              finishedAt: new Date(),
            },
          });

          // Still update next run time even if execution failed
          if (automation.cronExpression) {
            const nextRun = await getNextRunDate(automation.cronExpression);
            await prisma.automation.update({
              where: { id: automation.id },
              data: {
                lastRunAt: now,
                nextRunAt: nextRun,
              },
            });
          }

          console.error(`[Cron] Automation ${automation.id} failed:`, errorMessage);
          results.push({ automationId: automation.id, success: false, error: errorMessage });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Cron] Error processing automation ${automation.id}:`, errorMessage);
        results.push({ automationId: automation.id, success: false, error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: dueAutomations.length,
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
