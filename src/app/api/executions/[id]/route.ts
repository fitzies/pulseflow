import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: executionId } = await params;

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

  // Fetch execution with logs and verify ownership
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      automation: {
        select: {
          id: true,
          name: true,
        },
      },
      logs: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!execution) {
    return new Response(JSON.stringify({ error: 'Execution not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (execution.userId !== dbUser.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Serialize dates for client
  const serializedExecution = {
    ...execution,
    startedAt: execution.startedAt.toISOString(),
    finishedAt: execution.finishedAt?.toISOString() || null,
    logs: execution.logs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
  };

  return new Response(JSON.stringify(serializedExecution), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
