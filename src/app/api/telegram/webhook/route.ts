import { NextRequest, NextResponse } from 'next/server';
import { Bot } from 'grammy';
import { prisma } from '@/lib/prisma';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
  if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const update = await request.json();

    // Handle message updates
    if (update.message?.text) {
      const chatId = update.message.chat.id.toString();
      const text = update.message.text;

      // Handle /start command
      if (text === '/start') {
        await bot.api.sendMessage(
          chatId,
          '👋 Welcome to PulseFlow Bot!\n\n' +
          'To connect your account, send:\n' +
          '`/register YOUR_USER_ID`\n\n' +
          'You can find your User ID on the Connect Telegram page in PulseFlow.',
          { parse_mode: 'Markdown' }
        );
        return NextResponse.json({ ok: true });
      }

      // Handle /register command
      if (text.startsWith('/register ')) {
        const userId = text.replace('/register ', '').trim();

        if (!userId) {
          await bot.api.sendMessage(
            chatId,
            '❌ Please provide your User ID.\n\nUsage: `/register YOUR_USER_ID`',
            { parse_mode: 'Markdown' }
          );
          return NextResponse.json({ ok: true });
        }

        // Find user by ID
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          await bot.api.sendMessage(
            chatId,
            '❌ User not found. Please check your User ID and try again.'
          );
          return NextResponse.json({ ok: true });
        }

        // Update user with telegram chat ID
        await prisma.user.update({
          where: { id: userId },
          data: {
            telegramChatId: chatId,
            telegramLinkedAt: new Date(),
          },
        });

        await bot.api.sendMessage(
          chatId,
          '✅ Success! Your Telegram is now connected to PulseFlow.\n\n' +
          'You will receive notifications when your automations run.'
        );
        return NextResponse.json({ ok: true });
      }

      // Unknown command
      await bot.api.sendMessage(
        chatId,
        'I don\'t understand that command.\n\n' +
        'Available commands:\n' +
        '• `/start` - Get started\n' +
        '• `/register USER_ID` - Connect your account',
        { parse_mode: 'Markdown' }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Telegram sends GET requests to verify the webhook
export async function GET() {
  return NextResponse.json({ ok: true });
}
