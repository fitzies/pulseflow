import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { executeAutomationChain, type ProgressEvent } from '@/lib/automation-runner';
import type { Node, Edge } from '@xyflow/react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: automationId } = await params;

  // Get authenticated user from Clerk
  const user = await currentUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get user from database
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
  });

  if (!dbUser) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch automation and verify ownership
  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
  });

  if (!automation) {
    return new Response(JSON.stringify({ error: 'Automation not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (automation.userId !== dbUser.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse the automation definition
  const definition = automation.definition as { nodes?: Node[]; edges?: Edge[] } | null;
  const nodes = definition?.nodes || [];
  const edges = definition?.edges || [];

  if (nodes.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Automation has no nodes to execute' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create execution record
  const execution = await prisma.execution.create({
    data: {
      userId: dbUser.id,
      automationId: automation.id,
      status: 'RUNNING',
      wasScheduled: false,
    },
  });

  // Create a stream for SSE
  const encoder = new TextEncoder();
  let isControllerClosed = false;
  const stream = new ReadableStream({
    async start(controller) {
      // Gracefully handle client disconnection - execution continues even if client closes
      const sendEvent = (event: Record<string, any>) => {
        if (isControllerClosed) return;
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Client disconnected - continue execution silently
          isControllerClosed = true;
        }
      };

      // Helper to serialize transaction receipts
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
        // Execute with progress callback
        const { results } = await executeAutomationChain(
          automationId,
          nodes,
          edges,
          undefined,
          (event: ProgressEvent) => {
            sendEvent({
              type: event.type,
              nodeId: event.nodeId,
              nodeType: event.nodeType,
              data: event.data ? serializeResult(event.data) : undefined,
              error: event.error,
            });
          }
        );

        // Log each node result
        for (const nodeResult of results) {
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

        // Send completion event
        sendEvent({
          type: 'done',
          success: true,
          executionId: execution.id,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown execution error';

        // Update execution status to FAILED
        await prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            error: errorMessage,
            finishedAt: new Date(),
          },
        });

        // Send error completion event
        sendEvent({
          type: 'done',
          success: false,
          error: errorMessage,
          executionId: execution.id,
        });
      } finally {
        if (!isControllerClosed) {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
