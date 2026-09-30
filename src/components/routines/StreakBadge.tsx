import { Flame, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeStreak, formatPeriodCount } from "@/lib/routineDates";
import type { RoutineTask } from "@/types/routine";

interface StreakBadgeProps {
  task: RoutineTask;
  className?: string;
}

/** "5 days · best 12" style streak summary for one routine. */
export function StreakBadge({ task, className }: StreakBadgeProps) {
  const { current, best } = computeStreak(task.frequency, task.completions);
  if (best === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        No streak yet
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs text-muted-foreground",
        className
      )}
      aria-label={`Current streak ${formatPeriodCount(
        task.frequency,
        current
      )}, best ${formatPeriodCount(task.frequency, best)}`}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1",
          current > 0 && "text-foreground font-medium"
        )}
        title="Current streak"
      >
        <Flame
          className={cn("h-3.5 w-3.5", current > 0 && "text-orange-500")}
          aria-hidden
        />
        {formatPeriodCount(task.frequency, current)}
      </span>
      <span className="inline-flex items-center gap-1" title="Best streak">
        <Trophy className="h-3.5 w-3.5" aria-hidden />
        best {best}
      </span>
    </span>
  );
}
