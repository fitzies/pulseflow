import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

import Link from "next/link";
import Logo from "@/components/logo";
import RecentExecutions from "@/components/navbar-components/notification-menu";
import UserMenu from "@/components/navbar-components/user-menu";
import AutomationSelect from "@/components/navbar-components/automation-select";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default async function Nav() {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  // Get user from database
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
  });

  if (!dbUser) {
    return null;
  }

  // Get user's automations
  const automations = await prisma.automation.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });

  // Get recent executions
  const executionsData = await prisma.execution.findMany({
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
    take: 10,
  });

  // Serialize dates for client component
  const executions = executionsData.map((execution) => ({
    ...execution,
    startedAt: execution.startedAt.toISOString(),
    finishedAt: execution.finishedAt?.toISOString() || null,
  }));

  const userDisplayName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.username || user.emailAddresses[0]?.emailAddress || "Account";

  const userEmail = user.emailAddresses[0]?.emailAddress || "";

  const hasPlan = dbUser.plan !== null;
  return (
    <header className="border-b px-4 md:px-6 fixed top-0 w-full z-50 bg-background">
      <div className="flex h-16 items-center justify-between gap-4">
        {/* Left side */}
        <div className="flex items-center gap-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink className="text-foreground" href="/">
                  <Logo />
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator> / </BreadcrumbSeparator>
              <BreadcrumbItem className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger className="hover:text-foreground">
                    <BreadcrumbEllipsis />
                    <span className="sr-only">Toggle menu</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem asChild>
                      <a href="#">{userDisplayName}</a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={"/automations"}>Automations</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </BreadcrumbItem>
              <BreadcrumbItem className="max-md:hidden">
                <BreadcrumbLink href="#">{userDisplayName}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="max-md:hidden">
                {" "}
                /{" "}
              </BreadcrumbSeparator>
              <BreadcrumbItem className="max-md:hidden">
                <BreadcrumbLink asChild>
                  <Link href="/automations">Automations</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <AutomationSelect automations={automations} />
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Recent Executions */}
          <RecentExecutions executions={executions} />
          {/* Upgrade button - only show if user doesn't have a plan */}
          {!hasPlan && (
            <Button asChild size="sm" variant="default">
              <Link href="/plans">Upgrade</Link>
            </Button>
          )}
          {/* User menu */}
          <UserMenu
            user={{
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: userEmail,
              imageUrl: user.imageUrl,
              username: user.username,
            }}
          />
        </div>
      </div>
    </header>
  );
}
