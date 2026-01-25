import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Initialize VAPID details
webpush.setVapidDetails(
  "mailto:notifications@pulseflow.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendExecutionNotification(
  userId: string,
  automationName: string,
  status: "SUCCESS" | "FAILED" | "CANCELLED",
  executionId: string
) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return;

  const statusText =
    status === "SUCCESS"
      ? "completed successfully"
      : status === "CANCELLED"
        ? "was cancelled"
        : "encountered an error";

  const payload = JSON.stringify({
    title: `Automation ${status === "SUCCESS" ? "Completed" : status === "CANCELLED" ? "Cancelled" : "Failed"}`,
    body: `${automationName} ${statusText}`,
    url: `/automations?execution=${executionId}`,
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
    )
  );

  // Clean up invalid subscriptions (410 Gone means subscription expired)
  const invalidEndpoints: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const error = result.reason as { statusCode?: number };
      if (error.statusCode === 410 || error.statusCode === 404) {
        invalidEndpoints.push(subscriptions[index].endpoint);
      }
    }
  });

  if (invalidEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: invalidEndpoints } },
    });
  }
}
