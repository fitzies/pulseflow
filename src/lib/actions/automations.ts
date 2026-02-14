"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma, getOrCreateDbUser } from "@/lib/prisma";
import { generateWallet } from "@/lib/wallet-generation";
import { executeAutomationChain } from "@/lib/automation-runner";
import { getPlanLimit, canCreateAutomation, findProNodesInDefinition, canUseProNodes } from "@/lib/plan-limits";
import { validateMinimumInterval, getNextRunDate } from "@/lib/cron-utils.server";
import { serializeForJson } from "@/lib/serialization";
import type { Node, Edge } from "@xyflow/react";
import type { TriggerMode } from "@prisma/client";

export async function createAutomation(name: string, communityVisible: boolean = false) {
  try {
    // Get authenticated user from Clerk
    const user = await currentUser();

    if (!user) {
      return {
        success: false,
        error: "Unauthorized. Please sign in.",
      };
    }

    // Get or create user in database
    const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

    // Check if user has a plan
    if (dbUser.plan === null) {
      return {
        success: false,
        error: "You need to upgrade to a plan to create automations.",
      };
    }

    // Check automation limit
    const currentCount = await prisma.automation.count({
      where: { userId: dbUser.id },
    });

    const planLimit = getPlanLimit(dbUser.plan);
    
    if (!canCreateAutomation(currentCount, dbUser.plan)) {
      const limitMessage = planLimit === null 
        ? "You've reached your automation limit."
        : `You've reached your plan limit of ${planLimit} automation${planLimit !== 1 ? 's' : ''}. Upgrade to create more.`;
      
      return {
        success: false,
        error: limitMessage,
      };
    }

    // Generate wallet
    const { address, encryptedKey } = await generateWallet();

    // Create automation
    const automation = await prisma.automation.create({
      data: {
        name,
        userId: dbUser.id,
        walletAddress: address,
        walletEncKey: encryptedKey,
        definition: {},
        isActive: false,
        communityVisible,
      },
    });

    // Revalidate the automations page
    revalidatePath("/automations");

    return {
      success: true,
      automation,
    };
  } catch (error) {
    console.error("Error creating automation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create automation.",
    };
  }
}

export async function updateAutomationDefinition(
  automationId: string,
  nodes: unknown[],
  edges: unknown[]
) {
  try {
    // Get authenticated user from Clerk
    const user = await currentUser();

    if (!user) {
      return {
        success: false,
        error: "Unauthorized. Please sign in.",
      };
    }

    // Get or create user in database
    const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

    // Fetch automation and verify ownership
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation) {
      return {
        success: false,
        error: "Automation not found.",
      };
    }

    if (automation.userId !== dbUser.id) {
      return {
        success: false,
        error: "You don't have permission to update this automation.",
      };
    }

    // Update automation definition
    await prisma.automation.update({
      where: { id: automationId },
      data: {
        definition: {
          nodes,
          edges,
        } as any,
      },
    });

    // Revalidate the automation page
    revalidatePath(`/automations/${automationId}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error updating automation definition:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update automation definition.",
    };
  }
}

export async function runAutomation(automationId: string) {
  try {
    // Get authenticated user from Clerk
    const user = await currentUser();

    if (!user) {
      return {
        success: false,
        error: "Unauthorized. Please sign in.",
      };
    }

    // Get or create user in database
    const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

    // Fetch automation and verify ownership
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation) {
      return {
        success: false,
        error: "Automation not found.",
      };
    }

    if (automation.userId !== dbUser.id) {
      return {
        success: false,
        error: "You don't have permission to run this automation.",
      };
    }

    // Parse the automation definition
    const definition = automation.definition as { nodes?: Node[]; edges?: Edge[] } | null;
    const nodes = definition?.nodes || [];
    const edges = definition?.edges || [];

    if (nodes.length === 0) {
      return {
        success: false,
        error: "Automation has no nodes to execute.",
      };
    }

    // Check for PRO-only nodes that the user's plan doesn't support
    if (!canUseProNodes(dbUser.plan)) {
      const proNodes = findProNodesInDefinition(nodes);
      if (proNodes.length > 0) {
        const nodeNames = proNodes.map((n) => n.label).join(", ");
        return {
          success: false,
          error: `This automation contains Pro nodes: ${nodeNames}. Upgrade to Pro to run this automation.`,
          proNodes: proNodes.map((n) => n.type),
        };
      }
    }

    // Create execution record
    const execution = await prisma.execution.create({
      data: {
        userId: dbUser.id,
        automationId: automation.id,
        status: "RUNNING",
        wasScheduled: false,
      },
    });

    try {
      // Execute the automation chain
      const { results } = await executeAutomationChain(
        automationId,
        nodes,
        edges,
        undefined,
        undefined,
        execution.id
      );

      // Update execution status to SUCCESS
      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
        },
      });

      return {
        success: true,
        executionId: execution.id,
        results: results.map((r) => ({ ...r, result: serializeForJson(r.result) })),
      };
    } catch (executionError) {
      // Log the error and update execution status to FAILED
      const errorMessage = executionError instanceof Error
        ? executionError.message
        : "Unknown execution error";

      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: "FAILED",
          error: errorMessage,
          finishedAt: new Date(),
        },
      });

      return {
        success: false,
        error: errorMessage,
        executionId: execution.id,
      };
    }
  } catch (error) {
    console.error("Error running automation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to run automation.",
    };
  }
}

export async function updateAutomationSchedule(
  automationId: string,
  triggerMode: TriggerMode,
  cronExpression: string | null
) {
  try {
    // Get authenticated user from Clerk
    const user = await currentUser();

    if (!user) {
      return {
        success: false,
        error: "Unauthorized. Please sign in.",
      };
    }

    // Get or create user in database
    const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

    // Check if user has PRO or ULTRA plan for scheduling
    if (triggerMode === "SCHEDULE" && dbUser.plan !== "PRO" && dbUser.plan !== "ULTRA") {
      return {
        success: false,
        error: "Scheduling is a Pro feature. Please upgrade your plan.",
      };
    }

    // Fetch automation and verify ownership
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation) {
      return {
        success: false,
        error: "Automation not found.",
      };
    }

    if (automation.userId !== dbUser.id) {
      return {
        success: false,
        error: "You don't have permission to update this automation.",
      };
    }

    // Validate cron expression if scheduling
    let nextRunAt: Date | null = null;
    if (triggerMode === "SCHEDULE" && cronExpression) {
      const validation = await validateMinimumInterval(cronExpression);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || "Invalid cron expression.",
        };
      }
      nextRunAt = await getNextRunDate(cronExpression);
    }

    // Update automation schedule
    await prisma.automation.update({
      where: { id: automationId },
      data: {
        triggerMode,
        cronExpression: triggerMode === "SCHEDULE" ? cronExpression : null,
        nextRunAt: triggerMode === "SCHEDULE" ? nextRunAt : null,
      },
    });

    // Revalidate the automation page
    revalidatePath(`/automations/${automationId}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error updating automation schedule:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update schedule.",
    };
  }
}

