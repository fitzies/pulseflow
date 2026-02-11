import { currentUser } from "@clerk/nextjs/server";
import { prisma, getOrCreateDbUser } from "@/lib/prisma";

import Link from "next/link";
import Logo from "@/components/logo";
// import RecentExecutions from "@/components/navbar-components/notification-menu";
// import ScheduledExecutionsMenu from "@/components/navbar-components/scheduled-executions-menu";
import UserMenu from "@/components/navbar-components/user-menu";
import AutomationSelect from "@/components/navbar-components/automation-select";
import { ActivityIcon, Menu } from "lucide-react";
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
import RecentExecutions from "./navbar-components/notification-menu";
import { SearchCommandButton } from "./navbar-components/search-command-button";
import { Bars3Icon, ViewColumnsIcon } from "@heroicons/react/24/solid";
import { ExecutionsButton } from "./navbar-components/automation-executions-dialog";

export default async function Nav({ layout = "Automations" }: { layout?: "Automations" | "Executions" }) {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  // Get or create user in database
  const dbUser = await getOrCreateDbUser(user.id);

  // Get user's automations
  const automations = await prisma.automation.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });

  // Get recent executions
  const executions = await prisma.execution.findMany({
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
    take: 10, // Limit to recent executions for the nav menu
  });

  // Serialize executions for the client component
  const serializedExecutions = executions.map((execution) => ({
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

  // Serialize automations for the client component (just id and name)
  const serializedAutomations = automations.map((automation) => ({
    id: automation.id,
    name: automation.name,
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
                <BreadcrumbLink href="/automations">{userDisplayName}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="max-md:hidden">
                {" "}
                /{" "}
              </BreadcrumbSeparator>
              <BreadcrumbItem className="max-md:hidden">
                <BreadcrumbLink asChild>
                  {layout === "Automations" ? <Link href="/automations">Automations</Link> : <Link href="/executions">Executions</Link>}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <AutomationSelect automations={automations} />
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        {/* Right side */}
        <div className="flex items-center gap-2">
          {!hasPlan && (
            <Button asChild size="sm" variant="outline">
              <Link href="/plans">Upgrade</Link>
            </Button>
          )}
          <SearchCommandButton
            automations={serializedAutomations}
            executions={serializedExecutions}
          />
          <RecentExecutions executions={serializedExecutions} />
          <ExecutionsButton />
          {/* <RecentExecutions /> */}
          {/* {layout === "Automations" ? <Button asChild size="sm" variant="ghost" className="h-8 px-3 shadow-none">
            <Link href="/executions">
              Executions
            </Link>
          </Button> : <Button asChild size="sm" variant="ghost" className="h-8 px-3 shadow-none">
            <Link href="/automations">
              Automations
            </Link>
          </Button>} */}
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
            hasPassword={user.passwordEnabled}
          />
        </div>
      </div>
    </header>
  );
}
