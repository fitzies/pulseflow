"use client";

import { useState } from "react";
import { TriggerMode, Prisma } from "@prisma/client";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import Link from "next/link";
import {
  MoreHorizontal,
  Zap,
  Share2,
  Copy,
  Settings,
  Heart,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";
import { AutomationExecutionsDialog } from "./navbar-components/automation-executions-dialog";
import { duplicateAutomation } from "@/lib/actions/automations";
import { createShareCode } from "@/lib/actions/automations";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { useIconPreference } from "@/hooks/use-icon-preference";

type AutomationWithExecutions = {
  id: string;
  name: string;
  definition: Prisma.JsonValue;
  triggerMode: TriggerMode;
  nextRunAt: Date | null;
  isActive: boolean;
  defaultSlippage: number | null;
  rpcEndpoint: string | null;
  showNodeLabels: boolean;
  betaFeatures: boolean;
  communityVisible: boolean;
  isFavorite: boolean;
  executions: Array<{
    id: string;
    status: string;
  }>;
  _count: {
    executions: number;
  };
  successCount: number;
};

function AutomationRow({
  automation,
  userPlan,
  isLast,
}: {
  automation: AutomationWithExecutions;
  userPlan: "BASIC" | "PRO" | "ULTRA" | null;
  isLast: boolean;
}) {
  const router = useRouter();
  const { iconStyle } = useIconPreference();
  const [executionsDialogOpen, setExecutionsDialogOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isFavorite, setIsFavorite] = useState(automation.isFavorite);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const isRunning = automation.executions.length > 0;
  const isScheduled =
    automation.triggerMode === "SCHEDULE" && automation.nextRunAt;
  const totalExecutions = automation._count.executions;
  const successRate =
    totalExecutions > 0
      ? Math.round((automation.successCount / totalExecutions) * 100)
      : null;

  const formatNextRun = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleShare = async () => {
    try {
      const result = await createShareCode(automation.definition);
      if (result.success && result.shareString) {
        await navigator.clipboard.writeText(result.shareString);
        toast.success("Share code copied to clipboard!");
      } else {
        toast.error(result.error || "Failed to generate share code");
      }
    } catch {
      toast.error("Failed to share automation");
    }
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const result = await duplicateAutomation(
        automation.id,
        `${automation.name} (Copy)`,
        false
      );
      if (result.success) {
        toast.success("Automation duplicated!");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to duplicate");
      }
    } catch {
      toast.error("Failed to duplicate automation");
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/automations/${automation.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete automation");
      }
      toast.success("Automation deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const handleToggleFavorite = async () => {
    setIsTogglingFavorite(true);
    const newValue = !isFavorite;
    setIsFavorite(newValue); // Optimistic update
    try {
      const response = await fetch(
        `/api/automations/${automation.id}/favorite`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFavorite: newValue }),
        }
      );
      if (!response.ok) {
        setIsFavorite(!newValue); // Revert on error
        throw new Error("Failed to update favorite");
      }
      toast.success(newValue ? "Added to favorites" : "Removed from favorites");
    } catch {
      toast.error("Failed to update favorite");
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  return (
    <>
      <div
        className="flex flex-col gap-3 cursor-pointer"
        onClick={() => {
          router.push(`/automations/${automation.id}`);
        }}
      >
        <div className="flex items-center justify-between">
          <Link
            href={`/automations/${automation.id}`}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border">
              <img src={`https://api.dicebear.com/9.x/${iconStyle}/svg?seed=${automation.id}`} className="rounded-lg" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{automation.name}</span>
              <span className="text-muted-foreground text-sm">
                <span className="md:hidden">{automation.id.slice(0, 8)}...</span>
                <span className="hidden md:inline">{automation.id}</span>
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {isFavorite && (
              <HoverCard>
                <HoverCardTrigger>
                  <Star className="hidden md:block h-4 w-4 fill-yellow-500 text-yellow-500" />
                </HoverCardTrigger>
                <HoverCardContent>
                  <p className="text-sm">Favorite</p>
                </HoverCardContent>
              </HoverCard>
            )}
            <HoverCard>
              <HoverCardTrigger>
                <div className="hidden md:flex items-center gap-1 text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <span className="text-sm">0</span>
                </div>
              </HoverCardTrigger>
              <HoverCardContent>
                <p className="text-sm">Community likes</p>
              </HoverCardContent>
            </HoverCard>
            <HoverCard>
              <HoverCardTrigger>
                <span className="hidden md:inline text-sm text-muted-foreground">
                  {successRate !== null ? `${successRate}%` : "--"}
                </span>
              </HoverCardTrigger>
              <HoverCardContent>
                <p className="text-sm">Success rate</p>
              </HoverCardContent>
            </HoverCard>
            <Badge
              variant={
                isRunning
                  ? "default"
                  : automation.isActive
                    ? "secondary"
                    : isScheduled
                      ? "secondary"
                      : "outline"
              }
            >
              {isRunning
                ? "Running"
                : automation.isActive
                  ? "Active"
                  : isScheduled
                    ? `Scheduled ${formatNextRun(automation.nextRunAt!)}`
                    : "Inactive"}
            </Badge>
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare();
                    }}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate();
                    }}
                    disabled={isDuplicating}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {isDuplicating ? "Duplicating..." : "Duplicate"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite();
                    }}
                    disabled={isTogglingFavorite}
                  >
                    <Star
                      className={`h-4 w-4 mr-2 ${isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`}
                    />
                    {isFavorite ? "Unfavorite" : "Favorite"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/automations/${automation.id}/settings`);
                    }}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        {!isLast && <Separator />}
      </div>

      <AutomationExecutionsDialog
        automationId={automation.id}
        open={executionsDialogOpen}
        onOpenChange={setExecutionsDialogOpen}
      />
    </>
  );
}

export default function AutomationCards({
  automations,
  userPlan,
}: {
  automations: AutomationWithExecutions[];
  userPlan: "BASIC" | "PRO" | "ULTRA" | null;
}) {
  return (
    <Card className="shadow-none bg-stone-900/60 md:col-span-3 col-span-4">
      <CardContent className="flex flex-col gap-3">
        {automations.map((automation, index) => (
          <AutomationRow
            key={automation.id}
            automation={automation}
            userPlan={userPlan}
            isLast={index === automations.length - 1}
          />
        ))}
      </CardContent>
    </Card>
  );
}
