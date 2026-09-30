/**
 * Pure reminder computation for todos and routines.
 *
 * The scheduler remembers when it last looked (`lastCheckedAt`) and fires
 * every reminder whose moment falls in (lastCheckedAt, now]. Each moment falls
 * in exactly one window, so nothing fires twice, reminders that came due while
 * the app was closed or the computer slept fire once on the next check, and a
 * reminder that is already in the past when it is created does not fire.
 */
import type { RoutineFrequency, RoutineTask } from "@/types/routine";
import type { Todo } from "@/types/todo";
import {
  addLocalDays,
  localDateKey,
  periodKey,
  startOfIsoWeek,
  startOfLocalDay,
} from "./routineDates";
import {
  combineLocal,
  formatDue,
  isTimeKey,
  todoReminderAt,
} from "./todoDates";

export const DEFAULT_WEEKLY_REMINDER_DAY = 1; // Monday
export const DEFAULT_MONTHLY_REMINDER_DAY = 1;

/** Catch-up limit: reminders older than this are not fired after a long gap. */
export const MAX_CATCH_UP_MS = 3 * 24 * 60 * 60 * 1000;

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function isReminderDay(
  frequency: RoutineFrequency,
  value: unknown
): value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  if (frequency === "weekly") return value >= 0 && value <= 6;
  if (frequency === "monthly") return value >= 1 && value <= 31;
  return false;
}

export function defaultReminderDay(frequency: RoutineFrequency): number | undefined {
  if (frequency === "weekly") return DEFAULT_WEEKLY_REMINDER_DAY;
  if (frequency === "monthly") return DEFAULT_MONTHLY_REMINDER_DAY;
  return undefined;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Day of the routine's reminder inside the period containing `now`. */
function reminderDayInPeriod(
  task: Pick<RoutineTask, "frequency" | "reminderDay">,
  now: Date
): Date {
  switch (task.frequency) {
    case "daily":
      return startOfLocalDay(now);
    case "weekly": {
      const weekday = isReminderDay("weekly", task.reminderDay)
        ? task.reminderDay
        : DEFAULT_WEEKLY_REMINDER_DAY;
      // ISO weeks start on Monday: Mon=0 ... Sun=6.
      return addLocalDays(startOfIsoWeek(now), (weekday + 6) % 7);
    }
    case "monthly": {
      const wanted = isReminderDay("monthly", task.reminderDay)
        ? task.reminderDay
        : DEFAULT_MONTHLY_REMINDER_DAY;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return new Date(now.getFullYear(), now.getMonth(), Math.min(wanted, lastDay));
    }
  }
}

/** The reminder moment for the current period, or null when none is set. */
export function routineReminderAt(
  task: Pick<RoutineTask, "frequency" | "reminderDay" | "reminderTime">,
  now = new Date()
): Date | null {
  if (!task.reminderTime || !isTimeKey(task.reminderTime)) return null;
  return combineLocal(
    localDateKey(reminderDayInPeriod(task, now)),
    task.reminderTime
  );
}

/** Short description such as "Mondays at 9:00 AM" or "Daily at 8:30 PM". */
export function describeRoutineReminder(
  task: Pick<RoutineTask, "frequency" | "reminderDay" | "reminderTime">
): string | null {
  if (!task.reminderTime || !isTimeKey(task.reminderTime)) return null;
  const time =
    combineLocal("2000-01-01", task.reminderTime)?.toLocaleTimeString(
      undefined,
      { hour: "numeric", minute: "2-digit" }
    ) ?? task.reminderTime;
  switch (task.frequency) {
    case "daily":
      return `Daily at ${time}`;
    case "weekly": {
      const weekday = isReminderDay("weekly", task.reminderDay)
        ? task.reminderDay
        : DEFAULT_WEEKLY_REMINDER_DAY;
      return `${WEEKDAY_LABELS[weekday]}s at ${time}`;
    }
    case "monthly": {
      const day = isReminderDay("monthly", task.reminderDay)
        ? task.reminderDay
        : DEFAULT_MONTHLY_REMINDER_DAY;
      return `On the ${ordinal(day)} at ${time}`;
    }
  }
}

function dueBody(todo: Todo, now: Date): string {
  const due = formatDue(todo, now);
  // "Due today, 3:00 PM" reads better than "Due Today, 3:00 PM".
  return /^(Today|Tomorrow|Yesterday)/.test(due)
    ? `Due ${due.charAt(0).toLowerCase()}${due.slice(1)}`
    : `Due ${due}`;
}

export interface DueReminder {
  kind: "todo" | "routine";
  id: string;
  at: number;
  title: string;
  body: string;
}

/** Reminders whose moment is in (from, to]. Sorted by time. */
export function collectDueReminders(
  todos: Todo[],
  routines: RoutineTask[],
  from: number,
  to: number
): DueReminder[] {
  const inWindow = (t: number) => t > from && t <= to;
  const now = new Date(to);
  const due: DueReminder[] = [];

  todos.forEach((todo) => {
    if (todo.completed) return;
    const at = todoReminderAt(todo)?.getTime();
    if (at === undefined || !inWindow(at)) return;
    due.push({
      kind: "todo",
      id: todo.id,
      at,
      title: todo.text,
      body: dueBody(todo, now),
    });
  });

  routines.forEach((task) => {
    // Use the history rather than `completed`, which may lag a period
    // rollover by up to a minute.
    if (task.completions.includes(periodKey(task.frequency, now))) return;
    const at = routineReminderAt(task, now)?.getTime();
    if (at === undefined || !inWindow(at)) return;
    const label =
      task.frequency === "daily"
        ? "today"
        : task.frequency === "weekly"
          ? "this week"
          : "this month";
    due.push({
      kind: "routine",
      id: task.id,
      at,
      title: task.title,
      body: `Routine not done ${label} yet`,
    });
  });

  return due.sort((a, b) => a.at - b.at);
}
