import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma, getOrCreateDbUser } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const DEFINITION_PASSWORD = "44144";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: automationId } = await params;

    const password =
      request.headers.get("x-password") ??
      new URL(request.url).searchParams.get("password");
    if (password !== DEFINITION_PASSWORD) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid or missing password." },
        { status: 401 }
      );
    }

    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation not found." },
        { status: 404 }
      );
    }

    const executions = await prisma.execution.findMany({
      where: { automationId },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    const serializedExecutions = executions.map((e) => ({
      id: e.id,
      status: e.status,
      error: e.error,
      wasScheduled: e.wasScheduled,
      startedAt: e.startedAt.toISOString(),
      finishedAt: e.finishedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      definition: automation.definition,
      executions: serializedExecutions,
    });
  } catch (error) {
    console.error('Error fetching automation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch automation.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const dbUser = await getOrCreateDbUser(user.id);

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
        { error: 'You don\'t have permission to delete this automation.' },
        { status: 403 }
      );
    }

    // Delete the automation (cascade will handle executions and logs)
    await prisma.automation.delete({
      where: { id: automationId },
    });

    // Revalidate the automations page
    revalidatePath('/automations');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting automation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete automation.' },
      { status: 500 }
    );
  }
}
