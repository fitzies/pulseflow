import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { plans } from "@/lib/plan-limits";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ManageSubscriptionButton } from "@/components/manage-subscription-button";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function BillingPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
  });

  const currentPlan = dbUser?.plan;
  const hasSubscription = !!dbUser?.stripeSubscriptionId;

  return (
    <main className="min-h-[90vh] flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>Manage your subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentPlan ? (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-2xl font-bold">{plans[currentPlan].name}</p>
                <p className="text-muted-foreground">
                  ${plans[currentPlan].price}/month
                </p>
              </div>

              {hasSubscription ? (
                <ManageSubscriptionButton />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active Stripe subscription found.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                You don&apos;t have an active subscription.
              </p>
              <Button asChild>
                <Link href="/plans">View Plans</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
