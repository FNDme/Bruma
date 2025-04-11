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
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useUserCredentials } from "@/contexts/UserCredentialsContext";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";

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
  const [lastReportDate, setLastReportDate] = useState<Date | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    if (!credentials.userEmail || !credentials.userName) {
      toast.error("Please enter your email and name");
      setIsReportSettingsOpen(true);
      return;
    }

    if (!(await invoke<boolean>("has_supabase_credentials"))) {
      toast.error("Please enter your supabase credentials");
      setIsReportSettingsOpen(true);
      return;
    }

    e.preventDefault();
    setIsSendingReport(true);
    const toastId = toast.loading("Sending report...");

    try {
      const report = {
        antivirus: checks.find((check) => check.id === "antivirus")?.result,
        disk_encryption: checks.find((check) => check.id === "disk_encryption")
          ?.result,
        screen_lock: checks.find((check) => check.id === "screen_lock")?.result,
      };

      if (!report.antivirus || !report.disk_encryption || !report.screen_lock) {
        toast.error("Please run all checks before sending the report", {
          id: toastId,
        });
        return;
      }

      const response = await invoke<boolean>("send_security_report", {
        userEmail: credentials.userEmail,
        userFullName: credentials.userName,
        report,
      });

      if (response) {
        toast.success("Report sent successfully", { id: toastId });
      } else {
        toast.error("Failed to send report", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send report",
        { id: toastId }
      );
    } finally {
      setIsSendingReport(false);
      fetchLastReport();
    }
  };

  const handleRunChecks = async () => {
    try {
      await runChecks();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to run checks"
      );
    }
  };

  const handleResetChecks = () => {
    try {
      resetChecks();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reset checks"
      );
    }
  };

  const fetchLastReport = async () => {
    try {
      const lastReport = await invoke<{ last_check: string } | null>(
        "get_last_report",
        { userEmail: credentials.userEmail }
      );
      if (lastReport) {
        setLastReportDate(new Date(lastReport.last_check));
      }
    } catch (error) {
      console.error(error);
    }
  };
  useEffect(() => {
    fetchLastReport();
  }, [credentials.userEmail]);

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
            </div>
            {timeTaken && (
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
                disabled={
                  isRunning ||
                  isSendingReport ||
                  checks.some((check) => check.status === "pending")
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
    </PageLayout>
  );
}
