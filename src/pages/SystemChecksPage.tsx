import { useDevice } from "../contexts/DeviceContext";
import { useSystemChecks } from "../contexts/SystemChecksContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SystemCheckItem } from "@/components/SystemCheckItem";
import { UserInfoForm } from "@/components/UserInfoForm";
import { SupabaseCredentialsForm } from "@/components/SupabaseCredentialsForm";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import { useState } from "react";

export default function SystemChecksPage() {
  const {
    deviceInfo,
    loading: deviceInfoLoading,
    error: deviceInfoError,
  } = useDevice();
  const { checks, isRunning, runChecks, resetChecks, timeTaken } =
    useSystemChecks();

  const [isReportSettingsOpen, setIsReportSettingsOpen] = useState(false);

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">System Checks</h1>
        <div className="space-x-2">
          <Button variant="outline" onClick={resetChecks} disabled={isRunning}>
            Reset
          </Button>
          <Button onClick={runChecks} disabled={isRunning}>
            Run Checks
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Checks
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
        <CardHeader>
          <CardTitle>Supabase Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <SupabaseCredentialsForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report</CardTitle>
        </CardHeader>
        <CardContent>
          <Collapsible
            open={isReportSettingsOpen}
            onOpenChange={setIsReportSettingsOpen}
          >
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={() => setIsReportSettingsOpen(true)}
              >
                Send Report
              </Button>
              <CollapsibleTrigger className="cursor-pointer flex items-center gap-2">
                Report settings
                {isReportSettingsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="pt-8">
                <UserInfoForm />
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
          ) : deviceInfoError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{deviceInfoError}</AlertDescription>
            </Alert>
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
    </div>
  );
}
