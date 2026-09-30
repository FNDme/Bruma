/**
 * Due dates, priorities and grouping for todos. All dates use the LOCAL
 * calendar (see routineDates.ts for the same convention).
 */
import type { Todo, TodoPriority } from "@/types/todo";
import { addLocalDays, localDateKey, parseLocalDateKey } from "./routineDates";

/** Time used for reminders when a todo has a due date but no due time. */
export const DEFAULT_DUE_TIME = "09:00";

export const PRIORITIES: TodoPriority[] = ["high", "medium", "low"];

export const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Higher number sorts first. No priority sorts last. */
export function priorityRank(priority?: TodoPriority): number {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

export function isPriority(value: unknown): value is TodoPriority {
  return value === "high" || value === "medium" || value === "low";
}

export const REMINDER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 0, label: "At due time" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 24 * 60, label: "1 day before" },
];

export function isReminderMinutes(value: unknown): value is number {
  return REMINDER_OPTIONS.some((o) => o.minutes === value);
}

export function reminderLabel(minutes: number): string {
  return (
    REMINDER_OPTIONS.find((o) => o.minutes === minutes)?.label ??
    `${minutes} minutes before`
  );
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && parseLocalDateKey(value) !== null;
}

export function isTimeKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

/** Local Date for "YYYY-MM-DD" + "HH:MM", or null when invalid. */
export function combineLocal(dateKey: string, time: string): Date | null {
  const day = parseLocalDateKey(dateKey);
  if (!day || !isTimeKey(time)) return null;
  const [h, m] = time.split(":").map(Number);
  day.setHours(h, m, 0, 0);
  return day;
}

/**
 * The moment a todo is due. With no due time this is the END of the due date
 * (so a date-only task is overdue only from the next day).
 */
export function todoDueAt(todo: Pick<Todo, "dueDate" | "dueTime">): Date | null {
  if (!todo.dueDate) return null;
  if (todo.dueTime) return combineLocal(todo.dueDate, todo.dueTime);
  const day = parseLocalDateKey(todo.dueDate);
  if (!day) return null;
  day.setHours(23, 59, 59, 999);
  return day;
}

/** When the reminder for a todo should fire, or null when it has none. */
export function todoReminderAt(
  todo: Pick<Todo, "dueDate" | "dueTime" | "reminderMinutes">
): Date | null {
  if (!todo.dueDate || todo.reminderMinutes === undefined) return null;
  const base = combineLocal(todo.dueDate, todo.dueTime ?? DEFAULT_DUE_TIME);
  if (!base) return null;
  return new Date(base.getTime() - todo.reminderMinutes * 60_000);
}

export function isOverdue(todo: Todo, now = new Date()): boolean {
  if (todo.completed) return false;
  const due = todoDueAt(todo);
  return !!due && due.getTime() < now.getTime();
}

export type DueGroup =
  | "overdue"
  | "today"
  | "tomorrow"
  | "week"
  | "later"
  | "none";

export const DUE_GROUP_LABELS: Record<DueGroup, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "Next 7 days",
  later: "Later",
  none: "No due date",
};

export const DUE_GROUP_ORDER: DueGroup[] = [
  "overdue",
  "today",
  "tomorrow",
  "week",
  "later",
  "none",
];

export function dueGroup(todo: Todo, now = new Date()): DueGroup {
  if (!todo.dueDate || !isDateKey(todo.dueDate)) return "none";
  if (isOverdue(todo, now)) return "overdue";
  const today = localDateKey(now);
  if (todo.dueDate <= today) return "today";
  if (todo.dueDate === localDateKey(addLocalDays(now, 1))) return "tomorrow";
  if (todo.dueDate <= localDateKey(addLocalDays(now, 7))) return "week";
  return "later";
}

/** Earlier due first; undated last. Ties: higher priority, then oldest. */
export function compareByDue(a: Todo, b: Todo): number {
  const da = todoDueAt(a)?.getTime() ?? Infinity;
  const db = todoDueAt(b)?.getTime() ?? Infinity;
  if (da !== db) return da < db ? -1 : 1;
  const p = priorityRank(b.priority) - priorityRank(a.priority);
  if (p !== 0) return p;
  return a.createdAt - b.createdAt;
}

/** Higher priority first. Ties: earlier due, then oldest. */
export function compareByPriority(a: Todo, b: Todo): number {
  const p = priorityRank(b.priority) - priorityRank(a.priority);
  if (p !== 0) return p;
  return compareByDue(a, b);
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function formatTime(time: string): string {
  const d = combineLocal("2000-01-01", time);
  return d ? timeFormat.format(d) : time;
}

/** "Today", "Tomorrow", "Yesterday", "Mon, Oct 6" or "Oct 6, 2027", plus the time if set. */
export function formatDue(
  todo: Pick<Todo, "dueDate" | "dueTime">,
  now = new Date()
): string {
  if (!todo.dueDate) return "";
  const day = parseLocalDateKey(todo.dueDate);
  if (!day) return "";
  const today = localDateKey(now);
  let label: string;
  if (todo.dueDate === today) label = "Today";
  else if (todo.dueDate === localDateKey(addLocalDays(now, 1)))
    label = "Tomorrow";
  else if (todo.dueDate === localDateKey(addLocalDays(now, -1)))
    label = "Yesterday";
  else if (day.getFullYear() === now.getFullYear())
    label = day.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  else
    label = day.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return todo.dueTime ? `${label}, ${formatTime(todo.dueTime)}` : label;
}
