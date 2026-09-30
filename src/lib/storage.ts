/**
 * Safe helpers around JSON + localStorage.
 *
 * Every read is guarded: missing keys, corrupt JSON, unexpected shapes and
 * unavailable storage all fall back to a caller-provided default instead of
 * throwing during render. When a stored value cannot be used, the raw string
 * is copied to a backup key (`<key>.corrupt-<timestamp>`) before the caller
 * gets the fallback, so a later write does not silently destroy the only copy
 * of the user's data.
 */

/** All localStorage keys owned by the app. Keep formats backward compatible. */
export const STORAGE_KEYS = {
  notes: "bruma-notes",
  folders: "bruma-folders",
  theme: "bruma-theme",
  todos: "todos",
  userCredentials: "userCredentials",
  routineTasks: "routineTasks",
  routineProgress: "routineProgress",
  routineLastReset: "routineLastReset",
  todoSort: "bruma-todo-sort",
  reminderSettings: "bruma-reminder-settings",
  reminderState: "bruma-reminder-state",
  sidebarCollapsed: "bruma-sidebar-collapsed",
  autoReportSettings: "bruma-auto-report",
  autoReportState: "bruma-auto-report-state",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Prefixes for dynamically named app keys (e.g. one editor draft per note).
 * clearAppData removes every key that starts with one of these.
 */
export const STORAGE_PREFIXES = {
  noteDraft: "bruma-draft:",
} as const;

/** Key of the autosaved editor draft for a note, or for a new note. */
export function noteDraftKey(noteId?: string): string {
  return `${STORAGE_PREFIXES.noteDraft}${noteId ?? "new"}`;
}

export type Guard<T> = (value: unknown) => value is T;

const CORRUPT_SUFFIX = ".corrupt-";

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Parse a JSON string, returning `fallback` on null, syntax error or failed validation. */
export function safeJsonParse<T>(
  raw: string | null | undefined,
  fallback: T,
  validate?: Guard<T>
): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Read a raw string from localStorage without ever throwing. */
export function readString(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Write a raw string to localStorage. Returns false if storage is unavailable or full. */
export function writeString(key: string, value: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Failed to write localStorage key "${key}":`, error);
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // ignore
  }
}

/** Keep a copy of an unreadable value so it is not lost when the key is rewritten. */
function backupCorrupt(key: string, raw: string): void {
  const storage = getStorage();
  if (!storage) return;
  const prefix = `${key}${CORRUPT_SUFFIX}`;
  try {
    // Skip if an identical backup already exists (e.g. StrictMode double reads).
    for (let i = 0; i < storage.length; i++) {
      const existing = storage.key(i);
      if (existing?.startsWith(prefix) && storage.getItem(existing) === raw) {
        return;
      }
    }
  } catch {
    // ignore and try to write the backup anyway
  }
  const backupKey = `${key}${CORRUPT_SUFFIX}${Date.now()}`;
  console.warn(
    `localStorage key "${key}" contained unreadable data; a copy was saved to "${backupKey}".`
  );
  writeString(backupKey, raw);
}

/**
 * Read and parse a JSON value from localStorage.
 * Returns `fallback` when the key is missing, the JSON is invalid, or `validate` rejects it.
 */
export function readJson<T>(key: string, fallback: T, validate?: Guard<T>): T {
  const raw = readString(key);
  if (raw === null) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupCorrupt(key, raw);
    return fallback;
  }
  if (validate && !validate(parsed)) {
    backupCorrupt(key, raw);
    return fallback;
  }
  return parsed as T;
}

/**
 * Read a JSON array from localStorage, keeping only the items that pass `isItem`.
 * A non-array value yields `fallback`; dropped items trigger a backup of the raw value.
 */
export function readJsonArray<T>(
  key: string,
  isItem: (value: unknown) => value is T,
  fallback: T[] = []
): T[] {
  const raw = readString(key);
  if (raw === null) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupCorrupt(key, raw);
    return fallback;
  }
  if (!Array.isArray(parsed)) {
    backupCorrupt(key, raw);
    return fallback;
  }
  const valid = parsed.filter(isItem);
  if (valid.length !== parsed.length) backupCorrupt(key, raw);
  return valid;
}

/** Serialize and write a value. Returns false on failure (e.g. quota exceeded). */
export function writeJson(key: string, value: unknown): boolean {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    console.error(`Failed to serialize value for "${key}":`, error);
    return false;
  }
  return writeString(key, serialized);
}

/** Remove every key owned by the app, including corrupt-data backups. */
export function clearAppData(): void {
  const storage = getStorage();
  if (!storage) return;
  const owned = new Set<string>(Object.values(STORAGE_KEYS));
  const ownedPrefixes: string[] = Object.values(STORAGE_PREFIXES);
  const toRemove: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      const base = key.split(CORRUPT_SUFFIX)[0];
      if (
        owned.has(key) ||
        owned.has(base) ||
        ownedPrefixes.some((prefix) => key.startsWith(prefix))
      ) {
        toRemove.push(key);
      }
    }
  } catch {
    // fall through with whatever we collected
  }
  toRemove.forEach(removeKey);
}

// ---------- small type guards ----------

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isArrayOf<T>(
  isItem: (value: unknown) => value is T
): Guard<T[]> {
  return (value: unknown): value is T[] =>
    Array.isArray(value) && value.every(isItem);
}