export async function updateAutomationPriceTrigger(
  automationId: string,
  lpAddress: string,
  operator: string,
  value: number,
  cooldownMinutes: number
) {
  try {
    // Get authenticated user from Clerk
    const user = await currentUser();

    if (!user) {
      return {
        success: false,
        error: "Unauthorized. Please sign in.",
      };
    }

    // Get or create user in database
    const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

    // Check if user has PRO or ULTRA plan for price triggers
    if (dbUser.plan !== "PRO" && dbUser.plan !== "ULTRA") {
      return {
        success: false,
        error: "Price triggers are a Pro feature. Please upgrade your plan.",
      };
    }

    // Fetch automation and verify ownership
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation) {
      return {
        success: false,
        error: "Automation not found.",
      };
    }

    if (automation.userId !== dbUser.id) {
      return {
        success: false,
        error: "You don't have permission to update this automation.",
      };
    }

    // Validate inputs
    if (!/^0x[a-fA-F0-9]{40}$/.test(lpAddress)) {
      return {
        success: false,
        error: "Invalid LP address format.",
      };
    }

    if (!['<', '>', '<=', '>=', '=='].includes(operator)) {
      return {
        success: false,
        error: "Invalid operator.",
      };
    }

    if (value <= 0) {
      return {
        success: false,
        error: "Price value must be positive.",
      };
    }

    // Validate that LP address contains WPLS
    const { validateLPHasWPLS } = await import("@/lib/blockchain-functions");
    const lpValidation = await validateLPHasWPLS(lpAddress);
    
    if (!lpValidation.isValid) {
      return {
        success: false,
        error: lpValidation.error || "Invalid LP address.",
      };
    }

    if (cooldownMinutes < 1 || cooldownMinutes > 1440) {
      return {
        success: false,
        error: "Cooldown must be between 1 and 1440 minutes.",
      };
    }

    // Update automation with price trigger settings
    await prisma.automation.update({
      where: { id: automationId },
      data: {
        triggerMode: "PRICE_TRIGGER",
        cronExpression: null,
        nextRunAt: null,
        priceTriggerLpAddress: lpAddress,
        priceTriggerOperator: operator,
        priceTriggerValue: value,
        priceTriggerCooldownMinutes: cooldownMinutes,
        // Don't reset lastTriggeredAt - preserve existing cooldown state
      },
    });

    // Revalidate the automation page
    revalidatePath(`/automations/${automationId}`);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error updating automation price trigger:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update price trigger.",
    };
  }
}

