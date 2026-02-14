import { currentUser } from "@clerk/nextjs/server";
import { generateText, gateway } from "ai";
import { prisma, getOrCreateDbUser } from "@/lib/prisma";
import { buildSystemPrompt } from "@/lib/ai-context";
import type { Node, Edge } from "@xyflow/react";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export const runtime = "nodejs";
export const maxDuration = 60;

// Extract flow JSON from AI response if present
function extractFlowUpdate(text: string): { nodes: Node[]; edges: Edge[] } | null {
  const match = text.match(/```flow-update\s*([\s\S]*?)```/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed.nodes && Array.isArray(parsed.nodes)) {
      return parsed;
    }
  } catch {
    // Invalid JSON
  }
  return null;
}

// Check if a flow contains placeholder values that shouldn't be saved
function hasPlaceholderValues(flow: { nodes: Node[]; edges: Edge[] }): string[] {
  const issues: string[] = [];

  for (const node of flow.nodes) {
    if (node.type === "start") continue;

    const config = (node.data as { config?: Record<string, unknown> })?.config;
    if (!config) continue;

    // Check for zero amounts
    const amountFields = ["amount", "amountIn", "amountOut", "plsAmount", "plsAmountOut", "amountADesired", "amountBDesired", "amountTokenDesired", "liquidity"];
    for (const field of amountFields) {
      if (field in config && (config[field] === 0 || config[field] === "0" || config[field] === "")) {
        issues.push(`${node.type} has ${field} = 0`);
      }
    }

    // Check for empty/placeholder addresses
    const addressFields = ["token", "tokenA", "tokenB", "to", "pairAddress"];
    for (const field of addressFields) {
      const val = config[field];
      if (field in config && (
        val === "" ||
        val === "0x0" ||
        val === "0x" ||
        val === "0x0000000000000000000000000000000000000000" ||
        (typeof val === "string" && val.toUpperCase().includes("YOUR_"))
      )) {
        issues.push(`${node.type} has invalid ${field}`);
      }
    }

    // Check for empty path arrays
    if ("path" in config && Array.isArray(config.path) && config.path.length === 0) {
      issues.push(`${node.type} has empty path`);
    }
  }

  return issues;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: automationId } = await params;

  const user = await currentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

  if (dbUser.plan !== "PRO" && dbUser.plan !== "ULTRA") {
    return new Response(
      JSON.stringify({ error: "AI Assistant is a Pro feature. Please upgrade your plan." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const automation = await prisma.automation.findUnique({
    where: { id: automationId },
    include: {
      executions: {
        orderBy: { startedAt: "desc" },
        take: 5,
        include: { logs: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!automation) {
    return new Response(JSON.stringify({ error: "Automation not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (automation.userId !== dbUser.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const messages: ChatMessage[] = (body.messages || []).map((m: ChatMessage) => ({
    role: m.role,
    content: m.content,
  }));

  const definition = automation.definition as { nodes?: Node[]; edges?: Edge[] } | null;
  const systemPrompt = buildSystemPrompt({
    name: automation.name,
    walletAddress: automation.walletAddress,
    definition: {
      nodes: definition?.nodes || [],
      edges: definition?.edges || [],
    },
    executions: automation.executions.map((exec) => ({
      id: exec.id,
      status: exec.status,
      error: exec.error,
      startedAt: exec.startedAt.toISOString(),
      finishedAt: exec.finishedAt?.toISOString() || null,
      logs: exec.logs.map((log) => ({
        nodeId: log.nodeId,
        nodeType: log.nodeType,
        input: log.input,
        output: log.output,
        error: log.error,
        createdAt: log.createdAt.toISOString(),
      })),
    })),
  });

  let aiChat = await prisma.aIChat.findUnique({ where: { automationId } });
  if (!aiChat) {
    aiChat = await prisma.aIChat.create({ data: { automationId } });
  }

  const lastUserMessage = messages[messages.length - 1];
  if (lastUserMessage?.role === "user") {
    await prisma.aIChatMessage.create({
      data: { chatId: aiChat.id, role: "user", content: lastUserMessage.content },
    });
  }

  try {
    const result = await generateText({
      model: gateway("openai/gpt-4o"),
      system: systemPrompt,
      messages: messages,
    });

    const rawText = result.text;
    let flowUpdated = false;
    let savedDefinition: { nodes: Node[]; edges: Edge[] } | undefined;

    // Check if AI wants to update the flow
    const flowUpdate = extractFlowUpdate(rawText);
    if (flowUpdate) {
      const hasStart = flowUpdate.nodes.some((n) => n.type === "start");
      const placeholderIssues = hasPlaceholderValues(flowUpdate);

      if (hasStart && placeholderIssues.length === 0) {
        const definitionJson = JSON.parse(JSON.stringify(flowUpdate));
        await prisma.automation.update({
          where: { id: automationId },
          data: { definition: definitionJson },
        });
        savedDefinition = flowUpdate;
        flowUpdated = true;
      } else if (placeholderIssues.length > 0) {
        // Flow has placeholders - don't save, AI should have asked for values
        console.warn("Flow not saved due to placeholder values:", placeholderIssues);
      }
    }

    // Strip flow-update block from display
    const cleanText = rawText.replace(/```flow-update[\s\S]*?```/g, '').trim();

    // Save cleaned assistant message
    await prisma.aIChatMessage.create({
      data: { chatId: aiChat.id, role: "assistant", content: cleanText },
    });

    // Return definition when flow was updated so frontend can update without reload
    return new Response(JSON.stringify({
      text: cleanText,
      flowUpdated,
      definition: savedDefinition,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get AI response" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// GET endpoint to fetch chat history
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: automationId } = await params;

  const user = await currentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

  const automation = await prisma.automation.findUnique({ where: { id: automationId } });
  if (!automation || automation.userId !== dbUser.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const aiChat = await prisma.aIChat.findUnique({
    where: { automationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return new Response(
    JSON.stringify({
      messages: aiChat?.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })) || [],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// DELETE endpoint to clear chat history
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: automationId } = await params;

  const user = await currentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dbUser = await getOrCreateDbUser(user.id, user.emailAddresses[0]?.emailAddress);

  const automation = await prisma.automation.findUnique({ where: { id: automationId } });
  if (!automation || automation.userId !== dbUser.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  await prisma.aIChat.deleteMany({ where: { automationId } });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
