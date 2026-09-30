import { describe, expect, it } from "vitest";
import {
  computeStreak,
  currentPeriodKeys,
  isoWeekKey,
  isPeriodKey,
  localDateKey,
  monthKey,
  msUntilNextLocalMidnight,
  previousPeriodKey,
} from "./routineDates";

describe("test environment", () => {
  it("runs in a timezone behind UTC (America/Sao_Paulo, UTC-3)", () => {
    expect(new Date("2024-03-10T12:00:00Z").getTimezoneOffset()).toBe(180);
  });
});

describe("period keys use the local calendar", () => {
  // 01:30 UTC on Mar 10 is still 22:30 on Mar 9 in Sao Paulo.
  const lateEvening = new Date("2024-03-10T01:30:00Z");

  it("daily key is the local date, not the UTC date", () => {
    expect(lateEvening.toISOString().slice(0, 10)).toBe("2024-03-10");
    expect(localDateKey(lateEvening)).toBe("2024-03-09");
  });

  it("monthly key is the local month at a month boundary", () => {
    // 02:00 UTC on Apr 1 is 23:00 on Mar 31 locally.
    expect(monthKey(new Date("2024-04-01T02:00:00Z"))).toBe("2024-03");
  });

  it("weekly key follows the local week at a Sunday/Monday boundary", () => {
    // 01:00 UTC Monday Mar 11 is 22:00 Sunday Mar 10 locally (still W10).
    expect(isoWeekKey(new Date("2024-03-11T01:00:00Z"))).toBe("2024-W10");
    expect(isoWeekKey(new Date(2024, 2, 11, 0, 0))).toBe("2024-W11");
  });

  it("builds all three keys together", () => {
    expect(currentPeriodKeys(lateEvening)).toEqual({
      daily: "2024-03-09",
      weekly: "2024-W10",
      monthly: "2024-03",
    });
  });
});

describe("ISO week-year edge cases", () => {
  it.each([
    [new Date(2020, 11, 31), "2020-W53"],
    [new Date(2021, 0, 3), "2020-W53"],
    [new Date(2021, 0, 4), "2021-W01"],
    [new Date(2024, 11, 30), "2025-W01"],
    [new Date(2026, 0, 1), "2026-W01"],
  ])("%s -> %s", (date, key) => {
    expect(isoWeekKey(date)).toBe(key);
  });
});

describe("previousPeriodKey / isPeriodKey", () => {
  it("steps back across year boundaries", () => {
    expect(previousPeriodKey("daily", "2024-01-01")).toBe("2023-12-31");
    expect(previousPeriodKey("weekly", "2021-W01")).toBe("2020-W53");
    expect(previousPeriodKey("monthly", "2024-01")).toBe("2023-12");
  });

  it("rejects malformed or impossible keys", () => {
    expect(isPeriodKey("daily", "2024-02-30")).toBe(false);
    expect(isPeriodKey("weekly", "2021-W53")).toBe(false);
    expect(isPeriodKey("monthly", "2024-13")).toBe(false);
    expect(previousPeriodKey("daily", "nope")).toBeNull();
  });
});

describe("computeStreak", () => {
  const now = new Date(2024, 2, 10, 12);

  it("counts consecutive days ending today", () => {
    const s = computeStreak(
      "daily",
      ["2024-03-08", "2024-03-09", "2024-03-10"],
      now
    );
    expect(s).toEqual({ current: 3, best: 3, doneNow: true });
  });

  it("keeps the streak alive while today is not done yet", () => {
    const s = computeStreak("daily", ["2024-03-08", "2024-03-09"], now);
    expect(s.current).toBe(2);
    expect(s.doneNow).toBe(false);
  });

  it("breaks the current streak after a missed day but remembers the best", () => {
    const s = computeStreak(
      "daily",
      ["2024-03-01", "2024-03-02", "2024-03-03", "2024-03-08"],
      now
    );
    expect(s.current).toBe(0);
    expect(s.best).toBe(3);
  });
});

describe("msUntilNextLocalMidnight", () => {
  it("measures to local, not UTC, midnight", () => {
    expect(msUntilNextLocalMidnight(new Date(2024, 2, 9, 23, 0))).toBe(
      60 * 60 * 1000
    );
  });
});
