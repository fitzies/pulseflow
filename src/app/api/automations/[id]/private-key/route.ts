import { currentUser, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma, getOrCreateDbUser } from '@/lib/prisma';
import { decryptPrivateKey } from '@/lib/wallet-generation';

// Helper to verify automation ownership
async function verifyAutomationOwnership(automationId: string, clerkUserId: string) {
  const dbUser = await getOrCreateDbUser(clerkUserId);

  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
  });

  if (!automation) {
    return { error: 'Automation not found.', status: 404 };
  }

  if (automation.userId !== dbUser.id) {
    return { error: "You don't have permission to access this automation.", status: 403 };
  }

  return { automation, dbUser };
}

export async function GET(
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

    // Verify ownership
    const result = await verifyAutomationOwnership(automationId, user.id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Check if user has password enabled
    if (user.passwordEnabled) {
      return NextResponse.json({ requiresPassword: true });
    }

    // No password set - return private key directly
    const privateKey = decryptPrivateKey(result.automation.walletEncKey);
    return NextResponse.json({ privateKey });
  } catch (error) {
    console.error('Error getting private key:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get private key.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: automationId } = await params;
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required.' },
        { status: 400 }
      );
    }
    
    // Get authenticated user from Clerk
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Verify ownership
    const result = await verifyAutomationOwnership(automationId, user.id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Verify password with Clerk
    try {
      const client = await clerkClient();
      await client.users.verifyPassword({
        userId: user.id,
        password,
      });
    } catch {
      return NextResponse.json(
        { error: 'Invalid password.' },
        { status: 401 }
      );
    }

    // Password verified - return private key
    const privateKey = decryptPrivateKey(result.automation.walletEncKey);
    return NextResponse.json({ privateKey });
  } catch (error) {
    console.error('Error verifying password for private key:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify password.' },
      { status: 500 }
    );
  }
}
