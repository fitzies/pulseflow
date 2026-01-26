"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { ExecutionDialog } from "@/components/execution-dialog";
import OrginTable from "@/components/origin-table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
          {getStatusIcon(info.getValue())}<span className="text-sm">{info.getValue().substring(0, 1) + info.getValue().substring(1).toLowerCase()}</span>
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
  // columnHelper.accessor("finishedAt", {
  //   header: "Finished",
  //   cell: (info) => {
  //     const value = info.getValue();
  //     return (
  //       <span className="text-sm text-muted-foreground">
  //         {value ? format(new Date(value), "MMM d, HH:mm") : "-"}
  //       </span>
  //     );
  //   },
  // }),
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

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("All");

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/executions");
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
  }, []);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchExecutions();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  const handleRowClick = (executionId: string) => {
    setSelectedExecutionId(executionId);
    setDialogOpen(true);
  };

  const filteredData = useMemo(() => {
    if (filter === "All") return executions;
    return executions.filter((e) => e.executionType === filter);
  }, [executions, filter]);

  const emptyMessage = useMemo(() => {
    if (filter === "All") return "No executions yet";
    return `No ${filter.toLowerCase()} executions found`;
  }, [filter]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Executions</h1>
            <p className="text-muted-foreground text-sm mt-1">
              View and manage all your automation executions
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="h-8"
          >
            <RefreshCwIcon size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {/* <span className="ml-2">Refresh</span> */}
          </Button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          {(["All", "Normal", "Scheduled", "Price Triggered"] as FilterType[]).map((filterType) => (
            <Button
              key={filterType}
              variant={filter === filterType ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(filterType)}
              className="h-8"
            >
              {filterType}
            </Button>
          ))}
        </div>
      </div>

      {loading && !isRefreshing ? (
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : error ? (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <Card>
          <CardContent>
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
            />
          </CardContent>
        </Card>
      )}

      <ExecutionDialog
        executionId={selectedExecutionId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
