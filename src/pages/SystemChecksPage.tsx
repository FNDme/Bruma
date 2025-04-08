import { useDevice } from "../contexts/DeviceContext";
import { useSystemChecks } from "../contexts/SystemChecksContext";
import { useReportSettings } from "../contexts/ReportSettingsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SystemCheckItem } from "@/components/SystemCheckItem";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { ChevronDown, Send } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function SystemChecksPage() {
  const {
    deviceInfo,
    loading: deviceInfoLoading,
    error: deviceInfoError,
  } = useDevice();
  const { checks, isRunning, runChecks, resetChecks, timeTaken } =
    useSystemChecks();
  const [isOpen, setIsOpen] = useState(false);
  const { settings, setSettings, saveSettings } = useReportSettings();
  const [isSending, setIsSending] = useState(false);

  const handleSaveSettings = () => {
    saveSettings();
  };

  const isReportValid = () => {
    return (
      settings.userName.trim() !== "" &&
      settings.userEmail.trim() !== "" &&
      settings.supabaseUrl.trim() !== "" &&
      settings.supabaseAnonKey.trim() !== "" &&
      deviceInfo?.device_id !== undefined
    );
  };

  const handleSendReport = async () => {
    if (!isReportValid()) return;

    setIsSending(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Report sent successfully:", {
        settings,
        deviceInfo,
        checks,
      });
    } catch (error) {
      console.error("Failed to send report:", error);
    } finally {
      setIsSending(false);
    }
  };

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
              <SystemCheckItem
                key={check.id}
                id={check.id}
                name={check.name}
                description={check.description}
                status={check.status}
                error={check.error}
                icon={check.icon}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report</CardTitle>
        </CardHeader>
        <CardContent className="">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex items-center justify-between">
              <Button
                onClick={handleSendReport}
                disabled={!isReportValid() || isSending}
              >
                {isSending ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Report
                  </>
                )}
              </Button>
              <CollapsibleTrigger className="flex items-center space-x-2">
                <span>Report Settings</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    isOpen ? "transform rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-6 pt-6">
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="userName">User Name</Label>
                <Input
                  id="userName"
                  placeholder="Enter your name"
                  value={settings.userName}
                  onChange={(e) =>
                    setSettings({ ...settings, userName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userEmail">User Email</Label>
                <Input
                  id="userEmail"
                  type="email"
                  placeholder="Enter your email"
                  value={settings.userEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, userEmail: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supabaseUrl">Supabase URL</Label>
                <Input
                  id="supabaseUrl"
                  placeholder="Enter your Supabase URL"
                  value={settings.supabaseUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, supabaseUrl: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supabaseAnonKey">Supabase Anonymous Key</Label>
                <Input
                  id="supabaseAnonKey"
                  type="password"
                  placeholder="Enter your Supabase anonymous key"
                  value={settings.supabaseAnonKey}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      supabaseAnonKey: e.target.value,
                    })
                  }
                />
              </div>
              <Button onClick={handleSaveSettings}>Save Settings</Button>
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
