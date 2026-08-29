import express from "express";
import webpush from "web-push";
import type { Node, Edge } from "@xyflow/react";
import { prisma } from "../src/lib/prisma";
import { executeAutomationChain } from "../src/lib/automation-runner";
import { findProNodesInDefinition, canUseProNodes, canUseAutomatedTriggers } from "../src/lib/plan-limits";
import {
  getAutomatedTriggerStateWhere,
  isAutomatedTriggerEnabled,
  type AutomatedTriggerType,
} from "../src/lib/automated-trigger-state";

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
    type: AutomatedTriggerType;
  };

  if (!automationId || (type !== "scheduled" && type !== "price_trigger")) {
    res.status(400).json({ error: "automationId and a valid trigger type are required" });
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
  type: AutomatedTriggerType
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

    if (!canUseAutomatedTriggers(automation.user.plan)) {
      console.log(`[Worker] Skipping ${automationId}: automated runs require Pro or Ultra`);
      return;
    }

    if (!isAutomatedTriggerEnabled(automation, type)) {
      console.log(`[Worker] Skipping ${automationId}: ${type} trigger is no longer enabled`);
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

    const execution = await prisma.$transaction(async (tx) => {
      // This write locks the automation row and checks its trigger state in the
      // same transaction that creates the execution. A concurrent Stop either
      // disables the trigger first, or waits and then cancels this execution.
      const claim = await tx.automation.updateMany({
        where: {
          id: automation.id,
          ...getAutomatedTriggerStateWhere(type),
          executions: {
            none: {
              status: "RUNNING",
            },
          },
          user: {
            plan: {
              in: ["PRO", "ULTRA"],
            },
          },
        },
        data: {
          lastRunAt: now,
        },
      });

      if (claim.count !== 1) {
        return null;
      }

      return tx.execution.create({
        data: {
          userId: automation.user.id,
          automationId: automation.id,
          status: "RUNNING",
          wasScheduled: true,
        },
      });
    });

    if (!execution) {
      console.log(`[Worker] Skipping ${automationId}: trigger was disabled or an execution is already running`);
      return;
    }

    try {
      await executeAutomationChain(
        automationId,
        nodes,
        edges,
        undefined,
        undefined,
        execution.id
      );

      const completedExecution = await prisma.execution.updateMany({
        where: {
          id: execution.id,
          status: "RUNNING",
        },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
        },
      });

      if (completedExecution.count !== 1) {
        const currentExecution = await prisma.execution.findUnique({
          where: { id: execution.id },
          select: { status: true },
        });

        if (currentExecution?.status === "CANCELLED") {
          await sendExecutionNotification(
            automation.user.id,
            automation.name,
            "CANCELLED",
            execution.id
          );
          console.log(`[Worker] Automation ${automationId} was cancelled`);
          return;
        }

        throw new Error(`Execution ${execution.id} left RUNNING state before completion`);
      }

      await prisma.automation.updateMany({
        where: {
          id: automationId,
          ...getAutomatedTriggerStateWhere(type),
        },
        data: { lastRunAt: new Date() },
      });

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

      const failedExecution = await prisma.execution.updateMany({
        where: {
          id: execution.id,
          status: "RUNNING",
        },
        data: {
          status: "FAILED",
          error: errorMessage,
          finishedAt: new Date(),
        },
      });
      const currentExecution = failedExecution.count === 0
        ? await prisma.execution.findUnique({
            where: { id: execution.id },
            select: { status: true },
          })
        : null;
      const isCancelled = currentExecution?.status === "CANCELLED";

      await prisma.automation.updateMany({
        where: {
          id: automationId,
          ...getAutomatedTriggerStateWhere(type),
        },
        data: { lastRunAt: new Date() },
      });

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
