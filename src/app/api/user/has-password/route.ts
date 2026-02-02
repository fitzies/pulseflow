import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ hasPassword: user.passwordEnabled });
  } catch (error) {
    console.error('Error checking password status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check password status.' },
      { status: 500 }
    );
  }
}
