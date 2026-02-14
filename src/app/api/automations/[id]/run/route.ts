import { currentUser } from '@clerk/nextjs/server';
import { prisma, getOrCreateDbUser } from '@/lib/prisma';
import { executeAutomationChain, type ProgressEvent } from '@/lib/automation-runner';
import { findProNodesInDefinition, canUseProNodes } from '@/lib/plan-limits';
import { sendExecutionNotification } from '@/lib/push-notification';
import { serializeForJson } from '@/lib/serialization';
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

  // Get or create user in database
  const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

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

  // Check for PRO-only nodes that the user's plan doesn't support
  if (!canUseProNodes(dbUser.plan)) {
    const proNodes = findProNodesInDefinition(nodes);
    if (proNodes.length > 0) {
      const nodeNames = proNodes.map((n) => n.label).join(', ');
      return new Response(
        JSON.stringify({
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
      const serializeResult = (result: any): any => serializeForJson(result);

      try {
        // Execute with progress callback
        await executeAutomationChain(
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
          },
          execution.id
        );

        // Update execution status to SUCCESS
        await prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: 'SUCCESS',
            finishedAt: new Date(),
          },
        });

        // Send push notification
        await sendExecutionNotification(dbUser.id, automation.name, 'SUCCESS', execution.id);

        // Send completion event
        sendEvent({
          type: 'done',
          success: true,
          executionId: execution.id,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown execution error';
        
        const isCancelled = errorMessage === 'Execution cancelled by user';

        // Update execution status (don't overwrite if already cancelled)
        if (!isCancelled) {
          await prisma.execution.update({
            where: { id: execution.id },
            data: {
              status: 'FAILED',
              error: errorMessage,
              finishedAt: new Date(),
            },
          });
        }

        // Send push notification
        await sendExecutionNotification(
          dbUser.id,
          automation.name,
          isCancelled ? 'CANCELLED' : 'FAILED',
          execution.id
        );

        // Send error completion event
        sendEvent({
          type: 'done',
          success: false,
          error: errorMessage,
          executionId: execution.id,
          cancelled: isCancelled,
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
