import { describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEYS,
  clearAppData,
  isArrayOf,
  isString,
  noteDraftKey,
  readJson,
  readJsonArray,
  safeJsonParse,
  writeJson,
} from "./storage";

const backupKeys = (key: string) =>
  Object.keys(localStorage).filter((k) => k.startsWith(`${key}.corrupt-`));

describe("safeJsonParse", () => {
  it("returns the fallback for null, undefined and empty strings", () => {
    expect(safeJsonParse(null, 1)).toBe(1);
    expect(safeJsonParse(undefined, 1)).toBe(1);
    expect(safeJsonParse("", 1)).toBe(1);
  });

  it("returns the fallback on invalid JSON", () => {
    expect(safeJsonParse("{not json", { ok: false })).toEqual({ ok: false });
  });

  it("returns parsed values that pass validation", () => {
    expect(safeJsonParse('["a","b"]', [], isArrayOf(isString))).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns the fallback when validation fails", () => {
    expect(safeJsonParse("[1,2]", ["x"], isArrayOf(isString))).toEqual(["x"]);
  });
});

describe("readJson", () => {
  it("returns the fallback for a missing key without creating a backup", () => {
    expect(readJson("missing", 42)).toBe(42);
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it("backs up corrupt JSON before returning the fallback", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem("k", "{broken");
    expect(readJson("k", "fallback")).toBe("fallback");
    const backups = backupKeys("k");
    expect(backups).toHaveLength(1);
    expect(localStorage.getItem(backups[0])).toBe("{broken");
    // The original key is left untouched.
    expect(localStorage.getItem("k")).toBe("{broken");
  });

  it("does not create duplicate backups for repeated reads", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem("k", "{broken");
    readJson("k", null);
    readJson("k", null);
    expect(backupKeys("k")).toHaveLength(1);
  });

  it("backs up values rejected by the guard", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem("k", "123");
    expect(readJson("k", "x", isString)).toBe("x");
    expect(backupKeys("k")).toHaveLength(1);
  });
});

describe("readJsonArray", () => {
  it("keeps only valid items and backs up the raw value when some are dropped", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = JSON.stringify(["a", 1, "b", null]);
    localStorage.setItem("list", raw);
    expect(readJsonArray("list", isString)).toEqual(["a", "b"]);
    const backups = backupKeys("list");
    expect(backups).toHaveLength(1);
    expect(localStorage.getItem(backups[0])).toBe(raw);
  });

  it("does not back up a fully valid array", () => {
    localStorage.setItem("list", JSON.stringify(["a"]));
    expect(readJsonArray("list", isString)).toEqual(["a"]);
    expect(backupKeys("list")).toHaveLength(0);
  });

  it("returns the fallback for non-arrays", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem("list", JSON.stringify({ a: 1 }));
    expect(readJsonArray("list", isString, ["d"])).toEqual(["d"]);
  });
});

describe("writeJson", () => {
  it("writes serialized JSON and returns true", () => {
    expect(writeJson("k", { a: 1 })).toBe(true);
    expect(localStorage.getItem("k")).toBe('{"a":1}');
  });

  it("returns false instead of throwing for unserializable values", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(writeJson("k", circular)).toBe(false);
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("returns false when storage throws (e.g. quota exceeded)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(writeJson("k", [1])).toBe(false);
  });
});

describe("clearAppData", () => {
  it("removes app keys, their backups and drafts but keeps foreign keys", () => {
    localStorage.setItem(STORAGE_KEYS.notes, "[]");
    localStorage.setItem(STORAGE_KEYS.todos, "[]");
    localStorage.setItem(`${STORAGE_KEYS.todos}.corrupt-123`, "x");
    localStorage.setItem(noteDraftKey("abc"), "{}");
    localStorage.setItem("someone-else", "keep");
    clearAppData();
    expect(Object.keys(localStorage)).toEqual(["someone-else"]);
  });
});
