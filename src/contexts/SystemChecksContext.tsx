import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { HardDrive, ShieldCheck, Wallpaper } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { errorMessage } from "@/lib/utils";

/**
 * - completed: the check ran and the device is compliant
 * - failed: the check ran and the device is not compliant
 * - error: the check could not run (missing tool, timeout, unreadable output)
 */
export type CheckStatus = "pending" | "running" | "completed" | "failed" | "error";

export type CheckResult = string | number;

export interface SystemCheck {
  id: string;
  name: string;
  description: string;
  successMessage: (result?: CheckResult) => string;
  failureMessage: string;
  errorMessage: (error?: string) => string;
  status: CheckStatus;
  /** Why the check could not run (status "error") */
  error?: string;
  /** Backend explanation of the outcome (status "completed" or "failed") */
  detail?: string;
  icon?: ReactNode;
  /** The value recorded in the report; only set when compliant */
  result?: CheckResult;
}

/** Shape returned by the get_*_info commands */
interface CheckOutcome {
  compliant: boolean;
  value: CheckResult | null;
  detail: string;
}

function isCheckOutcome(value: unknown): value is CheckOutcome {
  if (typeof value !== "object" || value === null) return false;
  const outcome = value as Record<string, unknown>;
  return (
    typeof outcome.compliant === "boolean" &&
    (outcome.value === null ||
      outcome.value === undefined ||
      typeof outcome.value === "string" ||
      typeof outcome.value === "number") &&
    (outcome.detail === undefined || typeof outcome.detail === "string")
  );
}

interface SystemChecksContextType {
  checks: SystemCheck[];
  isRunning: boolean;
  timeTaken: number | null;
  /**
   * Run every check. Resolves with the final results, or null when a run was
   * already in progress (the caller should not treat that as fresh results).
   */
  runChecks: () => Promise<SystemCheck[] | null>;
  resetChecks: () => void;
}

const securityChecks: (Omit<SystemCheck, "status"> & { cmd: string })[] = [
  {
    id: "antivirus",
    name: "Antivirus Check",
    description: "Verifying antivirus protection is detected",
    successMessage: (result?: CheckResult) =>
      `Antivirus detected: ${result ?? "N/A"}`,
    failureMessage: "No active antivirus detected",
    errorMessage: (error?: string) =>
      `Could not check antivirus: ${error || "unknown error"}`,
    icon: <ShieldCheck className="h-5 w-5" />,
    cmd: "get_antivirus_info",
  },
  {
    id: "disk_encryption",
    name: "Disk Encryption Check",
    description: "Verifying disk encryption is enabled",
    successMessage: (result?: CheckResult) =>
      `Disk encryption is enabled: ${result ?? "N/A"}`,
    failureMessage: "Disk encryption is not enabled",
    errorMessage: (error?: string) =>
      `Could not check disk encryption: ${error || "unknown error"}`,
    icon: <HardDrive className="h-5 w-5" />,
    cmd: "get_disk_encryption_info",
  },
  {
    id: "screen_lock",
    name: "Screen Lock Check",
    description: "Verifying screen lock is enabled",
    successMessage: (result?: CheckResult) =>
      `Screen lock is enabled: ${
        result !== undefined
          ? `${result} ${Number(result) === 1 ? "minute" : "minutes"}`
          : "N/A"
      }`,
    failureMessage: "Automatic screen lock is not enabled",
    errorMessage: (error?: string) =>
      `Could not check screen lock: ${error || "unknown error"}`,
    icon: <Wallpaper className="h-5 w-5" />,
    cmd: "get_screen_lock_info",
  },
];

const initialChecks: Record<string, SystemCheck> = securityChecks.reduce(
  (acc, check) => {
    acc[check.id] = { ...check, status: "pending" };
    return acc;
  },
  {} as Record<string, SystemCheck>
);

const SystemChecksContext = createContext<SystemChecksContextType | undefined>(
  undefined
);

export function SystemChecksProvider({ children }: { children: ReactNode }) {
  const [checks, setChecks] =
    useState<Record<string, SystemCheck>>(initialChecks);
  const [isRunning, setIsRunning] = useState(false);
  const [timeTaken, setTimeTaken] = useState<number | null>(null);

  const runningRef = useRef(false);

  const runChecks = useCallback(async (): Promise<SystemCheck[] | null> => {
    if (runningRef.current) return null;
    runningRef.current = true;
    setIsRunning(true);
    const running = securityChecks.reduce((acc, check) => {
      acc[check.id] = { ...check, status: "running" };
      return acc;
    }, {} as Record<string, SystemCheck>);
    // Tracked locally too, so the caller gets the results without waiting for a render
    const results: Record<string, SystemCheck> = { ...running };
    setChecks(running);
    setTimeTaken(null);
    const startTime = Date.now();
    const settle = (id: string, patch: Partial<SystemCheck>) => {
      results[id] = {
        ...results[id],
        result: undefined,
        detail: undefined,
        error: undefined,
        ...patch,
      };
      const settled = results[id];
      setChecks((prevChecks) => ({ ...prevChecks, [id]: settled }));
    };
    try {
      await Promise.all(
        securityChecks.map((check) =>
          invoke(check.cmd)
            .then((outcome: unknown) => {
              if (!isCheckOutcome(outcome)) {
                settle(check.id, {
                  status: "error",
                  error: "Unexpected response from the check",
                });
                return;
              }
              const value = outcome.value ?? undefined;
              settle(check.id, {
                status: outcome.compliant ? "completed" : "failed",
                result: outcome.compliant ? value : undefined,
                detail: outcome.detail || undefined,
              });
            })
            .catch((error: unknown) =>
              settle(check.id, {
                status: "error",
                error: errorMessage(error, "Check failed"),
              })
            )
        )
      );
      return securityChecks.map((check) => results[check.id]);
    } finally {
      setTimeTaken(Date.now() - startTime);
      setIsRunning(false);
      runningRef.current = false;
    }
  }, []);

  const resetChecks = useCallback(() => {
    if (runningRef.current) return;
    setChecks(initialChecks);
    setTimeTaken(null);
  }, []);

  const value = useMemo(
    () => ({
      checks: Object.values(checks),
      isRunning,
      timeTaken,
      runChecks,
      resetChecks,
    }),
    [checks, isRunning, timeTaken, runChecks, resetChecks]
  );

  return (
    <SystemChecksContext.Provider value={value}>
      {children}
    </SystemChecksContext.Provider>
  );
}

export function useSystemChecks() {
  const context = useContext(SystemChecksContext);
  if (context === undefined) {
    throw new Error(
      "useSystemChecks must be used within a SystemChecksProvider"
    );
  }
  return context;
}
