import { toast } from "sonner";
import {
  ensureNotificationPermission,
  readReminderSettings,
} from "@/lib/notifications";

let warnedThisSession = false;

/**
 * Called when the user turns a reminder on. Asks for notification permission
 * the first time only, and explains (once per session) what happens when
 * notifications are unavailable. Never throws.
 */
export async function requestReminderPermission(): Promise<boolean> {
  if (!readReminderSettings().enabled) {
    if (!warnedThisSession) {
      warnedThisSession = true;
      toast.info("Reminders are turned off", {
        description: "Turn them back on in Settings to get notified.",
      });
    }
    return false;
  }
  const granted = await ensureNotificationPermission();
  if (!granted && !warnedThisSession) {
    warnedThisSession = true;
    toast.warning("Notifications are not allowed", {
      description:
        "Bruma will show reminders inside the app while it is open. Allow notifications for Bruma in your system settings to get them outside the app.",
    });
  }
  return granted;
}
