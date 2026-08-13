import type { Plan, Prisma, TriggerMode } from "@prisma/client";
import type { Node } from "@xyflow/react";
import { prisma } from "@/lib/prisma";
import {
  FREE_DAILY_RUN_LIMIT,
  canUseProNodes,
  findDisallowedFreeNodes,
  findProNodesInDefinition,
} from "@/lib/plan-limits";

export type ManualRunErrorCode =
  | "NO_PLAN"
  | "AUTOMATION_LOCKED"
  | "AUTOMATED_TRIGGER"
  | "PAID_FEATURE"
  | "RUN_LIMIT"
  | "ALREADY_RUNNING";

export class ManualRunError extends Error {
  constructor(
    message: string,
    public readonly code: ManualRunErrorCode,
    public readonly status: number,
    public readonly details?: { used?: number; limit?: number; resetAt?: string }
  ) {
    super(message);
    this.name = "ManualRunError";
  }
}

export function utcDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function nextUtcReset(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function validateManualRunCapabilities(
  plan: Plan | null,
  triggerMode: TriggerMode,
  nodes: Pick<Node, "type">[]
): void {
  if (!plan) {
    throw new ManualRunError("Choose a plan before running automations.", "NO_PLAN", 403);
  }

  if (plan === "FREE" && triggerMode !== "MANUAL") {
    throw new ManualRunError(
      "Free automations can only be triggered manually. Switch this automation to Manual or upgrade to Pro.",
      "AUTOMATED_TRIGGER",
      403
    );
  }

  if (plan === "FREE") {
    const disallowed = findDisallowedFreeNodes(nodes);
    if (disallowed.length > 0) {
      throw new ManualRunError(
        `This automation contains paid nodes: ${disallowed.map((node) => node.label).join(", ")}. Upgrade to Pro to run it.`,
        "PAID_FEATURE",
        403
      );
    }
  } else if (!canUseProNodes(plan)) {
    const proNodes = findProNodesInDefinition(nodes);
    if (proNodes.length > 0) {
      throw new ManualRunError(
        `This automation contains Pro nodes: ${proNodes.map((node) => node.label).join(", ")}. Upgrade to Pro to run it.`,
        "PAID_FEATURE",
        403
      );
    }
  }

  if (!canUseProNodes(plan)) {
    const hasAutoRoute = nodes.some(
      (node) => (node as Node<{ config?: { autoRoute?: boolean } }>).data?.config?.autoRoute === true
    );
    if (hasAutoRoute) {
      throw new ManualRunError(
        "Auto Route is a Pro feature. Upgrade to Pro to run automations with auto routing.",
        "PAID_FEATURE",
        403
      );
    }
  }
}

async function resolveFreeAutomationId(
  tx: Prisma.TransactionClient,
  userId: string,
  currentSelection: string | null
): Promise<string | null> {
  if (currentSelection) return currentSelection;

  const firstAutomation = await tx.automation.findFirst({
    where: { userId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  if (firstAutomation) {
    await tx.user.update({
      where: { id: userId },
      data: { freeAutomationId: firstAutomation.id },
    });
  }

  return firstAutomation?.id ?? null;
}

export async function createManualExecution(input: {
  userId: string;
  automationId: string;
  triggerMode: TriggerMode;
  nodes: Node[];
}) {
  const now = new Date();
  const utcDate = utcDateKey(now);
  const resetAt = nextUtcReset(now).toISOString();

  return prisma.$transaction(async (tx) => {
    // Serialize starts per user so quota, selection, and running checks cannot
    // be bypassed with concurrent requests.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId})::bigint)`;

    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { plan: true, freeAutomationId: true },
    });

    if (!user) {
      throw new ManualRunError("User not found.", "NO_PLAN", 403);
    }

    validateManualRunCapabilities(user.plan, input.triggerMode, input.nodes);

    if (user.plan === "FREE") {
      const selectedAutomationId = await resolveFreeAutomationId(
        tx,
        input.userId,
        user.freeAutomationId
      );
      if (selectedAutomationId !== input.automationId) {
        throw new ManualRunError(
          "This automation is locked on the Free plan. Select it as your Free automation or upgrade to Pro.",
          "AUTOMATION_LOCKED",
          403
        );
      }
    }

    if (user.plan === "FREE") {
      const runningExecution = await tx.execution.findFirst({
        where: { userId: input.userId, status: "RUNNING" },
        select: { id: true },
      });
      if (runningExecution) {
        throw new ManualRunError(
          "Another automation is already running. Wait for it to finish before starting a new run.",
          "ALREADY_RUNNING",
          409
        );
      }
    }

    let usage: { runCount: number } | null = null;
    if (user.plan === "FREE") {
      usage = await tx.dailyRunUsage.upsert({
        where: { userId_utcDate: { userId: input.userId, utcDate } },
        create: { userId: input.userId, utcDate, runCount: 1 },
        update: { runCount: { increment: 1 } },
        select: { runCount: true },
      });

      if (usage.runCount > FREE_DAILY_RUN_LIMIT) {
        throw new ManualRunError(
          `You've used all ${FREE_DAILY_RUN_LIMIT} Free runs for today. Upgrade to Pro for unlimited runs.`,
          "RUN_LIMIT",
          429,
          { used: FREE_DAILY_RUN_LIMIT, limit: FREE_DAILY_RUN_LIMIT, resetAt }
        );
      }
    }

    const execution = await tx.execution.create({
      data: {
        userId: input.userId,
        automationId: input.automationId,
        status: "RUNNING",
        wasScheduled: false,
      },
    });

    return {
      execution,
      usage: user.plan === "FREE"
        ? { used: usage?.runCount ?? 0, limit: FREE_DAILY_RUN_LIMIT, resetAt }
        : null,
    };
  });
}

export async function getManualRunUsage(userId: string, plan: Plan | null) {
  if (plan !== "FREE") return null;

  const now = new Date();
  const usage = await prisma.dailyRunUsage.findUnique({
    where: { userId_utcDate: { userId, utcDate: utcDateKey(now) } },
    select: { runCount: true },
  });

  return {
    used: Math.min(usage?.runCount ?? 0, FREE_DAILY_RUN_LIMIT),
    limit: FREE_DAILY_RUN_LIMIT,
    resetAt: nextUtcReset(now).toISOString(),
  };
}
