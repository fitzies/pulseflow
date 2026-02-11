import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma, getOrCreateDbUser } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

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
