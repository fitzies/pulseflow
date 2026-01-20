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
} from "@/components/ui/card";
import { CreateAutomationDialog } from "@/components/create-automation-dialog";
import { getPlanLimit, canCreateAutomation } from "@/lib/plan-limits";

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
          <h1 className="text-3xl font-bold">Automations</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your automated automations
          </p>
        </div>
        <CreateAutomationDialog 
          hasPlan={hasPlan} 
          canCreateMore={canCreateMore}
          currentCount={currentCount}
          limit={planLimit}
        />
      </div>

      {/* Empty State */}
      {automations.length === 0 ? (
        <Card className="py-12">
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
              <Link
                key={automation.id}
                href={`/automations/${automation.id}`}
                className="transition-transform hover:scale-[1.02]"
              >
                <Card className="h-full cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="line-clamp-1">{automation.name}</CardTitle>
                      <div
                        className={`h-2 w-2 rounded-full ${
                          isRunning
                            ? "bg-blue-500 animate-pulse"
                            : automation.isActive
                              ? "bg-green-500"
                              : "bg-gray-400"
                        }`}
                        title={isRunning ? "Running" : automation.isActive ? "Active" : "Inactive"}
                      />
                    </div>
                    <CardDescription>
                      Created {new Date(automation.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm">
                      {isRunning ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                          Running
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            automation.isActive
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {automation.isActive ? "Active" : "Inactive"}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Plan requirement or limit reached message */}
      {automations.length > 0 && (
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
      )}
    </div>
  );
}
