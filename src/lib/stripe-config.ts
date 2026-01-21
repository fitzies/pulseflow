import { Plan } from "@prisma/client";

// Map Stripe Price IDs to Plan enum
// Replace these with your actual Stripe Price IDs from the dashboard
export const STRIPE_PRICE_IDS = {
  BASIC: process.env.STRIPE_PRICE_BASIC!,
  PRO: process.env.STRIPE_PRICE_PRO!,
  ULTRA: process.env.STRIPE_PRICE_ULTRA!,
} as const;

// Reverse lookup: Price ID -> Plan
export function getPlanFromPriceId(priceId: string): Plan | null {
  const entries = Object.entries(STRIPE_PRICE_IDS) as [Plan, string][];
  const found = entries.find(([, id]) => id === priceId);
  return found ? found[0] : null;
}

// Get price ID for a plan
export function getPriceIdFromPlan(plan: Plan): string {
  return STRIPE_PRICE_IDS[plan];
}
