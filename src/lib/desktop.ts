/**
 * Bridge to the desktop integration in src-tauri/src/desktop.rs: tray menu
 * actions, the global quick-capture shortcut, launch at login and "keep
 * running in the tray". Every call degrades gracefully outside Tauri.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const DESKTOP_ACTION_EVENT = "bruma://desktop-action";

export type DesktopAction =
  | "quick-capture"
  | "quick-note"
  | "quick-todo"
  | "run-checks";

export interface DesktopActionPayload {
  action: DesktopAction;
  /** The window was hidden in the tray before this action showed it */
  wasHidden: boolean;
}

export interface DesktopSettings {
  closeToTray: boolean;
  quickCaptureShortcut: boolean;
  startHiddenAtLogin: boolean;
}

export interface DesktopStatus {
  settings: DesktopSettings;
  trayAvailable: boolean;
  /** Tauri accelerator string, e.g. "CommandOrControl+Shift+Space" */
  quickCaptureCombo: string;
  shortcutRegistered: boolean;
  shortcutError: string | null;
  autostartEnabled: boolean | null;
  autostartError: string | null;
}

const ACTIONS: DesktopAction[] = [
  "quick-capture",
  "quick-note",
  "quick-todo",
  "run-checks",
];

function isActionPayload(value: unknown): value is DesktopActionPayload {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  return (
    ACTIONS.includes(payload.action as DesktopAction) &&
    typeof payload.wasHidden === "boolean"
  );
}

export function isDesktopApp(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

/** Subscribe to tray / global shortcut actions. Returns an unsubscribe function. */
export function onDesktopAction(
  handler: (payload: DesktopActionPayload) => void
): () => void {
  if (!isDesktopApp()) return () => {};
  let unlisten: (() => void) | null = null;
  let disposed = false;
  listen<unknown>(DESKTOP_ACTION_EVENT, (event) => {
    if (isActionPayload(event.payload)) handler(event.payload);
  })
    .then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    })
    .catch((error) => console.warn("Could not listen for tray actions:", error));
  return () => {
    disposed = true;
    unlisten?.();
  };
}

export function getDesktopStatus(): Promise<DesktopStatus> {
  return invoke<DesktopStatus>("get_desktop_status");
}

export function setDesktopSettings(
  patch: Partial<DesktopSettings>
): Promise<DesktopStatus> {
  return invoke<DesktopStatus>("set_desktop_settings", { patch });
}

export function setAutostart(enabled: boolean): Promise<DesktopStatus> {
  return invoke<DesktopStatus>("set_autostart", { enabled });
}

/** Send the main window back to the tray (used after a quick capture). */
export async function hideMainWindow(): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    await getCurrentWindow().hide();
  } catch (error) {
    console.warn("Could not hide the window:", error);
  }
}

/** "CommandOrControl+Shift+Space" -> "mod+shift+space" for the Kbd component. */
export function acceleratorToCombo(accelerator: string): string {
  return accelerator
    .split("+")
    .map((part) => {
      const key = part.trim().toLowerCase();
      if (["commandorcontrol", "cmdorctrl", "commandorctrl", "cmdorcontrol"].includes(key)) {
        return "mod";
      }
      if (key === "option") return "alt";
      if (key === "control") return "ctrl";
      return key;
    })
    .join("+");
}
