"use client";

import { useState, useCallback, useEffect } from "react";
import {
  TimerIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  LockIcon,
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          aria-label="View scheduled executions"
          className="relative size-8 rounded-full text-muted-foreground shadow-none"
          size="icon"
          variant="ghost"
        >
          <TimerIcon className="h-5 w-5" />
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
          <DialogTitle>Scheduled Executions</DialogTitle>
          <DialogDescription>
            History of your scheduled automation runs
          </DialogDescription>
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
