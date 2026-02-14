import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFINITION_PASSWORD = "44144";

export async function GET(request: Request) {
  const password =
    request.headers.get("x-password") ??
    new URL(request.url).searchParams.get("password");
  if (password !== DEFINITION_PASSWORD) {
    return NextResponse.json(
      { error: "Unauthorized. Invalid or missing password." },
      { status: 401 },
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  const serialized = users.map((u) => ({
    id: u.id,
    clerkId: u.clerkId,
    email: u.email,
    plan: u.plan,
    trialEndsAt: u.trialEndsAt?.toISOString() ?? null,
    stripeCustomerId: u.stripeCustomerId,
    stripeSubscriptionId: u.stripeSubscriptionId,
    stripePriceId: u.stripePriceId,
    telegramChatId: u.telegramChatId,
    telegramLinkedAt: u.telegramLinkedAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  return NextResponse.json({ users: serialized });
}
