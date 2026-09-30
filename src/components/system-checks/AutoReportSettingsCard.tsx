import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { CloudUpload } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserCredentials } from "@/contexts/UserCredentialsContext";
import { ensureNotificationPermission } from "@/lib/notifications";
import {
  AUTO_REPORT_INTERVALS,
  AutoReportIntervalDays,
  AutoReportSettings,
  AutoReportState,
  nextAutoReportAt,
  onAutoReportChange,
  readAutoReportSettings,
  readAutoReportState,
  writeAutoReportSettings,
} from "@/lib/securityReport";
import { errorMessage } from "@/lib/utils";

function formatWhen(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AutoReportSettingsCard() {
  const { credentials } = useUserCredentials();
  const [settings, setSettings] = useState<AutoReportSettings>(readAutoReportSettings);
  const [state, setState] = useState<AutoReportState>(readAutoReportState);
  const [busy, setBusy] = useState(false);

  useEffect(
    () =>
      onAutoReportChange(() => {
        setSettings(readAutoReportSettings());
        setState(readAutoReportState());
      }),
    []
  );

  const hasIdentity =
    credentials.userEmail.trim() !== "" && credentials.userName.trim() !== "";

  const save = (next: AutoReportSettings) => {
    if (writeAutoReportSettings(next)) setSettings(next);
    else toast.error("Could not save the setting");
  };

  const toggle = async (enabled: boolean) => {
    if (!enabled) {
      save({ ...settings, enabled: false });
      return;
    }
    if (!hasIdentity) {
      toast.error("Add your name and email first", {
        description: "They are under System Checks > Settings.",
      });
      return;
    }
    setBusy(true);
    try {
      if (!(await invoke<boolean>("has_supabase_credentials"))) {
        toast.error("Add the Supabase credentials first", {
          description: "They are under System Checks > Settings.",
        });
        return;
      }
    } catch (error) {
      toast.error(errorMessage(error, "Could not read the Supabase credentials"));
      return;
    } finally {
      setBusy(false);
    }
    save({ ...settings, enabled: true });
    // Regressions are announced with a notification; ask now, never again after a denial
    void ensureNotificationPermission();
    toast.success("Automatic reports turned on", {
      description: "The first check runs about a minute from now if a report is due.",
    });
  };

  const nextAt = nextAutoReportAt(settings, state);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudUpload className="h-4 w-4" />
          Automatic compliance reports
          <span className="rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {settings.enabled ? "On" : "Off"}
          </span>
        </CardTitle>
        <CardDescription>
          When turned on, Bruma runs the security checks in the background and{" "}
          <strong className="font-medium text-foreground">
            sends the results to your organization's Supabase database
          </strong>
          : the same report as <em>Send Report</em> on{" "}
          <Link to="/system-checks" className="underline underline-offset-2">
            System Checks
          </Link>
          , with your name, email, device ID, operating system and the result
          of each check. Checks that fail are included and recorded as
          non-compliant. Reports are only sent while Bruma is running. This is
          off unless you turn it on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="auto-report-enabled" className="text-sm font-medium">
            Send compliance reports automatically
          </label>
          <Switch
            id="auto-report-enabled"
            checked={settings.enabled}
            disabled={busy}
            onCheckedChange={(checked) => void toggle(checked)}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="auto-report-interval" className="text-sm font-medium">
            How often
          </label>
          <Select
            value={String(settings.intervalDays)}
            onValueChange={(value) =>
              save({
                ...settings,
                intervalDays: Number(value) as AutoReportIntervalDays,
              })
            }
          >
            <SelectTrigger id="auto-report-interval" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTO_REPORT_INTERVALS.map((option) => (
                <SelectItem key={option.days} value={String(option.days)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          {!hasIdentity && (
            <p className="text-amber-600 dark:text-amber-500">
              Your name and email are not set yet. Add them under System Checks
              &gt; Settings before turning this on.
            </p>
          )}
          <p>
            Last report from this device:{" "}
            {state.lastSentAt ? formatWhen(state.lastSentAt) : "none recorded yet"}
          </p>
          {settings.enabled && nextAt !== null && (
            <p>
              Next report:{" "}
              {nextAt <= Date.now()
                ? "at the next check (within a few minutes)"
                : formatWhen(nextAt)}
            </p>
          )}
          {state.lastError && (
            <p className="text-destructive">
              Last automatic attempt
              {state.lastAttemptAt ? ` (${formatWhen(state.lastAttemptAt)})` : ""}{" "}
              failed: {state.lastError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
