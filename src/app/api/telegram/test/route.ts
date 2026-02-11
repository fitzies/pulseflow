import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { Bot } from 'grammy';
import { prisma, getOrCreateDbUser } from '@/lib/prisma';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

export async function POST() {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await getOrCreateDbUser(user.id);

    if (!dbUser.telegramChatId) {
      return NextResponse.json(
        { error: 'Telegram not connected. Please connect your Telegram first.' },
        { status: 400 }
      );
    }

    await bot.api.sendMessage(
      dbUser.telegramChatId,
      '🧪 This is a test message from PulseFlow!\n\n' +
      'Your Telegram connection is working correctly. ✅'
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Test message error:', error);
    return NextResponse.json(
      { error: 'Failed to send test message' },
      { status: 500 }
    );
  }
}
