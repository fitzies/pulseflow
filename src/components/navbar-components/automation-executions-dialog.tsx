"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  RefreshCwIcon,
  ArrowLeftIcon,
  CopyIcon,
  CheckIcon,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { usePathname } from "next/navigation";
import { ClockIcon } from "@heroicons/react/24/solid";

import { Button } from "@/components/ui/button";
import OrginTable from "@/components/origin-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ExecutionStatus = "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
type ExecutionType = "Normal" | "Scheduled" | "Price Triggered";

interface Execution {
  id: string;
  status: ExecutionStatus;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  automation: {
    id: string;
    name: string;
    triggerMode: "MANUAL" | "SCHEDULE" | "PRICE_TRIGGER";
  };
  executionType: ExecutionType;
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

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "-";
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
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

const columnHelper = createColumnHelper<Execution>();

// Helper function to check if a value is empty/null (for skeleton detection)
function isEmpty(value: any): boolean {
  return value === null || value === undefined || value === "" || (typeof value === "string" && value.trim() === "");
}

const columns = [
  columnHelper.accessor("automation.name", {
    header: "Automation",
    cell: (info) => {
      const value = info.getValue();
      if (isEmpty(value)) {
        return <div className="bg-stone-800 animate-pulse rounded-md h-4 w-32" />;
      }
      return (
        <span className="font-medium truncate max-w-[200px] block">
          {value}
        </span>
      );
    },
  }),
  columnHelper.accessor("executionType", {
    header: "Type",
    cell: (info) => {
      const value = info.getValue();
      if (isEmpty(value)) {
        return <div className="bg-stone-800 animate-pulse rounded-md h-4 w-20" />;
      }
      return (
        <span className="text-sm text-muted-foreground">{value}</span>
      );
    },
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const value = info.getValue();
      if (isEmpty(value)) {
        return <div className="bg-stone-800 animate-pulse rounded-md h-6 w-24" />;
      }
      return (
        <div className="flex items-center gap-2">
          <Badge className="flex items-center gap-2" variant={"outline"}>
            {getStatusIcon(value)}
            <span className="text-sm">
              {value.substring(0, 1) + value.substring(1).toLowerCase()}
            </span>
          </Badge>
        </div>
      );
    },
  }),
  columnHelper.accessor("startedAt", {
    header: "Started",
    cell: (info) => {
      const value = info.getValue();
      if (isEmpty(value)) {
        return <div className="bg-stone-800 animate-pulse rounded-md h-4 w-28" />;
      }
      return (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(value), { addSuffix: true })}
        </span>
      );
    },
  }),
  columnHelper.accessor(
    (row) => {
      if (isEmpty(row.startedAt)) {
        return "";
      }
      return formatDuration(row.startedAt, row.finishedAt);
    },
    {
      id: "duration",
      header: "Duration",
      cell: (info) => {
        const value = info.getValue();
        if (isEmpty(value) || value === "-") {
          return <div className="bg-stone-800 animate-pulse rounded-md h-4 w-16" />;
        }
        return (
          <span className="text-sm text-muted-foreground">{value}</span>
        );
      },
    }
  ),
  columnHelper.accessor("error", {
    header: "Error",
    cell: (info) => {
      const error = info.getValue();
      const isSkeletonRow = info.row.original.id.startsWith("skeleton-");

      // Only show skeleton if it's actually a skeleton row (loading state)
      // If it's real data with null/empty error, show "-" (successful execution)
      if (isEmpty(error) && isSkeletonRow) {
        return <div className="bg-stone-800 animate-pulse rounded-md h-4 w-12" />;
      }

      // Real data: show "-" for no error, or the error text
      if (!error) {
        return <span className="text-muted-foreground">-</span>;
      }

      return (
        <span className="text-sm text-red-500 truncate max-w-[150px] block" title={error}>
          {error}
        </span>
      );
    },
  }),
];

type FilterType = "All" | ExecutionType;

