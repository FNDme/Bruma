import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  NotificationPermissionStatus,
  ensureNotificationPermission,
  getNotificationPermission,
  readReminderSettings,
  showNotification,
  writeReminderSettings,
} from "@/lib/notifications";

const STATUS_TEXT: Record<NotificationPermissionStatus, string> = {
  granted: "Allowed. Reminders appear as system notifications.",
  default: "Not decided yet. Bruma will ask when you set your first reminder.",
  denied:
    "Blocked. Allow notifications for Bruma in your system settings; until then reminders only show inside the app.",
  unsupported:
    "Not available here. Reminders only show inside the app.",
};

export function ReminderSettingsCard() {
  const [enabled, setEnabled] = useState(() => readReminderSettings().enabled);
  const [status, setStatus] = useState<NotificationPermissionStatus>("default");

  const refresh = useCallback(() => {
    void getNotificationPermission().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const toggle = (checked: boolean) => {
    setEnabled(checked);
    if (!writeReminderSettings({ enabled: checked })) {
      toast.error("Could not save the reminder setting");
    }
  };

  const allow = async () => {
    const granted = await ensureNotificationPermission();
    refresh();
    if (!granted) toast.warning("Notifications were not allowed");
  };

  const test = async () => {
    const shown = await showNotification(
      "Bruma reminders are working",
      "You will be notified like this when a task or routine is due."
    );
    if (!shown) toast.error("Could not show a notification");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Reminders
        </CardTitle>
        <CardDescription>
          Notifications for todos with a reminder and routines that are not
          done yet. They are sent only while Bruma is running.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="reminders-enabled" className="text-sm font-medium">
            Send reminders
          </label>
          <Switch
            id="reminders-enabled"
            checked={enabled}
            onCheckedChange={toggle}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            System notifications: {STATUS_TEXT[status]}
          </p>
          <div className="flex gap-2">
            {status === "default" && (
              <Button size="sm" variant="outline" onClick={allow}>
                Allow notifications
              </Button>
            )}
            {status === "granted" && (
              <Button size="sm" variant="outline" onClick={test}>
                Send test notification
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