export async function duplicateAutomation(sourceAutomationId: string, newName: string, communityVisible: boolean = false) {
  try {
    const user = await currentUser();

    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

    if (dbUser.plan === null) {
      return { success: false, error: "You need to upgrade to a plan to create automations." };
    }

    // Check automation limit
    const currentCount = await prisma.automation.count({
      where: { userId: dbUser.id },
    });

    const planLimit = getPlanLimit(dbUser.plan);

    if (!canCreateAutomation(currentCount, dbUser.plan)) {
      const limitMessage = planLimit === null
        ? "You've reached your automation limit."
        : `You've reached your plan limit of ${planLimit} automation${planLimit !== 1 ? "s" : ""}. Upgrade to create more.`;
      return { success: false, error: limitMessage };
    }

    // Fetch source automation and verify ownership
    const sourceAutomation = await prisma.automation.findUnique({
      where: { id: sourceAutomationId },
    });

    if (!sourceAutomation) {
      return { success: false, error: "Source automation not found." };
    }

    if (sourceAutomation.userId !== dbUser.id) {
      return { success: false, error: "You don't have permission to duplicate this automation." };
    }

    // Generate new wallet
    const { address, encryptedKey } = await generateWallet();

    // Create duplicated automation
    const automation = await prisma.automation.create({
      data: {
        name: newName,
        userId: dbUser.id,
        walletAddress: address,
        walletEncKey: encryptedKey,
        definition: sourceAutomation.definition ?? {},
        isActive: false,
        defaultSlippage: sourceAutomation.defaultSlippage,
        rpcEndpoint: sourceAutomation.rpcEndpoint,
        showNodeLabels: sourceAutomation.showNodeLabels,
        communityVisible,
      },
    });

    revalidatePath("/automations");

    return { success: true, automation };
  } catch (error) {
    console.error("Error duplicating automation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to duplicate automation.",
    };
  }
}

export async function createShareCode(definition: unknown) {
  const {
    generateShareCode,
    createShareString,
    getShareExpiryDate,
  } = await import("@/lib/automation-share");

  try {
    const user = await currentUser();

    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    // Generate unique share code
    let shareCode: string;
    let attempts = 0;
    const maxAttempts = 5;

    do {
      shareCode = generateShareCode();
      const existing = await prisma.sharedAutomation.findUnique({
        where: { shareCode },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return { success: false, error: "Failed to generate unique share code. Please try again." };
    }

    // Create shared automation record
    await prisma.sharedAutomation.create({
      data: {
        shareCode,
        definition: definition as any,
        expiresAt: getShareExpiryDate(),
      },
    });

    return {
      success: true,
      shareString: createShareString(shareCode),
    };
  } catch (error) {
    console.error("Error creating share code:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create share code.",
    };
  }
}

export async function createAutomationFromShare(shareString: string, name: string, communityVisible: boolean = false) {
  const { extractShareCode } = await import("@/lib/automation-share");

  try {
    const user = await currentUser();

    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

    if (dbUser.plan === null) {
      return { success: false, error: "You need to upgrade to a plan to create automations." };
    }

    // Check automation limit
    const currentCount = await prisma.automation.count({
      where: { userId: dbUser.id },
    });

    const planLimit = getPlanLimit(dbUser.plan);

    if (!canCreateAutomation(currentCount, dbUser.plan)) {
      const limitMessage = planLimit === null
        ? "You've reached your automation limit."
        : `You've reached your plan limit of ${planLimit} automation${planLimit !== 1 ? "s" : ""}. Upgrade to create more.`;
      return { success: false, error: limitMessage };
    }

    // Extract share code from string
    const shareCode = extractShareCode(shareString);

    if (!shareCode) {
      return { success: false, error: "Invalid share code format. Please check and try again." };
    }

    // Look up shared automation in database
    const sharedAutomation = await prisma.sharedAutomation.findUnique({
      where: { shareCode },
    });

    if (!sharedAutomation) {
      return { success: false, error: "Share code not found. It may have expired or been deleted." };
    }

    // Check if expired
    if (new Date() > sharedAutomation.expiresAt) {
      // Clean up expired record
      await prisma.sharedAutomation.delete({ where: { shareCode } });
      return { success: false, error: "This share code has expired." };
    }

    const definition = sharedAutomation.definition as { nodes?: unknown[]; edges?: unknown[] };

    // Generate wallet
    const { address, encryptedKey } = await generateWallet();

    // Create automation from shared definition
    const automation = await prisma.automation.create({
      data: {
        name,
        userId: dbUser.id,
        walletAddress: address,
        walletEncKey: encryptedKey,
        definition: {
          nodes: definition?.nodes || [],
          edges: definition?.edges || [],
        } as any,
        isActive: false,
        communityVisible,
      },
    });

    revalidatePath("/automations");

    return { success: true, automation };
  } catch (error) {
    console.error("Error creating automation from share:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create automation from share.",
    };
  }
}

export async function renameAutomation(automationId: string, newName: string) {
  try {
    const user = await currentUser();

    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    });

    if (!automation) {
      return { success: false, error: "Automation not found." };
    }

    if (automation.userId !== dbUser.id) {
      return { success: false, error: "You don't have permission to rename this automation." };
    }

    await prisma.automation.update({
      where: { id: automationId },
      data: { name: newName },
    });

    revalidatePath("/automations");
    revalidatePath(`/automations/${automationId}`);

    return { success: true };
  } catch (error) {
    console.error("Error renaming automation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rename automation.",
    };
  }
}
