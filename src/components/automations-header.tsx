"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { CreateAutomationDialog } from "@/components/create-automation-dialog";
import AutomationCards from "@/components/automation-cards";
import { Prisma, TriggerMode } from "@prisma/client";
import { Card, CardContent } from "./ui/card";
import { formatUnits } from "ethers";

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
}: AutomationsHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

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
        <div className="w-full grid grid-cols-3 gap-4 items-start">
          <Card className="col-span-1 shadow-none bg-stone-900/60 self-start">
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Total Automations</p>
                <p className="text-sm">{currentCount}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-sm">{scheduledAutomations}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Total Executions</p>
                <p className="text-sm">{totalExecutions}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Failed Executions</p>
                <p className="text-sm">{failedExecutions}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Last Execution</p>
                <p className="text-sm">
                  {lastExecutionTime
                    ? new Date(lastExecutionTime).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                    : "--"}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-sm">{totalSuccessRate}%</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Total PLS Balance</p>
                <p className="text-sm">
                  {Number(formatUnits(totalPlsBalance, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} PLS
                </p>
              </div>
            </CardContent>
          </Card>
          <AutomationCards automations={filteredAutomations} userPlan={userPlan} />
        </div>
      )}

      {/* No Results Message */}
      {searchQuery.trim() && filteredAutomations.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            No automations found matching "{searchQuery}"
          </p>
        </div>
      )}
    </>
  );
}
