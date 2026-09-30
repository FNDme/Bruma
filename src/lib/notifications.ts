/**
 * Native notifications through tauri-plugin-notification.
 *
 * Every call is wrapped so a missing plugin, a browser without the
 * Notification API (plain `vite dev`) or a denied permission never throws;
 * callers get a boolean and can fall back to an in-app toast.
 */
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { STORAGE_KEYS, isBoolean, isRecord, readJson, writeJson } from "./storage";

export type NotificationPermissionStatus =
  | "granted"
  | "denied"
  | "default"
  | "unsupported";

function hasNotificationApi(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function getNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!hasNotificationApi()) return "unsupported";
  try {
    if (await isPermissionGranted()) return "granted";
    const current = window.Notification.permission;
    return current === "denied" ? "denied" : "default";
  } catch {
    return "unsupported";
  }
}

/**
 * Returns true when notifications may be shown, asking the OS for permission
 * only if the user has not decided yet. Never prompts after a denial.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const status = await getNotificationPermission();
  if (status === "granted") return true;
  if (status !== "default") return false;
  try {
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Show a native notification if permission was granted. Never prompts. */
export async function showNotification(
  title: string,
  body?: string
): Promise<boolean> {
  if ((await getNotificationPermission()) !== "granted") return false;
  try {
    sendNotification(body ? { title, body } : { title });
    return true;
  } catch (error) {
    console.warn("Failed to show notification:", error);
    return false;
  }
}

// ---------- user setting: reminders on/off ----------

export interface ReminderSettings {
  enabled: boolean;
}

const DEFAULT_SETTINGS: ReminderSettings = { enabled: true };

function isReminderSettings(value: unknown): value is ReminderSettings {
  return isRecord(value) && isBoolean(value.enabled);
}

export function readReminderSettings(): ReminderSettings {
  return readJson(STORAGE_KEYS.reminderSettings, DEFAULT_SETTINGS, isReminderSettings);
}

export function writeReminderSettings(settings: ReminderSettings): boolean {
  return writeJson(STORAGE_KEYS.reminderSettings, settings);
}