interface AutomationExecutionsDialogProps {
  automationId?: string;
  initialExecutionId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutomationExecutionsDialog({
  automationId,
  initialExecutionId,
  open,
  onOpenChange,
}: AutomationExecutionsDialogProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [executionDetails, setExecutionDetails] = useState<ExecutionDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = automationId
        ? `/api/executions?automationId=${automationId}`
        : `/api/executions`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch executions");
      }
      const data = await response.json();
      setExecutions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [automationId]);

  useEffect(() => {
    if (open) {
      fetchExecutions();
      // If initialExecutionId is provided, open directly to that execution's detail view
      if (initialExecutionId) {
        setView("detail");
        setSelectedExecutionId(initialExecutionId);
        fetchExecutionDetails(initialExecutionId);
      } else {
        // Reset view when dialog opens without initial execution
        setView("list");
        setSelectedExecutionId(null);
        setExecutionDetails(null);
      }
    }
  }, [open, fetchExecutions, initialExecutionId]);

  const fetchExecutionDetails = useCallback(async (id: string) => {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const response = await fetch(`/api/executions/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch execution details");
      }
      const data = await response.json();
      setExecutionDetails(data);
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to load execution details");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchExecutions();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  const handleRowClick = (executionId: string) => {
    setSelectedExecutionId(executionId);
    setView("detail");
    fetchExecutionDetails(executionId);
  };

  const handleBackClick = () => {
    setView("list");
    setSelectedExecutionId(null);
    setExecutionDetails(null);
    setDetailsError(null);
  };

  // Generate skeleton rows for loading state
  const skeletonRows = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => ({
      id: `skeleton-${i}`,
      status: "" as ExecutionStatus,
      error: null,
      startedAt: "",
      finishedAt: null,
      automation: {
        id: "",
        name: "",
        triggerMode: "MANUAL" as const,
      },
      executionType: "" as ExecutionType,
    }));
  }, []);

  const filteredData = useMemo(() => {
    // If loading, return skeleton rows
    if (loading && !isRefreshing) {
      return skeletonRows;
    }

    let result = executions;

    // Apply type filter
    if (filter !== "All") {
      result = result.filter((e) => e.executionType === filter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((e) =>
        e.automation.name.toLowerCase().includes(query) ||
        e.error?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [executions, filter, searchQuery, loading, isRefreshing, skeletonRows]);

  const emptyMessage = useMemo(() => {
    if (filter === "All") return "No executions yet";
    return `No ${filter.toLowerCase()} executions found`;
  }, [filter]);

  const duration = executionDetails?.finishedAt && executionDetails?.startedAt
    ? Math.round((new Date(executionDetails.finishedAt).getTime() - new Date(executionDetails.startedAt).getTime()) / 1000)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:w-full md:min-w-[70rem]">
        <DialogHeader className="flex justify-between">
          <div className="flex items-center gap-2">
            {view === "detail" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackClick}
                className="h-8 w-8 p-0"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-xl sm:text-2xl font-bold">
              {view === "detail" ? "Execution Details" : "Executions"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {view === "detail"
              ? executionDetails?.automation.name
              : automationId
                ? "View and debug executions for this automation"
                : "View and debug all your automation executions"}
          </DialogDescription>
        </DialogHeader>

        {view === "list" ? (
          <>
            {error ? (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : (
              <Card className="bg-transparent">
                {/* Filters and Search */}
                <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <Input
                    placeholder="Search executions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:max-w-sm"
                  />
                  <div className="flex gap-2 flex-wrap sm:ml-auto">
                    <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="Price Triggered">Price Triggered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <OrginTable
                    columns={columns as ColumnDef<Execution, any>[]}
                    data={filteredData}
                    onRowClick={(row) => {
                      // Prevent clicking on skeleton rows
                      if (!row.id.startsWith("skeleton-")) {
                        handleRowClick(row.id);
                      }
                    }}
                    enableSelection={false}
                    enablePagination={true}
                    enableFilters={false}
                    enableColumnVisibility={true}
                    initialPageSize={10}
                    emptyMessage={emptyMessage}
                    allowPageSizeChange={false}
                  />
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <>
            {detailsLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2Icon className="animate-spin text-muted-foreground" size={24} />
              </div>
            )}

            {detailsError && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive wrap-break-word break-all whitespace-pre-wrap">
                {detailsError}
              </div>
            )}

            {executionDetails && !detailsLoading && (
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
        className="rounded-full aspect-square cursor-pointer w-9 h-9"
        onClick={() => setDialogOpen(true)}
      >
        <ClockIcon className="h-5 w-5" />
      </Button>
      <AutomationExecutionsDialog
        automationId={undefined}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
