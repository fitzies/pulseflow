import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

type Plan = "BASIC" | "PRO" | "ULTRA" | null;



function PlanCard({
  plan,
  features,
  currentPlan,
}: {
  plan: Plan;
  features: PlanFeatures;
  currentPlan: Plan;
}) {
  const isCurrentPlan = currentPlan === plan;
  const isUpgrade =
    (currentPlan === "BASIC" && plan === "PRO") ||
    (currentPlan === "BASIC" && plan === "ULTRA") ||
    (currentPlan === "PRO" && plan === "ULTRA");

  return (
    <Card
      className={cn(
        "flex-1 flex flex-col",
        isCurrentPlan && "border-primary ring-2 ring-primary/20",
        features.highlight && !isCurrentPlan && "border-primary"
      )}
    >
      <CardHeader>
        <CardTitle className="text-xl">{features.name}</CardTitle>
        <CardDescription>{features.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 flex-1">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">${features.price}</span>
          <span className="text-muted-foreground">/month</span>
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
        ) : currentPlan === null && plan ? (
          <CheckoutButton plan={plan} className="w-full">
            Get Started
          </CheckoutButton>
        ) : (
          <ManageSubscriptionButton
            label={isUpgrade ? "Upgrade" : "Downgrade"}
            className="w-full"
          />
        )}
        {(plan === "BASIC" || plan === "PRO") && (
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

  // Get user from database
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
  });

  if (!dbUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <p>User not found. Please contact support.</p>
      </main>
    );
  }

  const currentPlan: Plan = dbUser.plan;


  return (
    <main className="min-h-[90vh] flex items-center justify-center bg-background p-6">
      <div className="flex flex-col md:flex-row gap-6 max-w-5xl w-full">
        <PlanCard plan="BASIC" features={plans.BASIC} currentPlan={currentPlan} />
        <PlanCard plan="PRO" features={plans.PRO} currentPlan={currentPlan} />
        <PlanCard plan="ULTRA" features={plans.ULTRA} currentPlan={currentPlan} />
      </div>
    </main>
  );
}

export { PlanCard }