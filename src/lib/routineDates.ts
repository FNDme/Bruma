/**
 * Local-time period keys for routines.
 *
 * All keys are built from the user's LOCAL calendar (never toISOString, which
 * is UTC and shifts the day boundary by the timezone offset):
 *   daily   -> "YYYY-MM-DD"
 *   weekly  -> "YYYY-Www"  (ISO 8601 week, Monday start, ISO week-year)
 *   monthly -> "YYYY-MM"
 *
 * Keys of one frequency sort lexicographically in chronological order.
 */
import type { RoutineFrequency } from "@/types/routine";

export type PeriodKeys = Record<RoutineFrequency, string>;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** Local midnight of the given date (a copy). */
export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addLocalDays(date: Date, days: number): Date {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** "YYYY-MM-DD" from the local calendar date. */
export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

/** Parse a "YYYY-MM-DD" key as a LOCAL date (midnight). */
export function parseLocalDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Monday (local midnight) of the week containing `date`. */
export function startOfIsoWeek(date: Date): Date {
  const d = startOfLocalDay(date);
  const mondayOffset = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - mondayOffset);
  return d;
}

/** "YYYY-Www" ISO week key (the year is the ISO week-year). */
export function isoWeekKey(date: Date = new Date()): string {
  const thursday = startOfIsoWeek(date);
  thursday.setDate(thursday.getDate() + 3);
  const year = thursday.getFullYear();
  // Day-of-year via UTC day numbers so DST shifts cannot skew the division.
  const ordinal =
    (Date.UTC(year, thursday.getMonth(), thursday.getDate()) -
      Date.UTC(year, 0, 1)) /
      86_400_000 +
    1;
  const week = Math.floor((ordinal - 1) / 7) + 1;
  return `${year}-W${pad(week)}`;
}

/** Monday (local midnight) of an ISO week key. */
export function parseIsoWeekKey(key: string): Date | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  const week1Monday = startOfIsoWeek(new Date(year, 0, 4));
  week1Monday.setDate(week1Monday.getDate() + (week - 1) * 7);
  return week1Monday;
}

/** "YYYY-MM" from the local calendar. */
export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function parseMonthKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Number(m[1]), month - 1, 1);
}

export function periodKey(frequency: RoutineFrequency, date = new Date()) {
  switch (frequency) {
    case "daily":
      return localDateKey(date);
    case "weekly":
      return isoWeekKey(date);
    case "monthly":
      return monthKey(date);
  }
}

export function currentPeriodKeys(date = new Date()): PeriodKeys {
  return {
    daily: localDateKey(date),
    weekly: isoWeekKey(date),
    monthly: monthKey(date),
  };
}

/** Start date of the period a key names, or null when the key is malformed. */
export function parsePeriodKey(
  frequency: RoutineFrequency,
  key: string
): Date | null {
  switch (frequency) {
    case "daily":
      return parseLocalDateKey(key);
    case "weekly":
      return parseIsoWeekKey(key);
    case "monthly":
      return parseMonthKey(key);
  }
}

export function isPeriodKey(frequency: RoutineFrequency, key: string) {
  const start = parsePeriodKey(frequency, key);
  return start !== null && periodKey(frequency, start) === key;
}

/** Key of the period before `key` (null for malformed keys). */
export function previousPeriodKey(
  frequency: RoutineFrequency,
  key: string
): string | null {
  const start = parsePeriodKey(frequency, key);
  if (!start) return null;
  switch (frequency) {
    case "daily":
      return localDateKey(addLocalDays(start, -1));
    case "weekly":
      return isoWeekKey(addLocalDays(start, -7));
    case "monthly":
      return monthKey(new Date(start.getFullYear(), start.getMonth() - 1, 1));
  }
}

/** Milliseconds until the next local midnight (at least 1 s). */
export function msUntilNextLocalMidnight(now = new Date()): number {
  const next = addLocalDays(now, 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

export interface StreakInfo {
  /** Consecutive completed periods ending with the current period, or with the
   * previous one when the current period is not done yet (still "alive"). */
  current: number;
  best: number;
  /** Whether the current period is completed. */
  doneNow: boolean;
}

export function computeStreak(
  frequency: RoutineFrequency,
  completions: readonly string[],
  now = new Date()
): StreakInfo {
  const set = new Set(completions);
  const nowKey = periodKey(frequency, now);
  const doneNow = set.has(nowKey);

  let current = 0;
  let cursor: string | null = doneNow
    ? nowKey
    : previousPeriodKey(frequency, nowKey);
  while (cursor && set.has(cursor)) {
    current++;
    cursor = previousPeriodKey(frequency, cursor);
  }

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  const sorted = [...set]
    .filter((k) => isPeriodKey(frequency, k))
    .sort();
  for (const key of sorted) {
    run = prev !== null && previousPeriodKey(frequency, key) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }

  return { current, best: Math.max(best, current), doneNow };
}

export const PERIOD_UNIT: Record<RoutineFrequency, [string, string]> = {
  daily: ["day", "days"],
  weekly: ["week", "weeks"],
  monthly: ["month", "months"],
};

export function formatPeriodCount(frequency: RoutineFrequency, n: number) {
  const [one, many] = PERIOD_UNIT[frequency];
  return `${n} ${n === 1 ? one : many}`;
}

export interface DayHistory {
  key: string;
  date: Date;
  /** Daily routines completed on this day. */
  completed: number;
  /** Daily routines that existed (or were completed) on this day. */
  total: number;
  /** completed / total in 0-100, or null when no daily routine existed. */
  rate: number | null;
  isFuture: boolean;
}

interface HistoryTask {
  frequency: RoutineFrequency;
  completions: readonly string[];
  createdAt: Date;
}

/** Per-day completion of DAILY routines from `start` to `end` (inclusive, local days). */
export function dailyHistory(
  tasks: readonly HistoryTask[],
  start: Date,
  end: Date,
  now = new Date()
): DayHistory[] {
  const daily = tasks
    .filter((t) => t.frequency === "daily")
    .map((t) => ({
      createdKey: localDateKey(t.createdAt),
      done: new Set(t.completions),
    }));
  const todayKey = localDateKey(now);
  const days: DayHistory[] = [];
  for (
    let d = startOfLocalDay(start);
    d.getTime() <= end.getTime();
    d = addLocalDays(d, 1)
  ) {
    const key = localDateKey(d);
    let completed = 0;
    let total = 0;
    for (const t of daily) {
      const done = t.done.has(key);
      if (done || t.createdKey <= key) {
        total++;
        if (done) completed++;
      }
    }
    const isFuture = key > todayKey;
    days.push({
      key,
      date: d,
      completed,
      total: isFuture ? 0 : total,
      rate: isFuture || total === 0 ? null : Math.round((completed / total) * 100),
      isFuture,
    });
  }
  return days;
}
