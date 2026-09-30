import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  RoutineFrequency,
  RoutineStats,
  RoutineTask,
  RoutineTaskInput,
  RoutineTaskPatch,
} from "../types/routine";
import { toast } from "sonner";
import {
  STORAGE_KEYS,
  isBoolean,
  isNumber,
  isOptionalString,
  isRecord,
  isString,
  readJson,
  readJsonArray,
  writeJson,
} from "@/lib/storage";
import {
  PeriodKeys,
  computeStreak,
  currentPeriodKeys,
  formatPeriodCount,
  isPeriodKey,
  isoWeekKey,
  msUntilNextLocalMidnight,
  parseLocalDateKey,
  periodKey,
} from "@/lib/routineDates";
import { isTimeKey } from "@/lib/todoDates";
import { defaultReminderDay, isReminderDay } from "@/lib/reminders";

// ---------- storage shapes & migration ----------

type StoredRoutineTask = Omit<
  RoutineTask,
  "createdAt" | "updatedAt" | "completions"
> & {
  createdAt?: unknown;
  updatedAt?: unknown;
  completions?: unknown;
};

/**
 * Stored reset markers. Current format: one local period key per frequency.
 * Legacy format (still accepted on load): { daily: UTC "YYYY-MM-DD",
 * weekly: "YYYY-MM-DD" of a week start, monthly: 0-11 month index }.
 */
type LastReset = PeriodKeys;

interface LegacyLastReset {
  daily: string;
  weekly: string;
  monthly: number;
}

interface RoutineState {
  tasks: RoutineTask[];
  lastReset: LastReset;
}

const FREQUENCIES: RoutineFrequency[] = ["daily", "weekly", "monthly"];

function isFrequency(value: unknown): value is RoutineFrequency {
  return value === "daily" || value === "weekly" || value === "monthly";
}

function isStoredRoutineTask(value: unknown): value is StoredRoutineTask {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.title) &&
    isOptionalString(value.description) &&
    isFrequency(value.frequency) &&
    isBoolean(value.completed)
  );
}

function isStoredLastReset(value: unknown): value is LastReset | LegacyLastReset {
  return (
    isRecord(value) &&
    isString(value.daily) &&
    isString(value.weekly) &&
    (isString(value.monthly) || isNumber(value.monthly))
  );
}

function toValidDate(value: unknown): Date {
  const date =
    typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : new Date(NaN);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeCompletions(
  frequency: RoutineFrequency,
  value: unknown
): string[] {
  if (!Array.isArray(value)) return [];
  const keys = value.filter(
    (k): k is string => isString(k) && isPeriodKey(frequency, k)
  );
  return [...new Set(keys)].sort();
}

/** Convert whatever lastReset is stored (new or legacy) to local period keys. */
function migrateLastReset(stored: unknown, now: Date): LastReset {
  const current = currentPeriodKeys(now);
  if (!isStoredLastReset(stored)) return current;

  // Legacy data (before period keys) stored UTC dates and a month index.
  const isLegacy =
    isNumber(stored.monthly) || !isPeriodKey("weekly", stored.weekly);

  // Daily: legacy keys were UTC dates. The old code compared them with the
  // UTC date of "now", so a value equal to today's UTC date meant "today"
  // even when the local date differs. Anything ahead of today is clamped so
  // we never record a completion in the future.
  let daily = isPeriodKey("daily", stored.daily) ? stored.daily : current.daily;
  if (isLegacy && daily === now.toISOString().slice(0, 10)) {
    daily = current.daily;
  }
  if (daily > current.daily) daily = current.daily;

  // Weekly: new "YYYY-Www" keys pass through; legacy "YYYY-MM-DD" becomes the
  // ISO week containing that date. The legacy value was the UTC date of the
  // local Monday, which east of UTC can be the Sunday before (west of UTC it
  // can be Tuesday, which is already in the right week), so a Sunday is moved
  // to the following Monday.
  let weekly = current.weekly;
  if (isPeriodKey("weekly", stored.weekly)) {
    weekly = stored.weekly;
  } else {
    const legacyDate = parseLocalDateKey(stored.weekly);
    if (legacyDate) {
      if (legacyDate.getDay() === 0) {
        legacyDate.setDate(legacyDate.getDate() + 1);
      }
      weekly = isoWeekKey(legacyDate);
    }
  }
  if (weekly > current.weekly) weekly = current.weekly;

  // Monthly: legacy value was a bare month index; assume the most recent
  // occurrence of that month (this year, or last year if it is later).
  let monthly = current.monthly;
  if (isString(stored.monthly) && isPeriodKey("monthly", stored.monthly)) {
    monthly = stored.monthly;
  } else if (
    isNumber(stored.monthly) &&
    stored.monthly >= 0 &&
    stored.monthly <= 11
  ) {
    const year =
      stored.monthly <= now.getMonth()
        ? now.getFullYear()
        : now.getFullYear() - 1;
    monthly = `${year}-${String(stored.monthly + 1).padStart(2, "0")}`;
  }
  if (monthly > current.monthly) monthly = current.monthly;

  return { daily, weekly, monthly };
}

/**
 * Start a new period for every frequency whose key changed since the last
 * reset. `completed` is re-derived from the history, so it is always true
 * exactly when the current period is in `completions`.
 */
function applyResets(state: RoutineState, now = new Date()): RoutineState {
  const keys = currentPeriodKeys(now);
  const changed = FREQUENCIES.filter((f) => state.lastReset[f] !== keys[f]);
  if (changed.length === 0) return state;

  const stamp = new Date(now);
  return {
    lastReset: keys,
    tasks: state.tasks.map((task) => {
      if (!changed.includes(task.frequency)) return task;
      const completed = task.completions.includes(keys[task.frequency]);
      return completed === task.completed
        ? task
        : { ...task, completed, updatedAt: stamp };
    }),
  };
}

/** Valid reminder fields for a task of `frequency` (others are dropped). */
function normalizeReminder(
  frequency: RoutineFrequency,
  reminderTime: unknown,
  reminderDay: unknown
): Pick<RoutineTask, "reminderTime" | "reminderDay"> {
  if (!isTimeKey(reminderTime)) return {};
  if (frequency === "daily") return { reminderTime };
  return {
    reminderTime,
    reminderDay: isReminderDay(frequency, reminderDay)
      ? reminderDay
      : defaultReminderDay(frequency),
  };
}

function loadState(now = new Date()): RoutineState {
  const lastReset = migrateLastReset(
    readJson<unknown>(STORAGE_KEYS.routineLastReset, null),
    now
  );

  const tasks = readJsonArray(
    STORAGE_KEYS.routineTasks,
    isStoredRoutineTask
  ).map((task): RoutineTask => {
    let completions = normalizeCompletions(task.frequency, task.completions);
    // Data saved before history existed: a completed task was completed in
    // the period recorded by lastReset.
    const periodOfFlag = lastReset[task.frequency];
    if (
      task.completed &&
      task.completions === undefined &&
      !completions.includes(periodOfFlag)
    ) {
      completions = [...completions, periodOfFlag].sort();
    }
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      frequency: task.frequency,
      completed: task.completed,
      completions,
      ...normalizeReminder(task.frequency, task.reminderTime, task.reminderDay),
      createdAt: toValidDate(task.createdAt),
      updatedAt: toValidDate(task.updatedAt),
    };
  });

  return applyResets({ tasks, lastReset }, now);
}

