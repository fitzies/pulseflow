"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import {
  BreadcrumbItem,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

interface AutomationSelectProps {
  automations: Array<{ id: string; name: string }>;
}

export default function AutomationSelect({ automations }: AutomationSelectProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Extract automation ID from pathname if we're on /automations/[automation]
  const automationMatch = pathname.match(/\/automations\/([^\/]+)/);
  const currentAutomationId = automationMatch ? automationMatch[1] : null;
  
  // Check if we're on the base automations page (not a specific automation)
  const isBaseAutomationsPage = pathname === "/automations" || pathname.endsWith("/automations") || !currentAutomationId;
  
  // Don't show the select on the base automations page
  if (isBaseAutomationsPage) {
    return null;
  }
  
  const selectedAutomationId = currentAutomationId || automations[0]?.id;
  
  const handleValueChange = (value: string) => {
    router.push(`/automations/${value}`);
  };
  
  return (
    <>
      <BreadcrumbSeparator> / </BreadcrumbSeparator>
      <BreadcrumbItem>
        <Select value={selectedAutomationId} onValueChange={handleValueChange}>
          <SelectPrimitive.SelectTrigger
            aria-label="Select automation"
            asChild
          >
            <Button
              className="h-8 px-1.5 text-foreground focus-visible:bg-accent focus-visible:ring-0"
              variant="ghost"
            >
              <SelectValue placeholder="Select automation" />
              <ChevronsUpDown
                className="text-muted-foreground/80"
                size={14}
              />
            </Button>
          </SelectPrimitive.SelectTrigger>
          {automations.length > 0 && (
            <SelectContent className="[&_*[role=option]>span]:start-auto [&_*[role=option]>span]:end-2 [&_*[role=option]]:ps-2 [&_*[role=option]]:pe-8">
              {automations.map((automation) => (
                <SelectItem key={automation.id} value={automation.id}>
                  {automation.name}
                </SelectItem>
              ))}
            </SelectContent>
          )}
        </Select>
      </BreadcrumbItem>
    </>
  );
}
