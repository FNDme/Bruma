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

const initialChecks: SystemCheck[] = [
  {
    id: "antivirus",
    name: "Antivirus Check",
    description: "Verifying antivirus is installed and running",
    successMessage: (result?: string) =>
      `Antivirus is installed and running: ${result || "N/A"}`,
    errorMessage: (error?: string) =>
      `Antivirus check failed: ${error || "N/A"}`,
    status: "pending",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    id: "disk-encryption",
    name: "Disk Encryption Check",
    description: "Verifying disk encryption is enabled",
    successMessage: (result?: string) =>
      `Disk encryption is enabled: ${result || "N/A"}`,
    errorMessage: (error?: string) =>
      `Disk encryption check failed: ${error || "N/A"}`,
    status: "pending",
    icon: <HardDrive className="h-5 w-5" />,
  },
  {
    id: "lock-screen",
    name: "Lock Screen Check",
    description: "Verifying lock screen is enabled",
    successMessage: (result?: string) =>
      `Lock screen is enabled: ${result ? `${result} minutes` : "N/A"}`,
    errorMessage: (error?: string) =>
      `Lock screen check failed: ${error || "N/A"}`,
    status: "pending",
    icon: <Wallpaper className="h-5 w-5" />,
  },
];

const SystemChecksContext = createContext<SystemChecksContextType | undefined>(
  undefined
);

export function SystemChecksProvider({ children }: { children: ReactNode }) {
  const [checks, setChecks] = useState<SystemCheck[]>(initialChecks);
  const [isRunning, setIsRunning] = useState(false);
  const [timeTaken, setTimeTaken] = useState<number | null>(null);

  const runChecks = async () => {
    setIsRunning(true);
    setChecks(initialChecks.map((check) => ({ ...check, status: "running" })));
    const startTime = Date.now();
    await Promise.all([
      invoke("get_antivirus_info").then((antivirus: unknown) => {
        setChecks((prevChecks) => {
          const newChecks = [...prevChecks];
          const antivirusCheck = newChecks.findIndex(
            (check) => check.id === "antivirus"
          );
          newChecks[antivirusCheck] = {
            ...newChecks[antivirusCheck],
            status: !!antivirus ? "completed" : "failed",
            result: antivirus as string,
            error: antivirus ? undefined : "Antivirus not installed",
          };
          return newChecks;
        });
      }),
      invoke("get_disk_encryption_info").then((diskEncryption: unknown) => {
        setChecks((prevChecks) => {
          const newChecks = [...prevChecks];
          const diskEncryptionCheck = newChecks.findIndex(
            (check) => check.id === "disk-encryption"
          );
          newChecks[diskEncryptionCheck] = {
            ...newChecks[diskEncryptionCheck],
            status: !!diskEncryption ? "completed" : "failed",
            result: diskEncryption as string,
            error: diskEncryption ? undefined : "Disk encryption not enabled",
          };
          return newChecks;
        });
      }),
      invoke("get_screen_lock_info").then((screenLock: unknown) => {
        console.log(screenLock);
        setChecks((prevChecks) => {
          const newChecks = [...prevChecks];
          const screenLockCheck = newChecks.findIndex(
            (check) => check.id === "lock-screen"
          );
          newChecks[screenLockCheck] = {
            ...newChecks[screenLockCheck],
            status: !!screenLock ? "completed" : "failed",
            result: screenLock as string,
            error: screenLock ? undefined : "Screen lock not enabled",
          };
          return newChecks;
        });
      }),
    ]);
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
        checks,
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
