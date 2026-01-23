import { Plan } from "@prisma/client";

// Node types that require PRO or higher plan
const PRO_ONLY_NODES = ["wait", "loop", "gasGuard", "condition"] as const;

type ProNodeType = (typeof PRO_ONLY_NODES)[number];

/**
 * Check if a node type requires PRO plan
 */
export function isProNode(nodeType: string): nodeType is ProNodeType {
  return PRO_ONLY_NODES.includes(nodeType as ProNodeType);
}

/**
 * Find all PRO-only nodes in an automation definition
 * @returns Array of { nodeType, label } for each PRO node found
 */
export function findProNodesInDefinition(
  nodes: { type?: string }[]
): { type: string; label: string }[] {
  const proNodeLabels: Record<ProNodeType, string> = {
    wait: "Wait",
    loop: "Loop",
    gasGuard: "Gas Guard",
    condition: "Condition",
  };

  const found: { type: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (node.type && isProNode(node.type) && !seen.has(node.type)) {
      seen.add(node.type);
      found.push({ type: node.type, label: proNodeLabels[node.type] });
    }
  }

  return found;
}

/**
 * Check if a user's plan allows running automations with PRO nodes
 */
export function canUseProNodes(plan: Plan | null): boolean {
  return plan === "PRO" || plan === "ULTRA";
}

/**
 * Get the maximum number of automations allowed for a plan
 * @param plan - The user's plan (BASIC, PRO, ULTRA, or null)
 * @returns The limit as a number, or null for unlimited/no plan
 */
export function getPlanLimit(plan: Plan | null): number | null {
  switch (plan) {
    case "BASIC":
      return 3;
    case "PRO":
      return 10;
    case "ULTRA":
      return null; // Unlimited
    default:
      return null; // No plan
  }
}

/**
 * Check if a user can create more automations based on their current count and plan
 * @param currentCount - The number of automations the user currently has
 * @param plan - The user's plan (BASIC, PRO, ULTRA, or null)
 * @returns true if the user can create more automations, false otherwise
 */
export function canCreateAutomation(currentCount: number, plan: Plan | null): boolean {
  const limit = getPlanLimit(plan);

  // If no plan, cannot create
  if (plan === null) {
    return false;
  }

  // If unlimited (ULTRA), always allow
  if (limit === null) {
    return true;
  }

  // Check if current count is below limit
  return currentCount < limit;
}

export interface PlanFeatures {
  name: string;
  description: string;
  price: number;
  maxAutomations: number | "Unlimited";
  features: string[];
  highlight?: boolean;
}

export const plans: Record<Exclude<Plan, null>, PlanFeatures> = {
  BASIC: {
    name: "Basic",
    description: "For getting started with automation",
    price: 6,
    maxAutomations: 3,
    features: [
      "Up to 3 automations",
      "Swap, transfer, and liquidity operations",
      "Balance and price checks",
      "Telegram notifications",
    ],
  },
  PRO: {
    name: "Pro",
    description: "For advanced automation needs",
    price: 14,
    maxAutomations: 10,
    features: [
      "Up to 10 automations",
      "Everything in Basic",
      "Wait, Loop, and Conditional nodes",
      "Gas Guard protection",
      "Scheduled triggers",
      "AI Integration",
    ],
    highlight: true,
  },
  ULTRA: {
    name: "Ultra",
    description: "For power users and teams",
    price: 29,
    maxAutomations: "Unlimited",
    features: [
      "Unlimited automations",
      "Everything in Pro",
      "Advanced analytics",
      "Early access to new features",
      "Custom integrations",
    ],
  },
};
