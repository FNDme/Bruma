import { useDevice } from "../contexts/DeviceContext";
import { useSystemChecks } from "../contexts/SystemChecksContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ChevronDown, ChevronUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SystemCheckItem } from "@/components/SystemCheckItem";
import { UserInfoForm } from "@/components/UserInfoForm";
import { SupabaseCredentialsForm } from "@/components/SupabaseCredentialsForm";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUserCredentials } from "@/contexts/UserCredentialsContext";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageLayout } from "@/components/layout/PageLayout";
import {
  failingChecks,
  onAutoReportChange,
  readAutoReportState,
  sendSecurityReport,
} from "@/lib/securityReport";

export default function SystemChecksPage() {
  const {
    deviceInfo,
    loading: deviceInfoLoading,
    error: deviceInfoError,
  } = useDevice();
  const { checks, isRunning, runChecks, resetChecks, timeTaken } =
    useSystemChecks();
  const { credentials } = useUserCredentials();

  const [isReportSettingsOpen, setIsReportSettingsOpen] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  // A manual send refetches the last report itself when it finishes
  const isSendingRef = useRef(false);
  isSendingRef.current = isSendingReport;
  const [lastReportDate, setLastReportDate] = useState<Date | null>(null);
  const [lastReportError, setLastReportError] = useState<string | null>(null);
  const [confirmFailedOpen, setConfirmFailedOpen] = useState(false);

  const checksInProgress = checks.some(
    (check) => check.status === "pending" || check.status === "running"
  );
  // Non-compliant checks and checks that could not run are both reported as failing
  const failedChecks = failingChecks(checks);

  const sendReport = async () => {
    isSendingRef.current = true;
    setIsSendingReport(true);
    const toastId = toast.loading("Sending report...");
    try {
      await sendSecurityReport(credentials, checks);
      toast.success(
        failedChecks.length > 0
          ? "Report sent, including the failed checks"
          : "Report sent successfully",
        { id: toastId }
      );
    } catch (error) {
      console.error(error);
      toast.error(errorMessage(error, "Failed to send report"), {
        id: toastId,
      });
    } finally {
      setIsSendingReport(false);
      fetchLastReport();
    }
  };

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();

    if (checksInProgress) {
      toast.error(
        isRunning
          ? "Wait for the checks to finish before sending the report"
          : "Run the checks before sending the report"
      );
      return;
    }

    if (!credentials.userEmail.trim() || !credentials.userName.trim()) {
      toast.error("Please enter your email and name");
      setIsReportSettingsOpen(true);
      return;
    }

    try {
      if (!(await invoke<boolean>("has_supabase_credentials"))) {
        toast.error("Please enter your supabase credentials");
        setIsReportSettingsOpen(true);
        return;
      }
    } catch (error) {
      console.error(error);
      toast.error(errorMessage(error, "Failed to read Supabase credentials"));
      setIsReportSettingsOpen(true);
      return;
    }

    if (failedChecks.length > 0) {
      setConfirmFailedOpen(true);
      return;
    }

    await sendReport();
  };

  const handleConfirmSendWithFailures = async () => {
    setConfirmFailedOpen(false);
    await sendReport();
  };

  const handleRunChecks = async () => {
    try {
      await runChecks();
    } catch (error) {
      console.error(error);
      toast.error(errorMessage(error, "Failed to run checks"));
    }
  };

  const handleResetChecks = () => {
    try {
      resetChecks();
    } catch (error) {
      console.error(error);
      toast.error(errorMessage(error, "Failed to reset checks"));
    }
  };

  const lastReportRequest = useRef(0);
  const fetchLastReport = useCallback(async () => {
    const requestId = ++lastReportRequest.current;
    const isCurrent = () => requestId === lastReportRequest.current;
    // Never show the previous email's report while the new one loads
    setLastReportDate(null);
    setLastReportError(null);

    const email = credentials.userEmail.trim();
    if (!email) return;

    try {
      if (!(await invoke<boolean>("has_supabase_credentials"))) return;
      const lastReport = await invoke<{ last_check: string } | null>(
        "get_last_report",
        { userEmail: email }
      );
      if (!isCurrent()) return;
      const date = lastReport ? new Date(lastReport.last_check) : null;
      setLastReportDate(date && !Number.isNaN(date.getTime()) ? date : null);
    } catch (error) {
      console.error(error);
      if (isCurrent()) {
        setLastReportError(
          errorMessage(error, "Failed to load the last report")
        );
      }
    }
  }, [credentials.userEmail]);

  // Show a report sent in the background (automatic reporting) without a reload
  useEffect(() => {
    let lastSentAt = readAutoReportState().lastSentAt;
    return onAutoReportChange(() => {
      const next = readAutoReportState().lastSentAt;
      if (next !== lastSentAt && !isSendingRef.current) fetchLastReport();
      lastSentAt = next;
    });
  }, [fetchLastReport]);

  useEffect(() => {
    // Debounced so typing an email does not query once per keystroke
    const timer = window.setTimeout(fetchLastReport, 400);
    return () => window.clearTimeout(timer);
  }, [fetchLastReport]);

  return (
    <PageLayout
      title="System Checks"
      headerActions={
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={handleResetChecks}
            disabled={isRunning || isSendingReport}
          >
            Reset
          </Button>
          <Button
            onClick={handleRunChecks}
            disabled={isRunning || isSendingReport}
          >
            Run Checks
          </Button>
        </div>
      }
    >
      {deviceInfoError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{deviceInfoError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div>
              Checks
              {lastReportDate && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Last report: {lastReportDate.toLocaleString()}
                  </span>
                  {new Date().getTime() - lastReportDate.getTime() >
                    30 * 24 * 60 * 60 * 1000 && (
                    <span className="text-xs text-yellow-500">
                      (More than a month has passed since the last report)
                    </span>
                  )}
                </div>
              )}
              {lastReportError && (
                <p className="text-xs font-normal text-destructive">
                  {lastReportError}
                </p>
              )}
            </div>
            {timeTaken !== null && (
              <span className="text-xs text-muted-foreground">
                {timeTaken}ms
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {checks.map((check) => (
              <SystemCheckItem key={check.id} check={check} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Collapsible
            open={isReportSettingsOpen}
            onOpenChange={setIsReportSettingsOpen}
          >
            <div className="flex items-center justify-between">
              <Button
                onClick={handleSubmit}
                disabled={isRunning || isSendingReport || checksInProgress}
                title={
                  checksInProgress ? "Run the checks first" : undefined
                }
              >
                Send Report
                <Send className="h-4 w-4 ml-2" />
              </Button>{" "}
              <div className="flex justify-end">
                <CollapsibleTrigger className="cursor-pointer flex items-center gap-2">
                  {isReportSettingsOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Settings
                </CollapsibleTrigger>
              </div>
            </div>
            <CollapsibleContent>
              <div className="pt-8 space-y-8">
                <div>
                  <UserInfoForm />
                </div>
                <div>
                  <SupabaseCredentialsForm />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {deviceInfoLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[300px]" />
            </div>
          ) : deviceInfo ? (
            <div className="space-y-2 text-muted-foreground">
              <p>
                <span className="font-light text-foreground">
                  Operating System:
                </span>{" "}
                {deviceInfo.os}
              </p>
              <p>
                <span className="font-light text-foreground">Version:</span>{" "}
                {deviceInfo.version}
              </p>
              <p>
                <span className="font-light text-foreground">Device ID:</span>{" "}
                {deviceInfo.device_id}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={confirmFailedOpen} onOpenChange={setConfirmFailedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a report with failed checks?</DialogTitle>
            <DialogDescription>
              {failedChecks.length === 1
                ? "One check did not pass or could not run."
                : `${failedChecks.length} checks did not pass or could not run.`}{" "}
              The report will record this device as non-compliant for:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-6 text-sm">
            {failedChecks.map((check) => (
              <li key={check.id}>
                <span className="font-medium">{check.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  (
                  {check.status === "error"
                    ? `could not run: ${check.error ?? "unknown error"}`
                    : check.detail ?? check.failureMessage}
                  )
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmFailedOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSendWithFailures}
              disabled={isSendingReport}
            >
              Send anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
