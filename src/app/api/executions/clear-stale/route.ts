import { currentUser } from '@clerk/nextjs/server';
import { prisma, getOrCreateDbUser } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await currentUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 10 * 60 * 1000);

  // Clear stale executions for this user
  const result = await prisma.execution.updateMany({
    where: {
      userId: dbUser.id,
      status: 'RUNNING',
      startedAt: { lt: staleThreshold },
    },
    data: {
      status: 'FAILED',
      error: 'Execution timed out',
      finishedAt: now,
    },
  });

  return new Response(
    JSON.stringify({ success: true, cleared: result.count }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
