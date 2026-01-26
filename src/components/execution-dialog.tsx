"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  CopyIcon,
  CheckIcon,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ExecutionStatus = "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

interface Execution {
  id: string;
  status: ExecutionStatus;
  error: string | null;
  startedAt: string;
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

export function ExecutionDialog({
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
            {/* {executionDetails && getStatusIcon(executionDetails.status)} */}
            <span>Execution Details</span>
          </DialogTitle>
          {/* <DialogDescription className="wrap-break-word">
            {executionDetails?.automation.name}
          </DialogDescription> */}
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
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium ${executionDetails.status === "SUCCESS" ? "text-green-600" :
                  executionDetails.status === "FAILED" ? "text-red-400" :
                    executionDetails.status === "CANCELLED" ? "text-yellow-600" :
                      "text-blue-600"
                  }`}>
                  {executionDetails.status}
                </span>
              </div>
            </div>

            {/* Error Section */}
            {executionDetails.status === "FAILED" && executionDetails.error && (
              <div className="rounded-md bg-destructive/10 p-4">
                <div className="text-sm font-semibold text-red-400 mb-1">Error</div>
                <div className="text-sm text-red-400 wrap-break-word break-all whitespace-pre-wrap">
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
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
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
