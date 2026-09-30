import { CheckStatus, SystemCheck } from "@/contexts/SystemChecksContext";
import { AlertTriangle } from "lucide-react";

const statusColor: Record<CheckStatus, string> = {
  completed: "bg-green-500/20 text-green-500",
  failed: "bg-red-500/20 text-red-500",
  error: "bg-amber-500/20 text-amber-500",
  running: "bg-yellow-500/20 text-yellow-500",
  pending: "bg-muted text-muted-foreground",
};

const statusLabel: Record<CheckStatus, string> = {
  completed: "Passed",
  failed: "Not compliant",
  error: "Could not run",
  running: "Running",
  pending: "Not run yet",
};

export function SystemCheckItem({ check }: { check: SystemCheck }) {
  return (
    <div className="flex items-center space-x-4 p-2 px-4 rounded-lg bg-muted/50">
      <div
        className={`flex shrink-0 items-center justify-center w-10 h-10 rounded-full ${
          statusColor[check.status]
        }`}
        title={statusLabel[check.status]}
        aria-label={statusLabel[check.status]}
      >
        {check.status === "running" ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : check.status === "error" ? (
          <AlertTriangle className="h-5 w-5" />
        ) : (
          check.icon
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium">{check.name}</h3>
        {check.status === "completed" && (
          <p className="text-sm text-muted-foreground">
            {check.successMessage(check.result)}
          </p>
        )}
        {check.status === "failed" && (
          <p className="text-sm text-red-500 mt-1">{check.failureMessage}</p>
        )}
        {check.status === "error" && (
          <p className="text-sm text-amber-600 dark:text-amber-500 mt-1 break-words">
            {check.errorMessage(check.error)}
          </p>
        )}
        {(check.status === "completed" || check.status === "failed") &&
          check.detail && (
            <p className="text-xs text-muted-foreground mt-1 break-words">
              {check.detail}
            </p>
          )}
        {check.status === "pending" && (
          <p className="text-sm text-muted-foreground">{check.description}</p>
        )}
        {check.status === "running" && (
          <p className="text-sm text-muted-foreground">Running...</p>
        )}
      </div>
    </div>
  );
}
