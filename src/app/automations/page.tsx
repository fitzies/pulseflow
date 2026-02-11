import { currentUser } from "@clerk/nextjs/server";
import { prisma, getOrCreateDbUser } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { CreateAutomationDialog } from "@/components/create-automation-dialog";
import { getPlanLimit, canCreateAutomation } from "@/lib/plan-limits";
import AutomationsHeader from "@/components/automations-header";
import { getProvider } from "@/lib/blockchain-functions";

export default async function Page() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Please sign in to view your automations.</p>
      </div>
    );
  }

  // Get or create user in database
  const dbUser = await getOrCreateDbUser(user.id);

  // Check plan status
  const hasPlan = dbUser.plan !== null;

  // Get user's automations with execution stats
  const automations = await prisma.automation.findMany({
    where: { userId: dbUser.id },
    orderBy: [
      { isFavorite: "desc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      name: true,
      definition: true,
      triggerMode: true,
      nextRunAt: true,
      isActive: true,
      defaultSlippage: true,
      rpcEndpoint: true,
      showNodeLabels: true,
      betaFeatures: true,
      communityVisible: true,
      isFavorite: true,
      walletAddress: true,
      executions: {
        where: { status: "RUNNING" },
        take: 1,
      },
      _count: {
        select: { executions: true },
      },
    },
  });

  // Fetch PLS balances for all automation wallets
  const provider = getProvider();
  const walletAddresses = automations.map((a) => a.walletAddress);
  const balancePromises = walletAddresses.map((address) =>
    provider.getBalance(address).catch(() => BigInt(0))
  );
  const balances = await Promise.all(balancePromises);
  const totalPlsBalance = balances.reduce((sum, bal) => sum + bal, BigInt(0)).toString();

  // Get success counts for each automation
  const successCounts = await prisma.execution.groupBy({
    by: ["automationId"],
    where: {
      automationId: { in: automations.map((a) => a.id) },
      status: "SUCCESS",
    },
    _count: { id: true },
  });

  const successCountMap = new Map(
    successCounts.map((s) => [s.automationId, s._count.id])
  );

  // Enrich automations with success count
  const automationsWithStats = automations.map((automation) => ({
    ...automation,
    successCount: successCountMap.get(automation.id) ?? 0,
  }));

  // Calculate total success rate across all automations
  const totalExecutions = automationsWithStats.reduce((sum, a) => sum + a._count.executions, 0);
  const totalSuccessCount = automationsWithStats.reduce((sum, a) => sum + a.successCount, 0);
  const totalSuccessRate = totalExecutions > 0 ? Math.round((totalSuccessCount / totalExecutions) * 100) : 0;

  // Calculate additional stats
  const scheduledAutomations = automations.filter((a) => a.triggerMode === "SCHEDULE").length;

  // Get failed executions count
  const failedExecutionsCount = await prisma.execution.count({
    where: {
      userId: dbUser.id,
      status: "FAILED",
    },
  });

  // Get last execution time
  const lastExecution = await prisma.execution.findFirst({
    where: { userId: dbUser.id },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });

  // Get recent executions (latest 5)
  const recentExecutions = await prisma.execution.findMany({
    where: { userId: dbUser.id },
    include: {
      automation: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 5,
  });

  // Serialize executions for the client component
  const serializedExecutions = recentExecutions.map((execution) => ({
    id: execution.id,
    status: execution.status as "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED",
    error: execution.error,
    startedAt: execution.startedAt.toISOString(),
    finishedAt: execution.finishedAt?.toISOString() || null,
    automation: {
      id: execution.automation.id,
      name: execution.automation.name,
    },
  }));

  // Get plan limit and check if user can create more
  const currentCount = automations.length;
  const planLimit = getPlanLimit(dbUser.plan);
  const canCreateMore = canCreateAutomation(currentCount, dbUser.plan);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Empty State */}
      {automations.length === 0 ? (
        <>
          {/* Header with Create Button */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Manage your automated automations
              </p>
            </div>
            <CreateAutomationDialog
              hasPlan={hasPlan}
              canCreateMore={canCreateMore}
              currentCount={currentCount}
              limit={planLimit}
              automations={[]}
            />
          </div>
          <Card className="py-12 bg-transparent border-transparent shadow-none">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <h3 className="text-lg font-semibold mb-2">No automations yet</h3>
              <p className="text-muted-foreground mb-6 text-sm">
                {hasPlan
                  ? "Get started by creating your first automation."
                  : "Upgrade to a plan to create automations."}
              </p>
              {hasPlan && (
                <CreateAutomationDialog
                  hasPlan={hasPlan}
                  buttonText="Create Your First Automation"
                  canCreateMore={canCreateMore}
                  currentCount={currentCount}
                  limit={planLimit}
                  automations={[]}
                />
              )}
              {!hasPlan && (
                <Button asChild variant="default">
                  <Link href="/plans">View Plans</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <AutomationsHeader
          automations={automationsWithStats}
          hasPlan={hasPlan}
          canCreateMore={canCreateMore}
          currentCount={currentCount}
          planLimit={planLimit}
          userPlan={dbUser.plan}
          automationNames={automations.map((a) => ({ id: a.id, name: a.name }))}
          totalSuccessRate={totalSuccessRate}
          totalPlsBalance={totalPlsBalance}
          scheduledAutomations={scheduledAutomations}
          totalExecutions={totalExecutions}
          failedExecutions={failedExecutionsCount}
          lastExecutionTime={lastExecution?.startedAt ?? null}
          recentExecutions={serializedExecutions}
        />
      )}

      {/* Plan requirement or limit reached message */}
      {((planLimit !== null && automations.length >= planLimit - 1) || (planLimit === null && automations.length > 0)) && dbUser.plan !== "ULTRA" ? (
        <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
          {!hasPlan ? (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Upgrade to a plan to create new automations.
              <Link href="/plans" className="ml-1 underline">
                View plans
              </Link>
            </p>
          ) : !canCreateMore && planLimit !== null ? (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              You've reached your plan limit of {planLimit} automation{planLimit !== 1 ? 's' : ''}.
              <Link href="/plans" className="ml-1 underline">
                Upgrade to create more
              </Link>
            </p>
          ) : planLimit !== null && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              You're using {currentCount} of {planLimit} automation{planLimit !== 1 ? 's' : ''} on your {dbUser.plan} plan.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
