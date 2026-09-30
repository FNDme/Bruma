import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressCardProps {
  title: string;
  emoji: string;
  completed: number;
  total: number;
}

export function ProgressCard({ title, emoji, completed, total }: ProgressCardProps) {
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  const allDone = total > 0 && completed === total;
  return (
    <Card
      className={cn(allDone && "border-green-500 shadow-lg transition-all duration-300")}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {allDone && <span className="text-green-500">{emoji}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {completed} of {total} tasks completed
            </span>
            <span className={cn("text-sm font-medium", allDone && "text-green-500")}>
              {percentage}%
            </span>
          </div>
          <Progress
            value={percentage}
            className={cn("h-2", allDone && "bg-green-500/20 [&>div]:bg-green-500")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
