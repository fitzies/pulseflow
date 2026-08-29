import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma, getOrCreateDbUser } from '@/lib/prisma';
import { disableScheduleAndCancelExecutions } from '@/lib/stop-scheduled-automation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: automationId } = await params;

    // Get authenticated user from Clerk
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Get or create user in database
    const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

    // Fetch automation and verify ownership
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation) {
      return NextResponse.json(
        { error: 'Automation not found.' },
        { status: 404 }
      );
    }

    if (automation.userId !== dbUser.id) {
      return NextResponse.json(
        { error: 'You don\'t have permission to stop this automation.' },
        { status: 403 }
      );
    }

    const stoppedAt = new Date();
    const result = await prisma.$transaction((tx) => {
      // Lock and disable the schedule before cancelling executions. The worker
      // uses the same automation row as its final claim, so one side wins the
      // race and a queued dispatch cannot start after this transaction commits.
      return disableScheduleAndCancelExecutions(
        tx,
        automationId,
        dbUser.id,
        stoppedAt
      );
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error stopping automation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop automation.' },
      { status: 500 }
    );
  }
}
