import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useSystemChecks } from "@/contexts/SystemChecksContext";
import { useUserCredentials } from "@/contexts/UserCredentialsContext";
import { showNotification } from "@/lib/notifications";
import {
  DAY_MS,
  failingChecks,
  findRegressions,
  nextAutoReportAt,
  onAutoReportChange,
  readAutoReportSettings,
  readAutoReportState,
  sendSecurityReport,
  updateAutoReportState,
} from "@/lib/securityReport";
import { errorMessage } from "@/lib/utils";

/** Wait after startup so the first run does not compete with app launch. */
const STARTUP_DELAY_MS = 60_000;
/** How often to look at the schedule. Only local storage is read unless a report is due. */
const CHECK_INTERVAL_MS = 15 * 60_000;

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Opt-in automatic compliance reporting (off by default, see Settings).
 *
 * When enabled and a report is due, runs the security checks and sends the
 * results through the same send_security_report command as the System Checks
 * page. A report sent by hand (or recorded in Supabase for this device and
 * email) resets the schedule, so nothing is sent more often than chosen.
 * Mount once, inside the router and the app providers.
 */
export function useAutoReport() {
  const { runChecks } = useSystemChecks();
  const { credentials } = useUserCredentials();
  const navigate = useNavigate();
  const latest = useRef({ runChecks, credentials, navigate });
  latest.current = { runChecks, credentials, navigate };
  const inFlight = useRef(false);

  const attempt = useCallback(async () => {
    if (inFlight.current) return;
    const settings = readAutoReportSettings();
    const dueAt = nextAutoReportAt(settings, readAutoReportState());
    if (dueAt === null || Date.now() < dueAt) return;

    inFlight.current = true;
    const startedAt = Date.now();
    const fail = (message: string) => {
      const wasFailing = Boolean(readAutoReportState().lastError);
      updateAutoReportState({ lastAttemptAt: startedAt, lastError: message });
      toast.error("Automatic compliance report failed", {
        description: message,
        action: {
          label: "Settings",
          onClick: () => latest.current.navigate("/settings"),
        },
      });
      // One system notification per failure streak, not one per retry
      if (!wasFailing) {
        void showNotification("Bruma could not send the compliance report", message);
      }
    };

    try {
      const identity = {
        userEmail: latest.current.credentials.userEmail.trim(),
        userName: latest.current.credentials.userName.trim(),
      };
      if (!identity.userEmail || !identity.userName) {
        fail("Add your name and email under System Checks > Settings.");
        return;
      }
      if (!(await invoke<boolean>("has_supabase_credentials"))) {
        fail("Add the Supabase credentials under System Checks > Settings.");
        return;
      }

      // A report already stored for this device and email (e.g. sent before
      // this setting existed) counts, so the first automatic one is not early.
      const last = await invoke<{ last_check: string } | null>("get_last_report", {
        userEmail: identity.userEmail,
      });
      const lastAt = last ? Date.parse(last.last_check) : Number.NaN;
      if (
        Number.isFinite(lastAt) &&
        lastAt <= startedAt &&
        startedAt - lastAt < settings.intervalDays * DAY_MS
      ) {
        updateAutoReportState({
          lastSentAt: Math.max(lastAt, readAutoReportState().lastSentAt ?? 0),
          lastAttemptAt: startedAt,
          lastError: undefined,
        });
        return;
      }

      // The setting may have been turned off while we waited on the network
      if (!readAutoReportSettings().enabled) return;

      const results = await latest.current.runChecks();
      // A manual run is in progress; the next tick will try again
      if (results === null) return;

      const previous = readAutoReportState().lastStatuses;
      await sendSecurityReport(identity, results);
      updateAutoReportState({ lastAttemptAt: startedAt });

      const failing = failingChecks(results);
      const regressions = findRegressions(previous, results);
      if (regressions.length > 0) {
        const names = listNames(regressions.map((c) => c.name));
        void showNotification(
          "Device no longer compliant",
          `${names} stopped passing. Open Bruma > System Checks for details.`
        );
        toast.warning("Device no longer compliant", {
          description: `${names} stopped passing since the last report.`,
          action: {
            label: "View",
            onClick: () => latest.current.navigate("/system-checks"),
          },
        });
      } else {
        toast.success("Automatic compliance report sent", {
          description:
            failing.length > 0
              ? `${failing.length} of ${results.length} checks did not pass and were recorded as non-compliant.`
              : "All checks passed.",
        });
      }
    } catch (error) {
      console.error("Automatic report failed:", error);
      fail(errorMessage(error, "Could not send the report"));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const startup = window.setTimeout(() => void attempt(), STARTUP_DELAY_MS);
    const interval = window.setInterval(() => void attempt(), CHECK_INTERVAL_MS);
    // Turning the setting on (or changing the interval) re-evaluates soon,
    // but not instantly, so flipping the switch never sends mid-click.
    let pending: number | undefined;
    const unsubscribe = onAutoReportChange(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => void attempt(), STARTUP_DELAY_MS);
    });
    return () => {
      window.clearTimeout(startup);
      window.clearTimeout(pending);
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [attempt]);
}
