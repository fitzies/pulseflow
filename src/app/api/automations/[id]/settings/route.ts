import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: automationId } = await params;
    const body = await request.json();
    const { name, defaultSlippage, rpcEndpoint, showNodeLabels } = body;

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
        { error: 'User not found. Please contact support.' },
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
        { error: 'You don\'t have permission to update this automation.' },
        { status: 403 }
      );
    }

    // Check if user has PRO/ULTRA plan for RPC endpoint
    const isProUser = dbUser.plan === 'PRO' || dbUser.plan === 'ULTRA';
    
    // Build update data
    const updateData: any = {};
    
    if (name !== undefined) {
      updateData.name = name;
    }
    
    if (defaultSlippage !== undefined) {
      updateData.defaultSlippage = defaultSlippage;
    }
    
    if (showNodeLabels !== undefined) {
      updateData.showNodeLabels = showNodeLabels;
    }
    
    // Only allow RPC endpoint update if user is PRO/ULTRA
    if (rpcEndpoint !== undefined) {
      if (!isProUser) {
        return NextResponse.json(
          { error: 'RPC endpoint customization is only available for PRO and ULTRA plans.' },
          { status: 403 }
        );
      }
      updateData.rpcEndpoint = rpcEndpoint;
    }

    // Update automation
    await prisma.automation.update({
      where: { id: automationId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating automation settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update settings.' },
      { status: 500 }
    );
  }
}
