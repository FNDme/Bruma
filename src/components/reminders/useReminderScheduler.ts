import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTodo } from "@/contexts/TodoContext";
import { useRoutine } from "@/contexts/RoutineContext";
import {
  STORAGE_KEYS,
  isNumber,
  isRecord,
  readJson,
  writeJson,
} from "@/lib/storage";
import { readReminderSettings, showNotification } from "@/lib/notifications";
import {
  DueReminder,
  MAX_CATCH_UP_MS,
  collectDueReminders,
} from "@/lib/reminders";

/** How often to look for due reminders while the app is open. */
const CHECK_INTERVAL_MS = 20_000;

/** More than this many at once are combined into one notification. */
const MAX_SEPARATE_NOTIFICATIONS = 3;

interface ReminderState {
  lastCheckedAt: number;
}

function isReminderState(value: unknown): value is ReminderState {
  return isRecord(value) && isNumber(value.lastCheckedAt);
}

/**
 * Advance the stored check window to `now` and return where it started.
 * Written before anything fires so a second tick (StrictMode, focus + timer)
 * gets an empty window instead of firing the same reminders again.
 */
function claimWindow(now: number): number {
  const stored = readJson<ReminderState | null>(
    STORAGE_KEYS.reminderState,
    null,
    isReminderState
  );
  let from = stored?.lastCheckedAt ?? now; // first run: no backlog
  if (from > now) from = now; // clock moved backwards
  from = Math.max(from, now - MAX_CATCH_UP_MS);
  writeJson(STORAGE_KEYS.reminderState, { lastCheckedAt: now });
  return from;
}

/**
 * Fires native notifications (plus an in-app toast) for todo and routine
 * reminders while the app is running. Mount once, inside the router and the
 * Todo/Routine providers.
 */
export function useReminderScheduler() {
  const { todos } = useTodo();
  const { tasks } = useRoutine();
  const navigate = useNavigate();

  const latest = useRef({ todos, tasks, navigate });
  latest.current = { todos, tasks, navigate };

  const fire = useCallback((due: DueReminder[]) => {
    const open = (kind: DueReminder["kind"]) =>
      latest.current.navigate(kind === "todo" ? "/todo" : "/routines");

    if (due.length > MAX_SEPARATE_NOTIFICATIONS) {
      const names = due.map((r) => r.title);
      const body = `${names.slice(0, 3).join(", ")}${
        names.length > 3 ? ` and ${names.length - 3} more` : ""
      }`;
      const title = `${due.length} reminders`;
      void showNotification(title, body);
      toast(title, {
        description: body,
        action: { label: "View", onClick: () => open(due[0].kind) },
      });
      return;
    }

    due.forEach((reminder) => {
      void showNotification(reminder.title, reminder.body);
      toast(reminder.title, {
        description: reminder.body,
        action: { label: "View", onClick: () => open(reminder.kind) },
      });
    });
  }, []);

  const check = useCallback(() => {
    const now = Date.now();
    const from = claimWindow(now);
    if (from >= now) return;
    if (!readReminderSettings().enabled) return;
    const due = collectDueReminders(
      latest.current.todos,
      latest.current.tasks,
      from,
      now
    );
    if (due.length > 0) fire(due);
  }, [fire]);

  useEffect(() => {
    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [check]);
}
