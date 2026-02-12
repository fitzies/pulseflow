import { Card, CardContent } from "./ui/card";
import { formatUnits } from "ethers";

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs} sec${diffSecs === 1 ? "" : "s"} ago`;
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function formatTokenBalance(balance: number): string {
  if (balance >= 1000) {
    return `${(balance / 1000).toFixed(1)}k`;
  }
  return balance.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

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
                ? formatRelativeTime(new Date(lastExecutionTime))
                : "--"}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total PLS Balance</p>
            <p className="text-sm">
              {formatTokenBalance(Number(formatUnits(totalPlsBalance, 18)))} PLS
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
