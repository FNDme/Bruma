import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { useTheme } from "../contexts/ThemeProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { PageLayout } from "@/components/layout/PageLayout";
import { ReminderSettingsCard } from "@/components/reminders/ReminderSettingsCard";
import { DesktopSettingsCard } from "@/components/desktop/DesktopSettingsCard";
import { AutoReportSettingsCard } from "@/components/system-checks/AutoReportSettingsCard";
import { Kbd, ShortcutsList } from "@/components/command/ShortcutsList";
import { shortcutFor } from "@/lib/shortcuts";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then((version) => {
        if (!cancelled) setAppVersion(version);
      })
      .catch((err) => {
        // Not running inside Tauri (e.g. plain browser dev server)
        console.error("Failed to read app version:", err);
        if (!cancelled) setAppVersion("Unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageLayout
      title="Settings"
      subtitle="Customize your application settings and preferences."
    >
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="theme-select" className="text-sm font-medium">
                Theme
              </label>
              <p className="text-sm text-muted-foreground">
                Choose your preferred theme.
              </p>
            </div>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger id="theme-select" className="w-[180px]">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <ReminderSettingsCard />

      <DesktopSettingsCard />

      <AutoReportSettingsCard />

      <Card>
        <CardHeader>
          <CardTitle>Keyboard shortcuts</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-1">
            Press <Kbd combo={shortcutFor("palette").combo} /> anywhere to
            search notes, todos and routines or run a command, and{" "}
            <Kbd combo={shortcutFor("shortcutsHelp").combo} /> to show this
            list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShortcutsList />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About Bruma</CardTitle>
          <CardDescription>Your personal companion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Version</h3>
            <p className="text-sm text-muted-foreground">
              {appVersion ?? "Loading..."}
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Your Toolbox for life</h3>
            <div className="text-sm text-muted-foreground">
              <p>
                Bruma is your digital Swiss Army knife, ready to tackle life's
                challenges head-on. Whether you're pouring your thoughts into a
                private journal, running security checks to keep your digital
                life safe, or preparing for future adventures, Bruma has your
                back. It's not just an app – it's your personal companion in the
                digital wilderness, growing and evolving with you every step of
                the way. Stay tuned for more powerful features coming your way!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
