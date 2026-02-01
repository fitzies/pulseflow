"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { AutomationExecutionsDialog } from "./automation-executions-dialog";
import { formatDistanceToNow } from "date-fns";
import {
  Loader2Icon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react";

type ExecutionStatus = "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

function getStatusIcon(status: ExecutionStatus) {
  switch (status) {
    case "RUNNING":
      return <Loader2Icon className="text-blue-500 animate-spin" size={14} />;
    case "SUCCESS":
      return <CheckCircle2Icon className="text-green-500" size={14} />;
    case "FAILED":
      return <XCircleIcon className="text-red-500" size={14} />;
    case "CANCELLED":
      return <XCircleIcon className="text-yellow-500" size={14} />;
  }
}

interface Automation {
  id: string;
  name: string;
}

interface Execution {
  id: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  startedAt: string;
  automation: {
    id: string;
    name: string;
  };
}

interface SearchCommandProps {
  automations: Automation[];
  executions: Execution[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SearchCommand({
  automations,
  executions,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SearchCommandProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [searchQuery, setSearchQuery] = useState("");
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

  // Filter automations based on search query
  const filteredAutomations = automations.filter((automation) =>
    automation.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter executions based on search query (search in automation name or error)
  const filteredExecutions = executions.filter(
    (execution) =>
      execution.automation.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAutomationSelect = (automationId: string) => {
    router.push(`/automations/${automationId}`);
    setOpen(false);
    setSearchQuery("");
  };

  const handleExecutionSelect = (executionId: string) => {
    setSelectedExecutionId(executionId);
    setExecutionDialogOpen(true);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search Automations"
        description="Type a command or search..."
      >
        <CommandInput
          placeholder="Type a command or search..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Automations">
            {filteredAutomations.map((automation) => (
              <CommandItem
                key={automation.id}
                value={`automation-${automation.id}`}
                onSelect={() => handleAutomationSelect(automation.id)}
              >
                {automation.name}
              </CommandItem>
            ))}
          </CommandGroup>
          {filteredExecutions.length > 0 && <CommandSeparator />}
          {filteredExecutions.length > 0 && (
            <CommandGroup heading="Executions">
              {filteredExecutions.slice(0, 10).map((execution) => (
                <CommandItem
                  key={execution.id}
                  value={`execution-${execution.id}`}
                  onSelect={() => handleExecutionSelect(execution.id)}
                >
                  <div className="flex items-center gap-2 w-full">
                    {getStatusIcon(execution.status)}
                    <span className="truncate max-w-[200px]">
                      {execution.automation.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
      <AutomationExecutionsDialog
        automationId={undefined}
        initialExecutionId={selectedExecutionId || undefined}
        open={executionDialogOpen}
        onOpenChange={setExecutionDialogOpen}
      />
    </>
  );
}
