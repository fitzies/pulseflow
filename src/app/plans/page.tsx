import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateDbUser } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlanFeatures, plans } from "@/lib/plan-limits";
import { CheckoutButton } from "@/components/checkout-button";
import { ManageSubscriptionButton } from "@/components/manage-subscription-button";
import type { Plan } from "@prisma/client";

type DisplayPlan = Extract<Plan, "FREE" | "PRO" | "ULTRA">;

function PlanCard({
  plan,
  features,
  currentPlan,
}: {
  plan: DisplayPlan;
  features: PlanFeatures;
  currentPlan: Plan | null;
}) {
  const isCurrentPlan = currentPlan === plan;
  const isUpgrade =
    ((currentPlan === "FREE" || currentPlan === "BASIC") &&
      (plan === "PRO" || plan === "ULTRA")) ||
    (currentPlan === "PRO" && plan === "ULTRA");

  return (
    <Card
      className={cn(
        "flex-1 flex flex-col",
        isCurrentPlan && "border-primary ring-2 ring-primary/20",
        features.highlight && !isCurrentPlan && "border-primary",
      )}
    >
      <CardHeader>
        <CardTitle className="text-xl">{features.name}</CardTitle>
        <CardDescription>{features.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 flex-1">
        <div className="flex items-baseline gap-1">
          {features.price === 0 ? (
            <span className="text-4xl font-bold">Free</span>
          ) : (
            <>
              <span className="text-4xl font-bold">${features.price}</span>
              <span className="text-muted-foreground">/month</span>
            </>
          )}
        </div>
        <ul className="space-y-3">
          {features.features.map((feature, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {isCurrentPlan ? (
          <Button variant="outline" className="w-full bg-transparent" disabled>
            Current Plan
          </Button>
        ) : plan === "FREE" ? (
          currentPlan === null ? (
            <Button variant="outline" className="w-full" disabled>
              Included for free
            </Button>
          ) : (
            <ManageSubscriptionButton label="Downgrade" className="w-full" />
          )
        ) : currentPlan === null || currentPlan === "FREE" ? (
          <CheckoutButton plan={plan} className="w-full">
            {isUpgrade ? "Upgrade" : "Get Started"}
          </CheckoutButton>
        ) : (
          <ManageSubscriptionButton
            label={isUpgrade ? "Upgrade" : "Downgrade"}
            className="w-full"
          />
        )}
        {plan === "FREE" && (
          <p className="text-center text-sm text-muted-foreground">
            No card required
          </p>
        )}
        {plan === "PRO" && (
          <p className="text-center text-sm text-muted-foreground">
            3-day free trial
          </p>
        )}
      </CardFooter>
    </Card>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const params = await searchParams;

  // Redirect to dashboard after successful payment
  if (params.success === "true") {
    redirect("/automations");
  }

  const user = await currentUser();

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <p>Please sign in to view plans.</p>
      </main>
    );
  }

  // Get or create user in database
  const dbUser = await getOrCreateDbUser(
    user.id,
    user.emailAddresses[0]?.emailAddress,
  );

  const currentPlan: Plan | null = dbUser.plan;

  return (
    <main className="min-h-[90vh] flex items-center justify-center bg-background p-6">
      <div className="flex flex-col md:flex-row gap-6 max-w-5xl w-full">
        <PlanCard plan="FREE" features={plans.FREE} currentPlan={currentPlan} />
        <PlanCard plan="PRO" features={plans.PRO} currentPlan={currentPlan} />
        <PlanCard
          plan="ULTRA"
          features={plans.ULTRA}
          currentPlan={currentPlan}
        />
      </div>
    </main>
  );
}

export { PlanCard };
