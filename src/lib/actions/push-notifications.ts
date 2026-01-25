"use server";

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

webpush.setVapidDetails(
  "mailto:notifications@pulseflow.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function subscribeUser(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.id } });
  if (!dbUser) throw new Error("User not found");

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    create: {
      userId: dbUser.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });

  return { success: true };
}

export async function unsubscribeUser(endpoint: string) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.id } });
  if (!dbUser) throw new Error("User not found");

  await prisma.pushSubscription.deleteMany({
    where: {
      userId: dbUser.id,
      endpoint,
    },
  });

  return { success: true };
}

export async function getSubscriptionStatus() {
  const user = await currentUser();
  if (!user) return { subscribed: false };

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.id } });
  if (!dbUser) return { subscribed: false };

  const count = await prisma.pushSubscription.count({
    where: { userId: dbUser.id },
  });

  return { subscribed: count > 0 };
}
