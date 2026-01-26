"use client";

import { usePathname } from "next/navigation";
import { Bars3Icon, ClockIcon } from "@heroicons/react/24/solid";
import { Button } from "@/components/ui/button";
import { AutomationExecutionsDialog } from "@/components/navbar-components/automation-executions-dialog";
import { useState } from "react";

export function ExecutionsButton() {
  const pathname = usePathname();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Extract automation ID from pathname if we're on /automations/[automation]
  const automationMatch = pathname.match(/\/automations\/([^\/]+)/);
  const currentAutomationId = automationMatch ? automationMatch[1] : null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDialogOpen(true)}
      >
        <ClockIcon className="h-5 w-5" />
      </Button>
      <AutomationExecutionsDialog
        automationId={currentAutomationId || undefined}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
