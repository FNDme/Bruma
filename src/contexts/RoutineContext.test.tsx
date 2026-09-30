import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoutineProvider, useRoutine } from "./RoutineContext";
import { STORAGE_KEYS } from "@/lib/storage";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <RoutineProvider>{children}</RoutineProvider>
);

const render = () => renderHook(() => useRoutine(), { wrapper });

const storedLastReset = () =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS.routineLastReset) ?? "null");

describe("RoutineContext period resets (TZ America/Sao_Paulo, UTC-3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records completions under the LOCAL day/week and resets at local midnight", () => {
    // Sunday Mar 10 2024, 23:30 local == Monday Mar 11, 02:30 UTC.
    vi.setSystemTime(new Date("2024-03-11T02:30:00Z"));
    const { result } = render();

    act(() => {
      result.current.addTask({ title: "Stretch", frequency: "daily" });
      result.current.addTask({ title: "Review", frequency: "weekly" });
      result.current.addTask({ title: "Budget", frequency: "monthly" });
    });
    const [daily, weekly, monthly] = result.current.tasks;

    act(() => {
      result.current.toggleTask(daily.id);
      result.current.toggleTask(weekly.id);
      result.current.toggleTask(monthly.id);
    });

    const byId = (id: string) => result.current.tasks.find((t) => t.id === id)!;
    expect(byId(daily.id).completions).toEqual(["2024-03-10"]);
    expect(byId(weekly.id).completions).toEqual(["2024-W10"]);
    expect(byId(monthly.id).completions).toEqual(["2024-03"]);
    expect(result.current.stats.daily).toEqual({ completed: 1, total: 1 });
    expect(storedLastReset()).toEqual({
      daily: "2024-03-10",
      weekly: "2024-W10",
      monthly: "2024-03",
    });

    // Cross local midnight into Monday: day and ISO week roll over, month does not.
    act(() => {
      vi.advanceTimersByTime(31 * 60 * 1000);
    });

    expect(byId(daily.id).completed).toBe(false);
    expect(byId(weekly.id).completed).toBe(false);
    expect(byId(monthly.id).completed).toBe(true);
    // History is kept across resets.
    expect(byId(daily.id).completions).toEqual(["2024-03-10"]);
    expect(storedLastReset()).toEqual({
      daily: "2024-03-11",
      weekly: "2024-W11",
      monthly: "2024-03",
    });
  });

  it("does not reset at UTC midnight when the local day has not changed", () => {
    // Mar 9 2024, 20:30 local == 23:30 UTC.
    vi.setSystemTime(new Date("2024-03-09T23:30:00Z"));
    const { result } = render();
    act(() => {
      result.current.addTask({ title: "Read", frequency: "daily" });
    });
    const id = result.current.tasks[0].id;
    act(() => {
      result.current.toggleTask(id);
    });

    // One hour later it is past UTC midnight but still Mar 9 locally.
    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });
    expect(result.current.tasks[0].completed).toBe(true);
    expect(storedLastReset().daily).toBe("2024-03-09");
  });

  it("toggling right after midnight uses the new period even before a timer fires", () => {
    vi.setSystemTime(new Date(2024, 2, 9, 23, 59, 50));
    const { result } = render();
    act(() => {
      result.current.addTask({ title: "Walk", frequency: "daily" });
    });
    const id = result.current.tasks[0].id;
    act(() => {
      result.current.toggleTask(id);
    });

    // Move the clock without running timers.
    vi.setSystemTime(new Date(2024, 2, 10, 0, 0, 5));
    act(() => {
      result.current.toggleTask(id);
    });
    expect(result.current.tasks[0].completed).toBe(true);
    expect(result.current.tasks[0].completions).toEqual([
      "2024-03-09",
      "2024-03-10",
    ]);
  });

  it("migrates the legacy lastReset format and backfills completions", () => {
    vi.setSystemTime(new Date(2024, 2, 13, 10)); // Wed Mar 13, local
    localStorage.setItem(
      STORAGE_KEYS.routineLastReset,
      JSON.stringify({ daily: "2024-03-13", weekly: "2024-03-11", monthly: 2 })
    );
    localStorage.setItem(
      STORAGE_KEYS.routineTasks,
      JSON.stringify([
        {
          id: "d",
          title: "Old daily",
          frequency: "daily",
          completed: true,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "w",
          title: "Old weekly",
          frequency: "weekly",
          completed: true,
          createdAt: "not a date",
        },
      ])
    );

    const { result } = render();
    const [d, w] = result.current.tasks;
    expect(d.completed).toBe(true);
    expect(d.completions).toEqual(["2024-03-13"]);
    expect(w.completed).toBe(true);
    expect(w.completions).toEqual(["2024-W11"]);
    expect(w.createdAt).toBeInstanceOf(Date);
    expect(Number.isNaN(w.createdAt.getTime())).toBe(false);
    expect(storedLastReset()).toEqual({
      daily: "2024-03-13",
      weekly: "2024-W11",
      monthly: "2024-03",
    });
  });

  it("starts a new period on load when the stored one is stale", () => {
    vi.setSystemTime(new Date(2024, 2, 14, 9)); // Thu Mar 14
    localStorage.setItem(
      STORAGE_KEYS.routineLastReset,
      JSON.stringify({
        daily: "2024-03-13",
        weekly: "2024-W11",
        monthly: "2024-03",
      })
    );
    localStorage.setItem(
      STORAGE_KEYS.routineTasks,
      JSON.stringify([
        {
          id: "d",
          title: "Daily",
          frequency: "daily",
          completed: true,
          completions: ["2024-03-13"],
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ])
    );
    const { result } = render();
    expect(result.current.tasks[0].completed).toBe(false);
    expect(storedLastReset().daily).toBe("2024-03-14");
  });

  it("persists deleting the last routine", () => {
    vi.setSystemTime(new Date(2024, 2, 14, 9));
    const { result } = render();
    act(() => {
      result.current.addTask({ title: "Only", frequency: "daily" });
    });
    const id = result.current.tasks[0].id;
    act(() => {
      result.current.deleteTask(id);
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.routineTasks)!)).toEqual(
      []
    );
  });
});

describe("RoutineContext legacy migration east of UTC (TZ Pacific/Auckland)", () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Pacific/Auckland";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it("keeps today's daily and this week's weekly completions from UTC-based legacy keys", () => {
    // Wed Sep 30 2026, 09:00 in Auckland (UTC+13) == Tue Sep 29, 20:00 UTC.
    vi.setSystemTime(new Date("2026-09-29T20:00:00Z"));
    // What the old code wrote at this moment: the UTC date, and the UTC date
    // of the local Monday (Mon Sep 28 00:00 local == Sun Sep 27 UTC).
    localStorage.setItem(
      STORAGE_KEYS.routineLastReset,
      JSON.stringify({ daily: "2026-09-29", weekly: "2026-09-27", monthly: 8 })
    );
    localStorage.setItem(
      STORAGE_KEYS.routineTasks,
      JSON.stringify([
        { id: "d", title: "Daily", frequency: "daily", completed: true },
        { id: "w", title: "Weekly", frequency: "weekly", completed: true },
      ])
    );

    const { result } = render();
    const [d, w] = result.current.tasks;
    expect(d.completed).toBe(true);
    expect(d.completions).toEqual(["2026-09-30"]);
    expect(w.completed).toBe(true);
    expect(w.completions).toEqual(["2026-W40"]);
    expect(storedLastReset()).toEqual({
      daily: "2026-09-30",
      weekly: "2026-W40",
      monthly: "2026-09",
    });
  });
});
