import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Todo, TodoDetails, TodoPriority } from "@/types/todo";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  REMINDER_OPTIONS,
  isPriority,
} from "@/lib/todoDates";
import { addLocalDays, localDateKey } from "@/lib/routineDates";
import { requestReminderPermission } from "@/components/reminders/requestReminderPermission";
import { TimeInput } from "@/components/ui/time-input";

/** Form-friendly version of TodoDetails: "" / "none" instead of undefined. */
export interface TodoDetailsValues {
  dueDate: string;
  dueTime: string;
  priority: TodoPriority | "none";
  reminder: string; // "none" or minutes as a string
}

export const EMPTY_DETAILS: TodoDetailsValues = {
  dueDate: "",
  dueTime: "",
  priority: "none",
  reminder: "none",
};

export function detailsFromTodo(todo: Todo): TodoDetailsValues {
  return {
    dueDate: todo.dueDate ?? "",
    dueTime: todo.dueTime ?? "",
    priority: todo.priority ?? "none",
    reminder:
      todo.reminderMinutes === undefined ? "none" : String(todo.reminderMinutes),
  };
}

/** Every key is present so it can be used as a patch that also clears fields. */
export function toTodoDetails(values: TodoDetailsValues): TodoDetails {
  const hasDate = values.dueDate !== "";
  return {
    dueDate: hasDate ? values.dueDate : undefined,
    dueTime: hasDate && values.dueTime ? values.dueTime : undefined,
    priority: isPriority(values.priority) ? values.priority : undefined,
    reminderMinutes:
      hasDate && values.reminder !== "none" ? Number(values.reminder) : undefined,
  };
}

export function sameDetails(a: TodoDetailsValues, b: TodoDetailsValues) {
  const x = toTodoDetails(a);
  const y = toTodoDetails(b);
  return (
    x.dueDate === y.dueDate &&
    x.dueTime === y.dueTime &&
    x.priority === y.priority &&
    x.reminderMinutes === y.reminderMinutes
  );
}

interface TodoDetailsFieldsProps {
  idPrefix: string;
  values: TodoDetailsValues;
  onChange: (values: TodoDetailsValues) => void;
  className?: string;
}

export function TodoDetailsFields({
  idPrefix,
  values,
  onChange,
  className,
}: TodoDetailsFieldsProps) {
  const hasDate = values.dueDate !== "";
  const today = localDateKey();
  const tomorrow = localDateKey(addLocalDays(new Date(), 1));

  const setDate = (dueDate: string) =>
    onChange(
      dueDate
        ? { ...values, dueDate }
        : { ...values, dueDate: "", dueTime: "", reminder: "none" }
    );

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        <Input
          id={`${idPrefix}-due-date`}
          type="date"
          value={values.dueDate}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 w-[150px] text-sm"
          aria-label="Due date"
        />
        {hasDate ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setDate("")}
            aria-label="Clear due date"
            title="Clear due date"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => setDate(today)}
            >
              Today
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => setDate(tomorrow)}
            >
              Tomorrow
            </Button>
          </>
        )}
      </div>

      <TimeInput
        idPrefix={idPrefix}
        value={values.dueTime}
        onChange={(dueTime) => onChange({ ...values, dueTime })}
        label="Due time"
        disabled={!hasDate}
        title={hasDate ? "Due time (optional)" : "Pick a due date first"}
      />

      <Select
        value={values.priority}
        onValueChange={(v) =>
          onChange({ ...values, priority: v as TodoDetailsValues["priority"] })
        }
      >
        <SelectTrigger size="sm" className="w-[130px]" aria-label="Priority">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No priority</SelectItem>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {PRIORITY_LABELS[p]} priority
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={hasDate ? values.reminder : "none"}
        onValueChange={(v) => {
          onChange({ ...values, reminder: v });
          if (v !== "none") void requestReminderPermission();
        }}
        disabled={!hasDate}
      >
        <SelectTrigger
          size="sm"
          className="w-[170px]"
          aria-label="Reminder"
          title={hasDate ? "Reminder" : "Pick a due date to set a reminder"}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No reminder</SelectItem>
          {REMINDER_OPTIONS.map((o) => (
            <SelectItem key={o.minutes} value={String(o.minutes)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
