import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { TelegramConnectActions } from "./telegram-connect-actions";

export default async function ConnectTelegramPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
    select: {
      id: true,
      telegramChatId: true,
      telegramLinkedAt: true,
    },
  });

  if (!dbUser) {
    redirect("/auth/sign-in");
  }

  const isConnected = !!dbUser.telegramChatId;
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "YourBotName";

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-500/20 p-3">
              <MessageCircle className="h-6 w-6 text-sky-400" />
            </div>
            <div>
              <CardTitle>Connect Telegram</CardTitle>
              <CardDescription>
                Receive automation notifications via Telegram
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isConnected ? (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Telegram Connected</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Connected on {dbUser.telegramLinkedAt?.toLocaleDateString()}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-500">
                Telegram not connected yet. Follow the steps below to connect.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-medium">How to Connect</h3>
            
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="text-sm">Open Telegram and search for our bot:</p>
                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
                  >
                    @{botUsername}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="text-sm">Send this command to the bot:</p>
                  <TelegramConnectActions 
                    userId={dbUser.id} 
                    isConnected={isConnected}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  3
                </div>
                <p className="text-sm">
                  You&apos;ll receive a confirmation message. Refresh this page to see your connection status.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
