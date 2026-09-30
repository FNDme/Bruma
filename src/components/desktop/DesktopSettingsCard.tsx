import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppWindow } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Kbd } from "@/components/command/ShortcutsList";
import {
  DesktopSettings,
  DesktopStatus,
  acceleratorToCombo,
  getDesktopStatus,
  isDesktopApp,
  setAutostart,
  setDesktopSettings,
} from "@/lib/desktop";
import { errorMessage } from "@/lib/utils";

interface RowProps {
  id: string;
  label: string;
  description: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

function SettingRow({ id, label, description, checked, disabled, onChange }: RowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="mt-0.5"
      />
    </div>
  );
}

export function DesktopSettingsCard() {
  const desktop = isDesktopApp();
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (!desktop) return;
    getDesktopStatus()
      .then((next) => {
        setStatus(next);
        setLoadError(null);
      })
      .catch((error) => setLoadError(errorMessage(error, "Could not load the desktop settings")));
  }, [desktop]);

  useEffect(refresh, [refresh]);

  const update = async (change: () => Promise<DesktopStatus>, failure: string) => {
    setBusy(true);
    try {
      setStatus(await change());
    } catch (error) {
      toast.error(errorMessage(error, failure));
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const patch = (next: Partial<DesktopSettings>) =>
    update(() => setDesktopSettings(next), "Could not save the setting");

  const header = (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <AppWindow className="h-4 w-4" />
        Desktop
      </CardTitle>
      <CardDescription>
        Tray icon, quick capture from anywhere and launching Bruma when you log
        in. The tray menu has Open, Quick note, Quick todo, Run system checks
        and Quit.
      </CardDescription>
    </CardHeader>
  );

  if (!desktop) {
    return (
      <Card>
        {header}
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only available in the Bruma desktop app.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        {header}
        <CardContent className="space-y-3">
          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : (
            <>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const { settings } = status;
  const combo = acceleratorToCombo(status.quickCaptureCombo);
  const noTray = !status.trayAvailable;
  const autostartOn = status.autostartEnabled === true;

  return (
    <Card>
      {header}
      <CardContent className="space-y-5">
        {noTray && (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            The tray icon is not available on this system, so Bruma cannot keep
            running in the background. On Linux this usually needs an
            AppIndicator extension.
          </p>
        )}

        <SettingRow
          id="desktop-quick-capture"
          label="Quick capture shortcut"
          checked={settings.quickCaptureShortcut}
          disabled={busy}
          onChange={(checked) => void patch({ quickCaptureShortcut: checked })}
          description={
            <div className="space-y-1">
              <p className="flex flex-wrap items-center gap-1">
                Press <Kbd combo={combo} /> in any app to add a todo or a note.
              </p>
              {status.shortcutError ? (
                <p className="text-destructive">{status.shortcutError}</p>
              ) : (
                settings.quickCaptureShortcut &&
                !status.shortcutRegistered && (
                  <p className="text-amber-600 dark:text-amber-500">
                    The shortcut is not active.
                  </p>
                )
              )}
            </div>
          }
        />

        <SettingRow
          id="desktop-close-to-tray"
          label="Keep running in the tray when the window is closed"
          checked={settings.closeToTray && !noTray}
          disabled={busy || noTray}
          onChange={(checked) => void patch({ closeToTray: checked })}
          description="Closing the window hides it; reminders and quick capture keep working. Use Quit in the tray menu to exit."
        />

        <SettingRow
          id="desktop-autostart"
          label="Launch Bruma when you log in"
          checked={autostartOn}
          disabled={busy || status.autostartEnabled === null}
          onChange={(checked) =>
            void update(
              () => setAutostart(checked),
              "Could not change launch at login"
            )
          }
          description={
            status.autostartError ? (
              <span className="text-destructive">{status.autostartError}</span>
            ) : (
              "Adds Bruma to your login items."
            )
          }
        />

        <SettingRow
          id="desktop-start-hidden"
          label="Start in the tray when launched at login"
          checked={settings.startHiddenAtLogin && !noTray}
          disabled={busy || noTray || !autostartOn}
          onChange={(checked) => void patch({ startHiddenAtLogin: checked })}
          description="Opens without showing the window. Click the tray icon to open it."
        />
      </CardContent>
    </Card>
  );
}
