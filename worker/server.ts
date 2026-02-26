import express from "express";
import webpush from "web-push";
import { CronExpressionParser } from "cron-parser";
import type { Node, Edge } from "@xyflow/react";
import { prisma } from "../src/lib/prisma";
import { executeAutomationChain } from "../src/lib/automation-runner";
import { findProNodesInDefinition, canUseProNodes } from "../src/lib/plan-limits";

// Inlined from cron-utils.server.ts (avoids 'server-only' guard)
async function getNextRunDate(cronExpression: string, fromDate?: Date): Promise<Date | null> {
  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: fromDate || new Date(),
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

// Inlined from push-notification.ts (avoids @/ alias dependency at runtime)
webpush.setVapidDetails(
  "mailto:notifications@pulseflow.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

async function sendExecutionNotification(
  userId: string,
  automationName: string,
  status: "SUCCESS" | "FAILED" | "CANCELLED",
  executionId: string
) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const statusText =
    status === "SUCCESS" ? "completed successfully"
    : status === "CANCELLED" ? "was cancelled"
    : "encountered an error";

  const payload = JSON.stringify({
    title: `Automation ${status === "SUCCESS" ? "Completed" : status === "CANCELLED" ? "Cancelled" : "Failed"}`,
    body: `${automationName} ${statusText}`,
    url: `/automations?execution=${executionId}`,
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

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

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/run-automation", (req, res) => {
  const secret = req.headers["x-cron-secret"];
  if (!secret || secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { automationId, type } = req.body as {
    automationId: string;
    type: "scheduled" | "price_trigger";
  };

  if (!automationId) {
    res.status(400).json({ error: "automationId is required" });
    return;
  }

  // Acknowledge immediately — caller (run-scheduled) has a 10s abort timeout
  res.status(202).json({ accepted: true, automationId });

  // Execute asynchronously after response is sent
  runAutomation(automationId, type).catch((err) => {
    console.error(`[Worker] Unhandled error for automation ${automationId}:`, err);
  });
});

async function runAutomation(
  automationId: string,
  type: "scheduled" | "price_trigger"
) {
  const now = new Date();
  console.log(`[Worker] Starting automation ${automationId} (${type})`);

  try {
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
      include: {
        user: {
          select: {
            id: true,
            plan: true,
          },
        },
      },
    });

    if (!automation) {
      console.error(`[Worker] Automation ${automationId} not found`);
      return;
    }

    const definition = automation.definition as { nodes?: Node[]; edges?: Edge[] } | null;
    const nodes = definition?.nodes || [];
    const edges = definition?.edges || [];

    if (nodes.length === 0) {
      console.log(`[Worker] Skipping ${automationId}: no nodes`);
      return;
    }

    if (!canUseProNodes(automation.user.plan)) {
      const proNodes = findProNodesInDefinition(nodes);
      if (proNodes.length > 0) {
        const nodeNames = proNodes.map((n) => n.label).join(", ");
        console.log(`[Worker] Skipping ${automationId}: Pro nodes (${nodeNames}) but plan is ${automation.user.plan}`);
        return;
      }

      const hasAutoRoute = nodes.some(
        (n: Node) => (n.data as any)?.config?.autoRoute === true
      );
      if (hasAutoRoute) {
        console.log(`[Worker] Skipping ${automationId}: Auto Route requires Pro plan`);
        return;
      }
    }

    const execution = await prisma.execution.create({
      data: {
        userId: automation.user.id,
        automationId: automation.id,
        status: "RUNNING",
        wasScheduled: true,
      },
    });

    try {
      await executeAutomationChain(
        automationId,
        nodes,
        edges,
        undefined,
        undefined,
        execution.id
      );

      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
        },
      });

      if (automation.cronExpression) {
        const nextRun = await getNextRunDate(automation.cronExpression);
        await prisma.automation.update({
          where: { id: automationId },
          data: {
            lastRunAt: now,
            nextRunAt: nextRun,
          },
        });
      }

      await sendExecutionNotification(
        automation.user.id,
        automation.name,
        "SUCCESS",
        execution.id
      );

      console.log(`[Worker] Automation ${automationId} completed successfully`);
    } catch (executionError) {
      const errorMessage =
        executionError instanceof Error
          ? executionError.message
          : "Unknown execution error";

      const isCancelled = errorMessage === "Execution cancelled by user";

      if (!isCancelled) {
        await prisma.execution.update({
          where: { id: execution.id },
          data: {
            status: "FAILED",
            error: errorMessage,
            finishedAt: new Date(),
          },
        });
      }

      if (automation.cronExpression) {
        const nextRun = await getNextRunDate(automation.cronExpression);
        await prisma.automation.update({
          where: { id: automationId },
          data: {
            lastRunAt: now,
            nextRunAt: nextRun,
          },
        });
      }

      await sendExecutionNotification(
        automation.user.id,
        automation.name,
        isCancelled ? "CANCELLED" : "FAILED",
        execution.id
      );

      console.error(
        `[Worker] Automation ${automationId} ${isCancelled ? "cancelled" : "failed"}:`,
        errorMessage
      );
    }
  } catch (err) {
    console.error(`[Worker] Fatal error for automation ${automationId}:`, err);
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Worker] Listening on port ${PORT}`);
});
