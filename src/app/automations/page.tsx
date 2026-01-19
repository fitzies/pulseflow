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

  // Get user's automations
  const automations = await prisma.automation.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });

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
        <CreateAutomationDialog hasPlan={hasPlan} />
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
              <CreateAutomationDialog hasPlan={hasPlan} buttonText="Create Your First Automation" />
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
          {automations.map((automation) => (
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
                        automation.isActive ? "bg-green-500" : "bg-gray-400"
                      }`}
                      title={automation.isActive ? "Active" : "Inactive"}
                    />
                  </div>
                  <CardDescription>
                    Created {new Date(automation.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        automation.isActive
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {automation.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Plan requirement message when button is disabled */}
      {!hasPlan && automations.length > 0 && (
        <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Upgrade to a plan to create new automations.
            <Link href="/plans" className="ml-1 underline">
              View plans
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
