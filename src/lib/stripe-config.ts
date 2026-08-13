import type { Plan } from "@prisma/client";

export type CheckoutPlan = Extract<Plan, "PRO" | "ULTRA">;
type StripePricePlan = Exclude<Plan, "FREE">;

// BASIC is retained for existing subscriptions, but only PRO and ULTRA may checkout.
export const STRIPE_PRICE_IDS = {
  BASIC: process.env.STRIPE_PRICE_BASIC!,
  PRO: process.env.STRIPE_PRICE_PRO!,
  ULTRA: process.env.STRIPE_PRICE_ULTRA!,
} as const satisfies Record<StripePricePlan, string>;

export function isCheckoutPlan(plan: unknown): plan is CheckoutPlan {
  return plan === "PRO" || plan === "ULTRA";
}

// Reverse lookup also supports legacy BASIC subscription events.
export function getPlanFromPriceId(priceId: string): StripePricePlan | null {
  const entries = Object.entries(STRIPE_PRICE_IDS) as [
    StripePricePlan,
    string,
  ][];
  const found = entries.find(([, id]) => id === priceId);
  return found ? found[0] : null;
}

// Get price ID for a paid plan
export function getPriceIdFromPlan(plan: CheckoutPlan): string {
  return STRIPE_PRICE_IDS[plan];
}
