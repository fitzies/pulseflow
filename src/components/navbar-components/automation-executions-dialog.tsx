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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { usePathname } from "next/navigation";
import { ClockIcon } from "@heroicons/react/24/solid";

import { Button } from "@/components/ui/button";
import { ExecutionDialog } from "@/components/execution-dialog";
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

const columnHelper = createColumnHelper<Execution>();

const columns = [
  columnHelper.accessor("automation.name", {
    header: "Automation",
    cell: (info) => (
      <span className="font-medium truncate max-w-[200px] block">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("executionType", {
    header: "Type",
    cell: (info) => (
      <span className="text-sm text-muted-foreground">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <div className="flex items-center gap-2">
        <Badge className="flex items-center gap-2" variant={"outline"}>
          {getStatusIcon(info.getValue())}
          <span className="text-sm">
            {info.getValue().substring(0, 1) + info.getValue().substring(1).toLowerCase()}
          </span>
        </Badge>
      </div>
    ),
  }),
  columnHelper.accessor("startedAt", {
    header: "Started",
    cell: (info) => (
      <span className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(info.getValue()), { addSuffix: true })}
      </span>
    ),
  }),
  columnHelper.accessor(
    (row) => formatDuration(row.startedAt, row.finishedAt),
    {
      id: "duration",
      header: "Duration",
      cell: (info) => (
        <span className="text-sm text-muted-foreground">{info.getValue()}</span>
      ),
    }
  ),
  columnHelper.accessor("error", {
    header: "Error",
    cell: (info) => {
      const error = info.getValue();
      if (!error) return <span className="text-muted-foreground">-</span>;
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutomationExecutionsDialog({
  automationId,
  open,
  onOpenChange,
}: AutomationExecutionsDialogProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
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
    }
  }, [open, fetchExecutions]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchExecutions();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  const handleRowClick = (executionId: string) => {
    setSelectedExecutionId(executionId);
    setExecutionDialogOpen(true);
  };

  const filteredData = useMemo(() => {
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
  }, [executions, filter, searchQuery]);

  const emptyMessage = useMemo(() => {
    if (filter === "All") return "No executions yet";
    return `No ${filter.toLowerCase()} executions found`;
  }, [filter]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-full sm:w-full md:min-w-[90rem]">
          <DialogHeader className="flex justify-between">
            <DialogTitle className="text-xl sm:text-2xl font-bold">
              Executions
            </DialogTitle>
            <DialogDescription>
              {automationId
                ? "View and debug executions for this automation"
                : "View and debug all your automation executions"}
            </DialogDescription>
          </DialogHeader>

          {loading && !isRefreshing ? (
            <div className="flex items-center justify-center py-12">
              <Loader2Icon className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : error ? (
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
                  <Select onValueChange={(value) => setFilter(value as FilterType)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="All" defaultValue={"all"} />
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
                  onRowClick={(row) => handleRowClick(row.id)}
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
        </DialogContent>
      </Dialog>

      <ExecutionDialog
        executionId={selectedExecutionId}
        open={executionDialogOpen}
        onOpenChange={setExecutionDialogOpen}
      />
    </>
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
