import { prisma } from '@/lib/prisma';
import { executeAutomationChain } from '@/lib/automation-runner';
import { getNextRunDate } from '@/lib/cron-utils.server';
import { findProNodesInDefinition, canUseProNodes } from '@/lib/plan-limits';
import type { Node, Edge } from '@xyflow/react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Each automation gets its own 5-minute budget

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: automationId } = await params;
  
  // Debug: Log that request reached our handler
  console.log(`[run-cron] Request received for automation ${automationId}`);

  // Verify the request is from our cron job
  // Check both custom header and Authorization header as fallback
  const cronSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  
  const isValidCustomHeader = cronSecret && cronSecret === expectedSecret;
  const isValidAuthHeader = authHeader && authHeader === `Bearer ${expectedSecret}`;
  
  if (!isValidCustomHeader && !isValidAuthHeader) {
    console.error(`[run-cron] Auth failed for ${automationId}:`, {
      hasCustomHeader: !!cronSecret,
      hasAuthHeader: !!authHeader,
      hasEnvSecret: !!expectedSecret,
      customHeaderLength: cronSecret?.length,
      envSecretLength: expectedSecret?.length,
    });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date();

  try {
    // Fetch automation with user info
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
      include: {
        user: {
          select: {
            id: true,
            plan: true,
          },
        },
      },
    });

    if (!automation) {
      return new Response(JSON.stringify({ error: 'Automation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse the automation definition
    const definition = automation.definition as { nodes?: Node[]; edges?: Edge[] } | null;
    const nodes = definition?.nodes || [];
    const edges = definition?.edges || [];

    if (nodes.length === 0) {
      console.log(`[Cron] Skipping automation ${automationId}: no nodes`);
      return new Response(
        JSON.stringify({ success: false, error: 'No nodes' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check for PRO-only nodes that the user's plan doesn't support
    if (!canUseProNodes(automation.user.plan)) {
      const proNodes = findProNodesInDefinition(nodes);
      if (proNodes.length > 0) {
        const nodeNames = proNodes.map((n) => n.label).join(', ');
        console.log(`[Cron] Skipping automation ${automationId}: contains Pro nodes (${nodeNames}) but user has ${automation.user.plan} plan`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `This automation contains Pro nodes: ${nodeNames}. Upgrade to Pro to run this automation.`,
            proNodes: proNodes.map((n) => n.type),
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create execution record
    const execution = await prisma.execution.create({
      data: {
        userId: automation.user.id,
        automationId: automation.id,
        status: 'RUNNING',
        wasScheduled: true,
      },
    });

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

    try {
      // Execute the automation
      const { results: nodeResults } = await executeAutomationChain(
        automationId,
        nodes,
        edges
      );

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
          where: { id: automationId },
          data: {
            lastRunAt: now,
            nextRunAt: nextRun,
          },
        });
      }

      console.log(`[Cron] Automation ${automationId} completed successfully`);
      return new Response(
        JSON.stringify({ success: true, executionId: execution.id }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
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
          where: { id: automationId },
          data: {
            lastRunAt: now,
            nextRunAt: nextRun,
          },
        });
      }

      console.error(`[Cron] Automation ${automationId} failed:`, errorMessage);
      return new Response(
        JSON.stringify({ success: false, error: errorMessage, executionId: execution.id }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Cron] Error processing automation ${automationId}:`, errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
