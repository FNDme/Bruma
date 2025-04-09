import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSystemChecks } from "@/contexts/SystemChecksContext";
import { invoke } from "@tauri-apps/api/core";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function UserInfoForm() {
  const [userFullName, setUserFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { checks } = useSystemChecks();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSending(true);

    try {
      const report = {
        antivirus: checks.find((c) => c.id === "antivirus")?.result,
        disk_encryption: checks.find((c) => c.id === "disk-encryption")?.result,
        screen_lock: checks.find((c) => c.id === "lock-screen")?.result,
      };
      console.log("Sending report with params:", {
        userEmail: userEmail,
        userFullName: userFullName,
        report,
      });
      const success = await invoke<boolean>("send_security_report", {
        userEmail,
        userFullName: userFullName,
        report,
      });
      console.log(success);

      if (!success) {
        throw new Error("Failed to send report");
      }

      // Clear form on success
      setUserFullName("");
      setUserEmail("");
    } catch (err) {
      console.log(err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send report";
      if (errorMessage.includes("duplicate key value")) {
        setError(
          "A report for this device already exists. Please try again later."
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={userFullName}
          onChange={(e) => setUserFullName(e.target.value)}
          placeholder="Enter your name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          placeholder="Enter your email"
          required
        />
      </div>
      <Button type="submit" disabled={isSending}>
        {isSending ? "Sending..." : "Send Report"}
      </Button>
    </form>
  );
}
