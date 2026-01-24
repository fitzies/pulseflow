import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 }
      );
    }

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

    // Find the active (RUNNING) execution for this automation
    const activeExecution = await prisma.execution.findFirst({
      where: {
        automationId,
        status: 'RUNNING',
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (!activeExecution) {
      return NextResponse.json(
        { error: 'No running execution found for this automation.' },
        { status: 404 }
      );
    }

    // Mark the execution as CANCELLED
    const cancelledExecution = await prisma.execution.update({
      where: { id: activeExecution.id },
      data: {
        status: 'CANCELLED',
        error: 'Cancelled by user',
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      executionId: cancelledExecution.id,
    });
  } catch (error) {
    console.error('Error stopping automation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop automation.' },
      { status: 500 }
    );
  }
}
