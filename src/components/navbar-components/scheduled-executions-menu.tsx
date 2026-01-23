"use client";

import { useState, useCallback, useEffect } from "react";
import {
  TimerIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  LockIcon,
  RefreshCwIcon,
  FlagIcon,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

const STORAGE_KEY = "scheduled-executions-last-opened";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ExecutionStatus = "RUNNING" | "SUCCESS" | "FAILED";

interface ScheduledExecution {
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

interface ScheduledExecutionsMenuProps {
  isPro: boolean;
  latestScheduledAt: string | null;
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

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "-";
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

const columnHelper = createColumnHelper<ScheduledExecution>();

const columns = [
  columnHelper.accessor("automation.name", {
    header: "Automation",
    cell: (info) => (
      <span className="font-medium truncate max-w-[200px] block">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <div className="flex items-center gap-2">
        {getStatusIcon(info.getValue())}
        <span className="text-sm">{info.getValue()}</span>
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
  columnHelper.accessor("finishedAt", {
    header: "Finished",
    cell: (info) => {
      const value = info.getValue();
      return (
        <span className="text-sm text-muted-foreground">
          {value ? format(new Date(value), "MMM d, HH:mm") : "-"}
        </span>
      );
    },
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

function ProFeatureGate() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <LockIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Pro Feature</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Scheduled execution history is available on Pro and Ultra plans. Upgrade to view your automation run history.
      </p>
      <Button asChild>
        <Link href="/plans">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}

function DataTable({ data }: { data: ScheduledExecution[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No scheduled executions yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ScheduledExecutionsMenu({ isPro, latestScheduledAt }: ScheduledExecutionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [executions, setExecutions] = useState<ScheduledExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Check for unseen executions on mount
  useEffect(() => {
    if (!latestScheduledAt) {
      setHasUnseen(false);
      return;
    }

    const lastOpened = localStorage.getItem(STORAGE_KEY);
    if (!lastOpened) {
      // Never opened before, show notification if there are any executions
      setHasUnseen(true);
      return;
    }

    const lastOpenedDate = new Date(lastOpened).getTime();
    const latestDate = new Date(latestScheduledAt).getTime();
    setHasUnseen(latestDate > lastOpenedDate);
  }, [latestScheduledAt]);

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/executions/scheduled");
      if (!response.ok) {
        throw new Error("Failed to fetch scheduled executions");
      }
      const data = await response.json();
      setExecutions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Mark as seen by saving current timestamp
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setHasUnseen(false);
      if (isPro) {
        fetchExecutions();
      }
    }
  };

  const handleRefresh = async () => {
    if (!isPro) return;
    setIsRefreshing(true);
    await fetchExecutions();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  const handleClearStale = async () => {
    if (!isPro) return;
    setIsClearing(true);
    try {
      await fetch("/api/executions/clear-stale", { method: "POST" });
      await fetchExecutions();
    } finally {
      setIsClearing(false);
    }
  };

  const hasStaleExecutions = executions.some((e) => {
    if (e.status !== "RUNNING") return false;
    const startedAt = new Date(e.startedAt).getTime();
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    return startedAt < tenMinutesAgo;
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          aria-label="View scheduled executions"
          className="relative h-8 px-3 shadow-none"
          size="sm"
          variant="ghost"
        >
          <TimerIcon className="h-6 w-6" />
          {/* <span className="text-sm">Scheduled</span> */}
          {hasUnseen && (
            <div
              aria-hidden="true"
              className="absolute top-0.5 right-0.5 size-2 rounded-full bg-primary"
            />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-3xl sm:min-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle>Scheduled Executions</DialogTitle>
              <DialogDescription>
                History of your scheduled automation runs
              </DialogDescription>
            </div>
            {isPro && (
              <div className="flex items-center gap-1">
                {hasStaleExecutions && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isClearing || loading}
                        className="h-7 w-7 p-0"
                        aria-label="Clear stuck executions"
                      >
                        <FlagIcon size={14} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear Stuck Executions?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will clean up any executions that appear to be stuck or unresponsive.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearStale}>
                          Clear
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing || loading}
                  className="h-7 w-7 p-0"
                  aria-label="Refresh scheduled executions"
                >
                  <RefreshCwIcon size={14} className={isRefreshing ? 'animate-spin' : ''} />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {!isPro ? (
          <ProFeatureGate />
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2Icon className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : error ? (
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <DataTable data={executions} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
