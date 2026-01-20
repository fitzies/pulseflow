import { Plan } from "@prisma/client";

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
      "3 day free trial",
      "Up to 3 automations",
      "Basic node types",
      "Swap, transfer, and liquidity operations",
      "Balance and token checks",
      "Telegram support",
    ],
  },
  PRO: {
    name: "Pro",
    description: "For advanced automation needs",
    price: 14,
    maxAutomations: 10,
    features: [
      "Up to 10 automations",
      "All basic nodes",
      "Advanced control flow nodes",
      "Event-based triggers",
      "Gas guard and failure handling",
      "Priority support",
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
      "Priority support",
      "Advanced analytics",
      "Early access to new features",
      "Custom integrations",
    ],
  },
};
