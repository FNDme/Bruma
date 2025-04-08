import { createContext, useContext, useState, ReactNode } from "react";
import { HardDrive, ShieldCheck, Wallpaper } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export type CheckStatus = "pending" | "running" | "completed" | "failed";

export interface SystemCheck {
  id: string;
  name: string;
  description: string;
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
    status: "pending",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    id: "disk-encryption",
    name: "Disk Encryption Check",
    description: "Verifying disk encryption is enabled",
    status: "pending",
    icon: <HardDrive className="h-5 w-5" />,
  },
  {
    id: "lock-screen",
    name: "Lock Screen Check",
    description: "Verifying lock screen is enabled",
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
            status: "completed",
            result: antivirus as string,
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
            status: "completed",
            result: diskEncryption as string,
          };
          return newChecks;
        });
      }),
      invoke("get_screen_lock_info").then((screenLock: unknown) => {
        setChecks((prevChecks) => {
          const newChecks = [...prevChecks];
          const screenLockCheck = newChecks.findIndex(
            (check) => check.id === "lock-screen"
          );
          newChecks[screenLockCheck] = {
            ...newChecks[screenLockCheck],
            status: "completed",
            result: screenLock as string,
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
