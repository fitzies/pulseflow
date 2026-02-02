import { Card, CardContent } from "./ui/card";
import { formatUnits } from "ethers";

interface AutomationStatsCardProps {
  currentCount: number;
  scheduledAutomations: number;
  totalExecutions: number;
  failedExecutions: number;
  lastExecutionTime: Date | null;
  totalPlsBalance: string;
}

export function AutomationStatsCard({
  currentCount,
  scheduledAutomations,
  totalExecutions,
  failedExecutions,
  lastExecutionTime,
  totalPlsBalance,
}: AutomationStatsCardProps) {
  return (
    <div className="flex flex-col gap-3 col-span-1 w-full">
      <p className="ml-1">Stats</p>
      <Card className="col-span-1 shadow-none bg-stone-900/60 self-start md:block hidden w-full">
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
            <p className="text-sm text-muted-foreground">Total PLS Balance</p>
            <p className="text-sm">
              {Number(formatUnits(totalPlsBalance, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} PLS
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
