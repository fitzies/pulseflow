import { currentUser } from '@clerk/nextjs/server';
import { prisma, getOrCreateDbUser } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dbUser = await getOrCreateDbUser(user.id);

  // Fetch scheduled executions (wasScheduled: true)
  const executions = await prisma.execution.findMany({
    where: {
      userId: dbUser.id,
      wasScheduled: true,
    },
    include: {
      automation: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });

  // Serialize dates for client
  const serializedExecutions = executions.map((execution) => ({
    id: execution.id,
    status: execution.status,
    error: execution.error,
    startedAt: execution.startedAt.toISOString(),
    finishedAt: execution.finishedAt?.toISOString() || null,
    automation: execution.automation,
  }));

  return new Response(JSON.stringify(serializedExecutions), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