function computeStats(tasks: RoutineTask[]): RoutineStats {
  const stats: RoutineStats = {
    daily: { completed: 0, total: 0 },
    weekly: { completed: 0, total: 0 },
    monthly: { completed: 0, total: 0 },
  };
  tasks.forEach((task) => {
    stats[task.frequency].total++;
    if (task.completed) stats[task.frequency].completed++;
  });
  return stats;
}

const CHEER_MESSAGES = [
  "🎉 Amazing job! You're crushing it!",
  "🌟 You're on fire! Keep it up!",
  "💪 That's the spirit! One step closer to your goals!",
  "✨ You're making progress! So proud of you!",
  "🔥 Nothing can stop you now!",
  "🚀 You're unstoppable!",
  "🌈 Every task completed is a step to success!",
  "⭐️ You're shining bright today!",
  "🎯 Bullseye! Perfect execution!",
  "💫 You're making it look easy!",
];

// ---------- context ----------

export interface DeletedRoutine {
  task: RoutineTask;
  index: number;
}

interface RoutineContextType {
  tasks: RoutineTask[];
  stats: RoutineStats;
  addTask: (task: RoutineTaskInput) => void;
  updateTask: (taskId: string, patch: RoutineTaskPatch) => void;
  toggleTask: (taskId: string) => void;
  /** Removes the task and returns it (with its position) so it can be restored. */
  deleteTask: (taskId: string) => DeletedRoutine | null;
  restoreTask: (deleted: DeletedRoutine) => void;
}

const RoutineContext = createContext<RoutineContextType | undefined>(undefined);

/** How often to re-check period boundaries while the app stays open. */
const RESET_CHECK_INTERVAL_MS = 60_000;

