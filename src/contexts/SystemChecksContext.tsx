import { createContext, useContext, useState, ReactNode } from "react";
import { HardDrive, ShieldCheck, Wallpaper } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export type CheckStatus = "pending" | "running" | "completed" | "failed";

export interface SystemCheck {
  id: string;
  name: string;
  description: string;
  successMessage: (result?: string) => string;
  errorMessage: (error?: string) => string;
  status: CheckStatus;
  error?: string;
  icon?: ReactNode;
  result?: string;
}

interface SystemChecksContextType {
  checks: SystemCheck[];
  isRunning: boolean;
  timeTaken: number | null;
  runChecks: () => Promise<void>;
  resetChecks: () => void;
}

const securityChecks: (Omit<SystemCheck, "status"> & { cmd: string })[] = [
  {
    id: "antivirus",
    name: "Antivirus Check",
    description: "Verifying antivirus is installed and running",
    successMessage: (result?: string) =>
      `Antivirus is installed and running: ${result || "N/A"}`,
    errorMessage: (error?: string) =>
      `Antivirus check failed: ${error || "N/A"}`,
    icon: <ShieldCheck className="h-5 w-5" />,
    cmd: "get_antivirus_info",
  },
  {
    id: "disk_encryption",
    name: "Disk Encryption Check",
    description: "Verifying disk encryption is enabled",
    successMessage: (result?: string) =>
      `Disk encryption is enabled: ${result || "N/A"}`,
    errorMessage: (error?: string) =>
      `Disk encryption check failed: ${error || "N/A"}`,
    icon: <HardDrive className="h-5 w-5" />,
    cmd: "get_disk_encryption_info",
  },
  {
    id: "screen_lock",
    name: "Screen Lock Check",
    description: "Verifying screen lock is enabled",
    successMessage: (result?: string) =>
      `Screen lock is enabled: ${result ? `${result} minutes` : "N/A"}`,
    errorMessage: (error?: string) =>
      `Screen lock check failed: ${error || "N/A"}`,
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

  const runChecks = async () => {
    setIsRunning(true);
    setChecks(
      securityChecks.reduce((acc, check) => {
        acc[check.id] = { ...check, status: "running" };
        return acc;
      }, {} as Record<string, SystemCheck>)
    );
    setTimeTaken(null);
    const startTime = Date.now();
    await Promise.all(
      securityChecks.map((check) =>
        invoke(check.cmd).then((result: unknown) =>
          setChecks((prevChecks) => ({
            ...prevChecks,
            [check.id]: {
              ...prevChecks[check.id],
              status: !!result ? "completed" : "failed",
              result: result as string,
              error: result ? undefined : "Check failed",
            },
          }))
        )
      )
    );
    const endTime = Date.now();
    setTimeTaken(endTime - startTime);
    setIsRunning(false);
  };

  const resetChecks = () => {
    setChecks(initialChecks);
    setTimeTaken(null);
  };

  return (
    <SystemChecksContext.Provider
      value={{
        checks: Object.values(checks),
        isRunning,
        timeTaken,
        runChecks,
        resetChecks,
      }}
    >
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
