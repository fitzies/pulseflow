"use client";

import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { CheckCircle2Icon, XCircleIcon, Loader2Icon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ExecutionStatus = "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

interface RecentExecutionsCardProps {
  recentExecutions: Array<{
    id: string;
    status: ExecutionStatus;
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
    automation: {
      id: string;
      name: string;
    };
  }>;
  onExecutionClick: (executionId: string) => void;
}

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

export function RecentExecutionsCard({
  recentExecutions,
  onExecutionClick,
}: RecentExecutionsCardProps) {
  return (
    <div className="flex flex-col gap-3 col-span-1 w-full">
      <p className="ml-1">Recent Executions</p>
      <Card className="col-span-1 shadow-none bg-stone-900/60 self-start md:block hidden w-full">
        <CardContent className="flex flex-col gap-2">
          {recentExecutions.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No executions yet
            </div>
          ) : (
            recentExecutions.map((execution) => (
              <Button
                key={execution.id}
                variant="ghost"
                onClick={() => onExecutionClick(execution.id)}
                className="w-full justify-start rounded-md px-2 text-sm transition-colors hover:bg-accent h-auto"
              >
                <div className="flex items-start gap-2 w-full">
                  <div className="mt-0.5 shrink-0">
                    {getStatusIcon(execution.status)}
                  </div>
                  <div className="flex-1 space-y-1 min-w-0 text-left">
                    <div className="text-foreground line-clamp-1">
                      <span className="font-medium truncate block">{execution.automation.name}</span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </Button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
