"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ActivityIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  CopyIcon,
  CheckIcon,
  RefreshCwIcon,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CommandLineIcon } from "@heroicons/react/24/solid";

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

interface ExecutionLog {
  id: string;
  nodeId: string;
  nodeType: string;
  input: any;
  output: any;
  error: string | null;
  createdAt: string;
}

interface ExecutionDetails extends Execution {
  logs: ExecutionLog[];
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

function formatFullDate(dateString: string): string {
  return format(new Date(dateString), "PPpp");
}

function JsonPreview({
  label,
  value,
  maxLines = 8,
}: {
  label: string;
  value: unknown;
  maxLines?: number;
}) {
  const json = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const previewText = useMemo(() => {
    const lines = json.split("\n");
    if (lines.length <= maxLines) return json;
    return `${lines.slice(0, maxLines).join("\n")}\n…`;
  }, [json, maxLines]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // If clipboard is unavailable, at least keep the preview readable.
    }
  };

  return (
    <div className="space-y-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copy}
          className="h-7 px-2"
        >
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <div
        className={[
          "w-full max-w-full rounded bg-muted p-2 font-mono text-xs",
          "whitespace-pre-wrap wrap-break-word break-all",
          "overflow-hidden",
        ].join(" ")}
      >
        {previewText}
      </div>
    </div>
  );
}

function ExecutionDialog({
  executionId,
  open,
  onOpenChange,
}: {
  executionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [executionDetails, setExecutionDetails] = useState<ExecutionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExecutionDetails = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/executions/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch execution details");
      }
      const data = await response.json();
      setExecutionDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load execution details");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch details when dialog opens and executionId changes
  useEffect(() => {
    if (open && executionId) {
      fetchExecutionDetails(executionId);
    } else {
      setExecutionDetails(null);
      setError(null);
    }
  }, [open, executionId, fetchExecutionDetails]);

  if (!executionId) return null;

  const duration = executionDetails?.finishedAt && executionDetails?.startedAt
    ? Math.round((new Date(executionDetails.finishedAt).getTime() - new Date(executionDetails.startedAt).getTime()) / 1000)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl sm:min-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {executionDetails && getStatusIcon(executionDetails.status)}
            <span>Execution Details</span>
          </DialogTitle>
          <DialogDescription className="wrap-break-word">
            {executionDetails?.automation.name}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2Icon className="animate-spin text-muted-foreground" size={24} />
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive wrap-break-word break-all whitespace-pre-wrap">
            {error}
          </div>
        )}

        {executionDetails && !loading && (
          <div className="space-y-6">
            {/* Metadata */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium ${executionDetails.status === "SUCCESS" ? "text-green-600" :
                  executionDetails.status === "FAILED" ? "text-red-600" :
                    "text-blue-600"
                  }`}>
                  {executionDetails.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Started</span>
                <span className="font-medium">{formatFullDate(executionDetails.startedAt)}</span>
              </div>
              {executionDetails.finishedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Finished</span>
                  <span className="font-medium">{formatFullDate(executionDetails.finishedAt)}</span>
                </div>
              )}
              {duration !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{duration}s</span>
                </div>
              )}
            </div>

            {/* Error Section */}
            {executionDetails.status === "FAILED" && executionDetails.error && (
              <div className="rounded-md bg-destructive/10 p-4">
                <div className="text-sm font-semibold text-destructive mb-1">Error</div>
                <div className="text-sm text-destructive wrap-break-word break-all whitespace-pre-wrap">
                  {executionDetails.error}
                </div>
              </div>
            )}

            {/* Logs Section */}
            {executionDetails.logs.length > 0 && (
              <div className="space-y-4">
                <div className="text-sm font-semibold">Execution Logs</div>
                <div className={executionDetails.status === "SUCCESS" ? "max-h-[400px] overflow-y-auto space-y-3" : "space-y-3"}>
                  {executionDetails.logs.map((log, index) => (
                    <div key={log.id} className="rounded-md border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                          <span className="text-sm font-medium">{log.nodeType}</span>
                          <span className="text-xs text-muted-foreground font-mono">({log.nodeId})</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(log.createdAt)}
                        </span>
                      </div>
                      {log.input && <JsonPreview label="Input" value={log.input} maxLines={6} />}
                      {log.output && <JsonPreview label="Output" value={log.output} maxLines={8} />}
                      {log.error && (
                        <div className="rounded-md bg-destructive/10 p-2">
                          <div className="text-xs font-semibold text-destructive mb-1">Error</div>
                          <div className="text-xs text-destructive wrap-break-word break-all whitespace-pre-wrap">
                            {log.error}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {executionDetails.logs.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">
                No logs available for this execution
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function RecentExecutions({ executions }: RecentExecutionsProps) {
  const router = useRouter();
  const runningCount = executions.filter((e) => e.status === "RUNNING").length;
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleExecutionClick = (executionId: string) => {
    setSelectedExecutionId(executionId);
    setDialogOpen(true);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    // Reset refreshing state after a reasonable timeout
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            aria-label="View recent executions"
            className="relative h-8 px-3 shadow-none"
            size="sm"
            variant="ghost"
          >
            <CommandLineIcon aria-hidden="true" className={`h-9 w-9`} />
            {/* <span className="text-sm">Executions</span> */}
            {runningCount > 0 && (
              <div
                aria-hidden="true"
                className="absolute top-0.5 right-0.5 size-1 rounded-full bg-primary"
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-1">
          <div className="flex items-center justify-between gap-4 px-3 py-2">
            <div className="font-semibold text-sm">Recent Executions</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-7 w-7 p-0"
              aria-label="Refresh executions"
            >
              <RefreshCwIcon size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </Button>
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
            <div className="max-h-[400px] overflow-y-auto">
              {executions.map((execution) => (
                <Button
                  key={execution.id}
                  variant="ghost"
                  onClick={() => handleExecutionClick(execution.id)}
                  className="w-full justify-start rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent h-auto"
                >
                  <div className="relative flex items-start gap-2 pe-3 w-full">
                    <div className="mt-0.5 shrink-0">
                      {getStatusIcon(execution.status)}
                    </div>
                    <div className="flex-1 space-y-1 min-w-0 text-left">
                      <div className="text-foreground line-clamp-2">
                        <span className="font-medium truncate block">{execution.automation.name}</span>
                        {execution.status === "FAILED" && execution.error && (
                          <span className="text-muted-foreground text-xs line-clamp-1 block mt-0.5">
                            {execution.error}
                          </span>
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
                </Button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
      <ExecutionDialog
        executionId={selectedExecutionId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
