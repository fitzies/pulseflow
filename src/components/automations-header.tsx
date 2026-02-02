"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { CreateAutomationDialog } from "@/components/create-automation-dialog";
import AutomationCards from "@/components/automation-cards";
import { Prisma, TriggerMode } from "@prisma/client";
import { ExecutionDialog } from "@/components/execution-dialog";
import { AutomationStatsCard } from "@/components/automation-stats-card";
import { SuccessRateCard } from "@/components/success-rate-card";
import { RecentExecutionsCard } from "@/components/recent-executions-card";

type AutomationWithStats = {
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

interface AutomationsHeaderProps {
  automations: AutomationWithStats[];
  hasPlan: boolean;
  canCreateMore: boolean;
  currentCount: number;
  planLimit: number | null;
  userPlan: "BASIC" | "PRO" | "ULTRA" | null;
  automationNames: Array<{ id: string; name: string }>;
  totalSuccessRate: number;
  totalPlsBalance: string;
  scheduledAutomations: number;
  totalExecutions: number;
  failedExecutions: number;
  lastExecutionTime: Date | null;
  recentExecutions: Array<{
    id: string;
    status: "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
    automation: {
      id: string;
      name: string;
    };
  }>;
}

export default function AutomationsHeader({
  automations,
  hasPlan,
  canCreateMore,
  currentCount,
  planLimit,
  userPlan,
  automationNames,
  totalSuccessRate,
  totalPlsBalance,
  scheduledAutomations,
  totalExecutions,
  failedExecutions,
  lastExecutionTime,
  recentExecutions,
}: AutomationsHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredAutomations = useMemo(() => {
    if (!searchQuery.trim()) {
      return automations;
    }
    const query = searchQuery.toLowerCase();
    return automations.filter((automation) =>
      automation.name.toLowerCase().includes(query)
    );
  }, [automations, searchQuery]);

  return (
    <>
      {/* Header with Search Input and Create Button */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Input
          type="text"
          placeholder="Search automations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <CreateAutomationDialog
          hasPlan={hasPlan}
          canCreateMore={canCreateMore}
          currentCount={currentCount}
          limit={planLimit}
          automations={automationNames}
        />
      </div>

      {/* Automation Cards */}
      {filteredAutomations.length > 0 && (
        <div className="w-full grid grid-cols-4 gap-6 items-start">
          <div className="flex flex-col gap-3 col-span-1 w-full">
            <AutomationStatsCard
              currentCount={currentCount}
              scheduledAutomations={scheduledAutomations}
              totalExecutions={totalExecutions}
              failedExecutions={failedExecutions}
              lastExecutionTime={lastExecutionTime}
              totalPlsBalance={totalPlsBalance}
            />
            <SuccessRateCard totalSuccessRate={totalSuccessRate} />
            <RecentExecutionsCard
              recentExecutions={recentExecutions}
              onExecutionClick={(executionId) => {
                setSelectedExecutionId(executionId);
                setDialogOpen(true);
              }}
            />
          </div>
          <div className="flex flex-col w-full col-span-3 gap-3">
            <p className="ml-1">Automations</p>
            <AutomationCards automations={filteredAutomations} userPlan={userPlan} />
          </div>
        </div>
      )
      }

      {/* No Results Message */}
      {
        searchQuery.trim() && filteredAutomations.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              No automations found matching "{searchQuery}"
            </p>
          </div>
        )
      }

      {/* Execution Dialog */}
      <ExecutionDialog
        executionId={selectedExecutionId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
