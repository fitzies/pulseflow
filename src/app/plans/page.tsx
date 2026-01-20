import { currentUser } from "@clerk/nextjs/server";
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
import Link from "next/link";
import { PlanFeatures, plans } from "@/lib/plan-limits";

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
    currentPlan === null ||
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
      <CardFooter>
        {isCurrentPlan ? (
          <Button variant="outline" className="w-full bg-transparent" disabled>
            Current Plan
          </Button>
        ) : plan === "PRO" || plan === "ULTRA" ? (
          <Button variant="outline" className="w-full bg-transparent" disabled>
            Coming Soon
          </Button>
        ) : isUpgrade ? (
          <Button asChild className="w-full">
            <Link href="#">Get Started</Link>
          </Button>
        ) : (
          <Button variant="outline" className="w-full bg-transparent" disabled>
            Downgrade
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default async function Page() {
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