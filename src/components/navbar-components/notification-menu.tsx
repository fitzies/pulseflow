"use client";

import { ActivityIcon, CheckCircle2Icon, XCircleIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ExecutionStatus = "RUNNING" | "SUCCESS" | "FAILED";

interface Execution {
  id: string;
  status: ExecutionStatus;
  error: string | null;
  startedAt: string; // Serialized as ISO string from server
  finishedAt: string | null;
  automation: {
    id: string;
    name: string;
  };
}

interface RecentExecutionsProps {
  executions: Execution[];
}

function Dot({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height="6"
      viewBox="0 0 6 6"
      width="6"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="3" cy="3" r="3" />
    </svg>
  );
}

function getStatusIcon(status: ExecutionStatus) {
  switch (status) {
    case "RUNNING":
      return <Loader2Icon className="text-blue-500 animate-spin" size={14} />;
    case "SUCCESS":
      return <CheckCircle2Icon className="text-green-500" size={14} />;
    case "FAILED":
      return <XCircleIcon className="text-red-500" size={14} />;
  }
}

function formatTimestamp(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
}

export default function RecentExecutions({ executions }: RecentExecutionsProps) {
  const runningCount = executions.filter((e) => e.status === "RUNNING").length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="View recent executions"
          className="relative size-8 rounded-full text-muted-foreground shadow-none"
          size="icon"
          variant="ghost"
        >
          <ActivityIcon aria-hidden="true" size={16} />
          {runningCount > 0 && (
            <div
              aria-hidden="true"
              className="absolute top-0.5 right-0.5 size-1 rounded-full bg-primary"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-1">
        <div className="flex items-baseline justify-between gap-4 px-3 py-2">
          <div className="font-semibold text-sm">Recent Executions</div>
        </div>
        <div
          aria-orientation="horizontal"
          className="-mx-1 my-1 h-px bg-border"
          role="separator"
          tabIndex={-1}
        />
        {executions.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            No executions yet
          </div>
        ) : (
          executions.map((execution) => (
            <Link
              key={execution.id}
              href={`/automations/${execution.automation.id}`}
              className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              <div className="relative flex items-start gap-2 pe-3">
                <div className="mt-0.5 shrink-0">
                  {getStatusIcon(execution.status)}
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="text-foreground">
                    <span className="font-medium">{execution.automation.name}</span>
                    {execution.status === "FAILED" && execution.error && (
                      <span className="text-muted-foreground"> - {execution.error}</span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {formatTimestamp(execution.startedAt)}
                  </div>
                </div>
                {execution.status === "RUNNING" && (
                  <div className="absolute end-0 self-center">
                    <span className="sr-only">Running</span>
                    <Dot className="text-blue-500" />
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
