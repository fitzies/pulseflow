import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateAutomationDialog } from "@/components/create-automation-dialog";
import { ShareAutomationButton } from "@/components/share-automation-button";
import { EditAutomationNameButton } from "@/components/edit-automation-name-button";
import { getPlanLimit, canCreateAutomation } from "@/lib/plan-limits";
import { AutomationNodeIcons } from "@/components/automation-node-icons";
import { Status, StatusIndicator } from "@/components/kibo-ui/status";

export default async function Page() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Please sign in to view your automations.</p>
      </div>
    );
  }

  // Get user from database
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
  });

  if (!dbUser) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>User not found. Please contact support.</p>
      </div>
    );
  }

  // Check plan status
  const hasPlan = dbUser.plan !== null;

  // Get user's automations with running execution status
  const automations = await prisma.automation.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
    include: {
      executions: {
        where: { status: "RUNNING" },
        take: 1,
      },
    },
  });

  // Get plan limit and check if user can create more
  const currentCount = automations.length;
  const planLimit = getPlanLimit(dbUser.plan);
  const canCreateMore = canCreateAutomation(currentCount, dbUser.plan);

  return (
    <div className="container mx-auto px-4 py-8">
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
          automations={automations.map((a) => ({ id: a.id, name: a.name }))}
        />
      </div>

      {/* Empty State */}
      {automations.length === 0 ? (
        <Card className="py-12 bg-transparent border-transparent">
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
      ) : (
        /* Grid Layout */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {automations.map((automation) => {
            const isRunning = automation.executions.length > 0;
            return (
              <Card key={automation.id} className="h-full flex flex-col hover:scale-[102%] duration-300">
                <CardContent>
                  <Link href={`/automations/${automation.id}`} className="flex items-center justify-center w-full h-40 border rounded-xl p-2">
                    <AutomationNodeIcons definition={automation.definition} />
                  </Link>
                </CardContent>
                <CardFooter className="flex items-center justify-between px-6!">
                  <div className="flex items-center gap-2">
                    <p>{automation.name}</p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <EditAutomationNameButton
                      automationId={automation.id}
                      currentName={automation.name}
                    />
                    <ShareAutomationButton
                      definition={automation.definition}
                      automationName={automation.name}
                    />
                    <Status
                      className="rounded-full px-0 py-0 border-0 pl-2"
                      status={
                        isRunning
                          ? "online"
                          : automation.triggerMode === 'SCHEDULE' && automation.nextRunAt
                            ? "maintenance"
                            : automation.isActive
                              ? "online"
                              : "offline"
                      }
                      variant="outline"
                    >
                      <StatusIndicator />
                    </Status>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
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
