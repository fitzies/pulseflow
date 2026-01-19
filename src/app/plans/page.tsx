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

type Plan = "BASIC" | "PRO" | "ULTRA" | null;

interface PlanFeatures {
  name: string;
  description: string;
  price: number;
  maxAutomations: number | "Unlimited";
  features: string[];
  highlight?: boolean;
}

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

  const plans: Record<Exclude<Plan, null>, PlanFeatures> = {
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
