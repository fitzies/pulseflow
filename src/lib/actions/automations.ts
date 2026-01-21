"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateWallet } from "@/lib/wallet-generation";
import { executeAutomationChain } from "@/lib/automation-runner";
import { getPlanLimit, canCreateAutomation } from "@/lib/plan-limits";
import { validateMinimumInterval, getNextRunDate } from "@/lib/cron-utils.server";
import type { Node, Edge } from "@xyflow/react";
import type { TriggerMode } from "@prisma/client";

export async function createAutomation(name: string) {
  try {
    // Get authenticated user from Clerk
    const user = await currentUser();

    if (!user) {
      return {
        success: false,
        error: "Unauthorized. Please sign in.",
      };
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return {
        success: false,
        error: "User not found. Please contact support.",
      };
    }

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

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return {
        success: false,
        error: "User not found. Please contact support.",
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

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return {
        success: false,
        error: "User not found. Please contact support.",
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
      // Helper to serialize transaction receipts (remove provider objects)
      const serializeResult = (result: any): any => {
        if (!result) return null;

        // If it's a transaction receipt, extract only serializable fields
        if (result.hash && result.blockNumber !== undefined) {
          return {
            hash: result.hash,
            blockHash: result.blockHash,
            blockNumber: result.blockNumber?.toString(),
            transactionIndex: result.transactionIndex,
            from: result.from,
            to: result.to,
            gasUsed: result.gasUsed?.toString(),
            status: result.status,
            logs: result.logs?.map((log: any) => ({
              transactionHash: log.transactionHash,
              blockHash: log.blockHash,
              blockNumber: log.blockNumber?.toString(),
              address: log.address,
              data: log.data,
              topics: log.topics,
              index: log.index,
              transactionIndex: log.transactionIndex,
            })) || [],
          };
        }

        // For other types, serialize normally
        return JSON.parse(JSON.stringify(result, (_, v) =>
          typeof v === "bigint" ? v.toString() : v === undefined ? null : v
        ));
      };

      // Execute the automation chain
      const { results } = await executeAutomationChain(
        automationId,
        nodes,
        edges
      );

      // Log each node result
      for (const nodeResult of results) {
        const node = nodes.find((n) => n.id === nodeResult.nodeId);
        await prisma.executionLog.create({
          data: {
            executionId: execution.id,
            nodeId: nodeResult.nodeId,
            nodeType: node?.type || "unknown",
            input: node?.data?.config ?? undefined,
            output: serializeResult(nodeResult.result),
          },
        });
      }

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
        results: results.map(r => ({ ...r, result: serializeResult(r.result) })),
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

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return {
        success: false,
        error: "User not found. Please contact support.",
      };
    }

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

export async function duplicateAutomation(sourceAutomationId: string, newName: string) {
  try {
    const user = await currentUser();

    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return { success: false, error: "User not found. Please contact support." };
    }

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

export async function createAutomationFromShare(shareString: string, name: string) {
  // Import here to avoid circular dependencies
  const { decodeAutomationDefinition } = await import("@/lib/automation-share");

  try {
    const user = await currentUser();

    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return { success: false, error: "User not found. Please contact support." };
    }

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

    // Decode share string
    const definition = decodeAutomationDefinition(shareString);

    if (!definition) {
      return { success: false, error: "Invalid share string. Please check and try again." };
    }

    // Generate wallet
    const { address, encryptedKey } = await generateWallet();

    // Create automation from shared definition
    const automation = await prisma.automation.create({
      data: {
        name,
        userId: dbUser.id,
        walletAddress: address,
        walletEncKey: encryptedKey,
        definition: { nodes: definition.nodes, edges: definition.edges } as any,
        isActive: false,
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

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return { success: false, error: "User not found. Please contact support." };
    }

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
