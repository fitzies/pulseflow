import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";

interface SuccessRateCardProps {
  totalSuccessRate: number;
}

export function SuccessRateCard({
  totalSuccessRate,
}: SuccessRateCardProps) {
  return (
    <div className="flex flex-col gap-3 col-span-1 w-full">
      <p className="ml-1">Success Rate</p>
      <Card className="col-span-1 shadow-none bg-stone-900/60 self-start md:block hidden w-full">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <p className="text-sm">{totalSuccessRate}%</p>
          </div>
          <Progress value={totalSuccessRate} className="h-2" />
        </CardContent>
      </Card>
    </div>
  );
}
