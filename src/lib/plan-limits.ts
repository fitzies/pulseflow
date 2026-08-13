import { Plan } from "@prisma/client";

export const FREE_DAILY_RUN_LIMIT = 5;

// Control-flow nodes require PRO or higher. Keep this server-side list in sync
// with the node picker; imported definitions must not bypass plan checks.
const PRO_ONLY_NODES = ["wait", "loop", "gasGuard", "condition", "forEach", "endForEach"] as const;

const FREE_ALLOWED_NODES = [
  "start",
  "swap",
  "swapFromPLS",
  "swapToPLS",
  "transfer",
  "transferPLS",
  "addLiquidity",
  "addLiquidityPLS",
  "removeLiquidity",
  "removeLiquidityPLS",
  "checkBalance",
  "checkTokenBalance",
  "checkLPTokenAmounts",
  "burnToken",
  "claimToken",
  "getParent",
  "telegram",
  "variable",
  "calculator",
  "dexQuote",
] as const;

const NODE_LABELS: Record<string, string> = {
  wait: "Wait",
  loop: "Repeat",
  gasGuard: "Gas Guard",
  condition: "Condition",
  forEach: "For Each",
  endForEach: "For Each",
};

type ProNodeType = (typeof PRO_ONLY_NODES)[number];

export function isProNode(nodeType: string): nodeType is ProNodeType {
  return PRO_ONLY_NODES.includes(nodeType as ProNodeType);
}

export function findProNodesInDefinition(
  nodes: { type?: string }[]
): { type: string; label: string }[] {
  const found: { type: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (node.type && isProNode(node.type) && !seen.has(node.type)) {
      seen.add(node.type);
      found.push({ type: node.type, label: NODE_LABELS[node.type] ?? node.type });
    }
  }

  return found;
}

export function findDisallowedFreeNodes(
  nodes: { type?: string }[]
): { type: string; label: string }[] {
  const allowed = new Set<string>(FREE_ALLOWED_NODES);
  const found: { type: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (node.type && !allowed.has(node.type) && !seen.has(node.type)) {
      seen.add(node.type);
      found.push({ type: node.type, label: NODE_LABELS[node.type] ?? node.type });
    }
  }

  return found;
}

export function canUseProNodes(plan: Plan | null): boolean {
  return plan === "PRO" || plan === "ULTRA";
}

export function canUseAutomatedTriggers(plan: Plan | null): boolean {
  return plan === "PRO" || plan === "ULTRA";
}

export function getPlanLimit(plan: Plan | null): number | null {
  switch (plan) {
    case "FREE":
      return 1;
    case "BASIC":
      return 3;
    case "PRO":
      return 10;
    case "ULTRA":
      return null;
    default:
      return 0;
  }
}

export function canCreateAutomation(currentCount: number, plan: Plan | null): boolean {
  const limit = getPlanLimit(plan);
  if (limit === null) return plan === "ULTRA";
  return currentCount < limit;
}

export interface PlanFeatures {
  name: string;
  description: string;
  price: number;
  maxAutomations: number | "Unlimited";
  features: string[];
  highlight?: boolean;
  legacy?: boolean;
}

export const plans: Record<Plan, PlanFeatures> = {
  FREE: {
    name: "Free",
    description: "Build and run your first automation",
    price: 0,
    maxAutomations: 1,
    features: [
      "1 automation",
      "5 manual runs per day",
      "Swap, transfer, and liquidity operations",
      "Balance and price checks",
      "Telegram notifications",
    ],
  },
  BASIC: {
    name: "Basic",
    description: "Legacy plan",
    price: 6,
    maxAutomations: 3,
    features: [
      "Up to 3 automations",
      "Swap, transfer, and liquidity operations",
      "Balance and price checks",
      "Telegram notifications",
    ],
    legacy: true,
  },
  PRO: {
    name: "Pro",
    description: "For advanced automation needs",
    price: 14,
    maxAutomations: 10,
    features: [
      "Up to 10 automations",
      "Unlimited manual runs",
      "Wait, Loop, Conditional, and For Each nodes",
      "Gas Guard protection",
      "Scheduled and price triggers",
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
      "Unlimited automations and runs",
      "Everything in Pro",
      "Advanced analytics",
      "Early access to new features",
      "Custom integrations",
    ],
  },
};
