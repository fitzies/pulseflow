import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ExecutionType = 'Normal' | 'Scheduled' | 'Price Triggered';

function getExecutionType(
  triggerMode: 'MANUAL' | 'SCHEDULE' | 'PRICE_TRIGGER',
  wasScheduled: boolean
): ExecutionType {
  if (triggerMode === 'MANUAL' && !wasScheduled) {
    return 'Normal';
  }
  if (triggerMode === 'SCHEDULE' && wasScheduled) {
    return 'Scheduled';
  }
  if (triggerMode === 'PRICE_TRIGGER' && wasScheduled) {
    return 'Price Triggered';
  }
  // Fallback: if wasScheduled is true but triggerMode is MANUAL, treat as Normal
  // This handles edge cases
  return 'Normal';
}

export async function GET(request: Request) {
  const user = await currentUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
  });

  if (!dbUser) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get query params
  const { searchParams } = new URL(request.url);
  const automationId = searchParams.get('automationId');

  // Build where clause
  const whereClause: any = {
    userId: dbUser.id,
  };

  // Add automation filter if provided
  if (automationId) {
    whereClause.automationId = automationId;
  }

  // Fetch executions with automation triggerMode
  const executions = await prisma.execution.findMany({
    where: whereClause,
    include: {
      automation: {
        select: {
          id: true,
          name: true,
          triggerMode: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 1000, // Reasonable limit
  });

  // Serialize dates and add executionType
  const serializedExecutions = executions.map((execution) => ({
    id: execution.id,
    status: execution.status,
    error: execution.error,
    startedAt: execution.startedAt.toISOString(),
    finishedAt: execution.finishedAt?.toISOString() || null,
    automation: {
      id: execution.automation.id,
      name: execution.automation.name,
      triggerMode: execution.automation.triggerMode,
    },
    executionType: getExecutionType(
      execution.automation.triggerMode,
      execution.wasScheduled
    ),
  }));

  return new Response(JSON.stringify(serializedExecutions), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
