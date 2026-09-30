/**
 * Building and sending the compliance report, shared by the System Checks
 * page (manual send) and the opt-in automatic reporter.
 *
 * Both go through the same `send_security_report` command (supabase.rs), so
 * the payload and the row that gets written are identical either way.
 */
import { invoke } from "@tauri-apps/api/core";
import type { CheckStatus, SystemCheck } from "@/contexts/SystemChecksContext";
import {
  STORAGE_KEYS,
  isBoolean,
  isNumber,
  isRecord,
  isString,
  readJson,
  writeJson,
} from "./storage";

export interface SecurityReportPayload {
  antivirus?: string | number;
  disk_encryption?: string | number;
  screen_lock?: number;
}

export interface ReporterIdentity {
  userEmail: string;
  userName: string;
}

/**
 * Failed and errored checks are sent as missing values, which the backend
 * records as non-compliant.
 */
export function buildSecurityReport(checks: SystemCheck[]): SecurityReportPayload {
  const resultOf = (id: string) => {
    const check = checks.find((c) => c.id === id);
    return check?.status === "completed" ? check.result : undefined;
  };
  const screenLock = resultOf("screen_lock") as unknown;
  const screenLockMinutes =
    typeof screenLock === "number"
      ? screenLock
      : typeof screenLock === "string" && screenLock.trim() !== ""
        ? Number(screenLock)
        : undefined;
  return {
    antivirus: resultOf("antivirus"),
    disk_encryption: resultOf("disk_encryption"),
    screen_lock:
      screenLockMinutes !== undefined && Number.isFinite(screenLockMinutes)
        ? Math.max(0, Math.round(screenLockMinutes))
        : undefined,
  };
}

/** Checks that did not pass or could not run. */
export function failingChecks(checks: SystemCheck[]): SystemCheck[] {
  return checks.filter(
    (check) => check.status === "failed" || check.status === "error"
  );
}

/** Sends the report for these results. Rejects with the backend's message. */
export async function sendSecurityReport(
  identity: ReporterIdentity,
  checks: SystemCheck[]
): Promise<void> {
  await invoke<boolean>("send_security_report", {
    userEmail: identity.userEmail,
    userFullName: identity.userName,
    report: buildSecurityReport(checks),
  });
  recordReportSent(Date.now(), checks);
}

// ---------- automatic reporting (opt-in, off by default) ----------

export const AUTO_REPORT_INTERVALS = [
  { days: 1, label: "Every day" },
  { days: 7, label: "Every week" },
  { days: 30, label: "Every 30 days" },
] as const;

export type AutoReportIntervalDays = (typeof AUTO_REPORT_INTERVALS)[number]["days"];

export interface AutoReportSettings {
  enabled: boolean;
  intervalDays: AutoReportIntervalDays;
}

export const DEFAULT_AUTO_REPORT_SETTINGS: AutoReportSettings = {
  enabled: false,
  intervalDays: 7,
};

function isInterval(value: unknown): value is AutoReportIntervalDays {
  return AUTO_REPORT_INTERVALS.some((option) => option.days === value);
}

function isAutoReportSettings(value: unknown): value is AutoReportSettings {
  return isRecord(value) && isBoolean(value.enabled) && isInterval(value.intervalDays);
}

export function readAutoReportSettings(): AutoReportSettings {
  return readJson(
    STORAGE_KEYS.autoReportSettings,
    DEFAULT_AUTO_REPORT_SETTINGS,
    isAutoReportSettings
  );
}

export function writeAutoReportSettings(settings: AutoReportSettings): boolean {
  const ok = writeJson(STORAGE_KEYS.autoReportSettings, settings);
  if (ok) notifyAutoReportChange();
  return ok;
}

export interface AutoReportState {
  /** Last successful send (manual or automatic), epoch ms */
  lastSentAt?: number;
  /** Last automatic attempt, successful or not, epoch ms */
  lastAttemptAt?: number;
  /** Why the last automatic attempt failed; cleared on success */
  lastError?: string;
  /** Check statuses from the last sent report, to spot regressions */
  lastStatuses?: Record<string, CheckStatus>;
}

const CHECK_STATUSES: CheckStatus[] = ["pending", "running", "completed", "failed", "error"];

function isAutoReportState(value: unknown): value is AutoReportState {
  if (!isRecord(value)) return false;
  const optional = (v: unknown, guard: (x: unknown) => boolean) =>
    v === undefined || guard(v);
  return (
    optional(value.lastSentAt, isNumber) &&
    optional(value.lastAttemptAt, isNumber) &&
    optional(value.lastError, isString) &&
    optional(
      value.lastStatuses,
      (v) =>
        isRecord(v) &&
        Object.values(v).every((s) => CHECK_STATUSES.includes(s as CheckStatus))
    )
  );
}

export function readAutoReportState(): AutoReportState {
  return readJson<AutoReportState>(STORAGE_KEYS.autoReportState, {}, isAutoReportState);
}

export function updateAutoReportState(patch: Partial<AutoReportState>): AutoReportState {
  const next = { ...readAutoReportState(), ...patch };
  (Object.keys(patch) as (keyof AutoReportState)[]).forEach((key) => {
    if (patch[key] === undefined) delete next[key];
  });
  writeJson(STORAGE_KEYS.autoReportState, next);
  notifyAutoReportChange();
  return next;
}

function recordReportSent(at: number, checks: SystemCheck[]): void {
  updateAutoReportState({
    lastSentAt: at,
    lastError: undefined,
    lastStatuses: Object.fromEntries(checks.map((c) => [c.id, c.status])),
  });
}

/** Checks that passed in the last sent report but do not pass now. */
export function findRegressions(
  previous: Record<string, CheckStatus> | undefined,
  checks: SystemCheck[]
): SystemCheck[] {
  if (!previous) return [];
  return checks.filter(
    (check) =>
      previous[check.id] === "completed" &&
      (check.status === "failed" || check.status === "error")
  );
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimum wait before retrying after a failed automatic attempt. */
export const AUTO_REPORT_RETRY_MS = 6 * 60 * 60 * 1000;

/** When the next automatic report is due, or null when it is off. */
export function nextAutoReportAt(
  settings: AutoReportSettings,
  state: AutoReportState
): number | null {
  if (!settings.enabled) return null;
  const dueBySend = (state.lastSentAt ?? 0) + settings.intervalDays * DAY_MS;
  const dueByRetry =
    state.lastError && state.lastAttemptAt
      ? state.lastAttemptAt + AUTO_REPORT_RETRY_MS
      : 0;
  return Math.max(dueBySend, dueByRetry);
}

// Same-window listeners (the storage event only fires in other windows).
const AUTO_REPORT_EVENT = "bruma:auto-report-change";

function notifyAutoReportChange(): void {
  try {
    window.dispatchEvent(new Event(AUTO_REPORT_EVENT));
  } catch {
    // ignore (no window)
  }
}

export function onAutoReportChange(listener: () => void): () => void {
  window.addEventListener(AUTO_REPORT_EVENT, listener);
  return () => window.removeEventListener(AUTO_REPORT_EVENT, listener);
}