export const RoutineProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<RoutineState>(() => loadState());
  // Latest committed state, so back-to-back mutations never read stale data
  // and side effects (toasts) run outside state updaters.
  const stateRef = useRef(state);

  const commit = useCallback((next: RoutineState) => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const checkResets = useCallback(() => {
    commit(applyResets(stateRef.current));
  }, [commit]);

  // Persist everything, including an empty task list.
  useEffect(() => {
    const tasksToStore = state.tasks.map((task) => ({
      ...task,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));
    writeJson(STORAGE_KEYS.routineTasks, tasksToStore);
    writeJson(STORAGE_KEYS.routineLastReset, state.lastReset);
  }, [state]);

  // Reset while the app stays open: every minute, at local midnight, and
  // whenever the window regains focus or becomes visible (e.g. after sleep).
  useEffect(() => {
    checkResets();
    const interval = window.setInterval(checkResets, RESET_CHECK_INTERVAL_MS);

    let midnightTimer: number | undefined;
    const scheduleMidnight = () => {
      midnightTimer = window.setTimeout(() => {
        checkResets();
        scheduleMidnight();
      }, msUntilNextLocalMidnight() + 500);
    };
    scheduleMidnight();

    const onVisibility = () => {
      if (document.visibilityState === "visible") checkResets();
    };
    window.addEventListener("focus", checkResets);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(midnightTimer);
      window.removeEventListener("focus", checkResets);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkResets]);

  const addTask = useCallback(
    (input: RoutineTaskInput) => {
      const current = applyResets(stateRef.current);
      const now = new Date();
      const newTask: RoutineTask = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        frequency: input.frequency,
        completed: false,
        completions: [],
        ...normalizeReminder(
          input.frequency,
          input.reminderTime,
          input.reminderDay
        ),
        createdAt: now,
        updatedAt: now,
      };
      commit({ ...current, tasks: [...current.tasks, newTask] });
    },
    [commit]
  );

  const updateTask = useCallback(
    (taskId: string, patch: RoutineTaskPatch) => {
      const current = applyResets(stateRef.current);
      commit({
        ...current,
        tasks: current.tasks.map((task) => {
          if (task.id !== taskId) return task;
          const next: RoutineTask = { ...task, updatedAt: new Date() };
          if (patch.title !== undefined) next.title = patch.title.trim();
          if (patch.description !== undefined)
            next.description = patch.description.trim() || undefined;
          if (patch.frequency && patch.frequency !== task.frequency) {
            // Period keys are frequency-specific; history cannot carry over.
            next.frequency = patch.frequency;
            next.completions = [];
            next.completed = false;
          }
          if (
            patch.reminderTime !== undefined ||
            patch.reminderDay !== undefined ||
            next.frequency !== task.frequency
          ) {
            const reminder = normalizeReminder(
              next.frequency,
              patch.reminderTime ?? task.reminderTime,
              patch.reminderDay ?? task.reminderDay
            );
            next.reminderTime = reminder.reminderTime;
            next.reminderDay = reminder.reminderDay;
          }
          return next;
        }),
      });
    },
    [commit]
  );

  const toggleTask = useCallback(
    (taskId: string) => {
      const now = new Date();
      const current = applyResets(stateRef.current, now);
      const target = current.tasks.find((t) => t.id === taskId);
      if (!target) {
        commit(current);
        return;
      }

      const key = periodKey(target.frequency, now);
      const completed = !target.completed;
      const completions = completed
        ? [...new Set([...target.completions, key])].sort()
        : target.completions.filter((k) => k !== key);
      const updated: RoutineTask = {
        ...target,
        completed,
        completions,
        updatedAt: now,
      };
      const tasks = current.tasks.map((t) => (t.id === taskId ? updated : t));
      commit({ ...current, tasks });

      if (!completed) return;
      const daily = tasks.filter((t) => t.frequency === "daily");
      const allDailyDone =
        target.frequency === "daily" &&
        daily.length > 0 &&
        daily.every((t) => t.completed);
      if (allDailyDone) {
        toast.success(
          "🎉🎉🎉 INCREDIBLE! You've completed ALL your daily tasks for today! You're absolutely amazing! 🎉🎉🎉"
        );
        return;
      }
      const streak = computeStreak(updated.frequency, completions, now);
      const message =
        CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)];
      toast.success(message, {
        description:
          streak.current >= 2
            ? `🔥 ${formatPeriodCount(updated.frequency, streak.current)} in a row`
            : undefined,
      });
    },
    [commit]
  );

  const deleteTask = useCallback(
    (taskId: string): DeletedRoutine | null => {
      const current = stateRef.current;
      const index = current.tasks.findIndex((t) => t.id === taskId);
      if (index === -1) return null;
      const task = current.tasks[index];
      commit({
        ...current,
        tasks: current.tasks.filter((t) => t.id !== taskId),
      });
      return { task, index };
    },
    [commit]
  );

  const restoreTask = useCallback(
    ({ task, index }: DeletedRoutine) => {
      const now = new Date();
      const current = applyResets(stateRef.current, now);
      if (current.tasks.some((t) => t.id === task.id)) {
        commit(current);
        return;
      }
      // The period may have rolled over while the task was deleted.
      const restored: RoutineTask = {
        ...task,
        completed: task.completions.includes(periodKey(task.frequency, now)),
      };
      const tasks = [...current.tasks];
      tasks.splice(Math.min(index, tasks.length), 0, restored);
      commit({ ...current, tasks });
    },
    [commit]
  );

  const stats = useMemo(() => computeStats(state.tasks), [state.tasks]);

  const value = useMemo(
    () => ({
      tasks: state.tasks,
      stats,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      restoreTask,
    }),
    [state.tasks, stats, addTask, updateTask, toggleTask, deleteTask, restoreTask]
  );

  return (
    <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>
  );
};

export const useRoutine = () => {
  const context = useContext(RoutineContext);
  if (context === undefined) {
    throw new Error("useRoutine must be used within a RoutineProvider");
  }
  return context;
};
