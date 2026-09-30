import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { RoutineFrequency, RoutineTask } from "@/types/routine";
import { StreakBadge } from "./StreakBadge";
import { Bell } from "lucide-react";
import { describeRoutineReminder } from "@/lib/reminders";

const TITLES: Record<RoutineFrequency, string> = {
  daily: "Daily Tasks",
  weekly: "Weekly Tasks",
  monthly: "Monthly Tasks",
};

interface FrequencySectionProps {
  frequency: RoutineFrequency;
  tasks: RoutineTask[];
  onToggle: (taskId: string) => void;
}

export function FrequencySection({
  frequency,
  tasks,
  onToggle,
}: FrequencySectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLES[frequency]}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              id={`routine-row-${task.id}`}
              className="flex items-start gap-3"
            >
              <Checkbox
                id={`routine-${task.id}`}
                checked={task.completed}
                onCheckedChange={() => onToggle(task.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <label
                  htmlFor={`routine-${task.id}`}
                  className={cn(
                    "block text-sm font-medium leading-snug cursor-pointer",
                    task.completed && "line-through text-muted-foreground"
                  )}
                >
                  {task.title}
                </label>
                {task.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line break-words">
                    {task.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StreakBadge task={task} />
                  {describeRoutineReminder(task) && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Bell className="h-3 w-3" aria-hidden />
                      {describeRoutineReminder(task)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No {frequency} tasks set
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
