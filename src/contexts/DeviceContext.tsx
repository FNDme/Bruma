import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";

interface DeviceInfo {
  os: string;
  version: string;
  device_id: string;
}

interface DeviceContextType {
  deviceInfo: DeviceInfo | null;
  loading: boolean;
  error: string | null;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeviceInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await invoke<DeviceInfo>("get_device_info");
      setDeviceInfo(info);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch device info"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceInfo();
  }, []);

  return (
    <DeviceContext.Provider
      value={{
        deviceInfo,
        loading,
        error,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error("useDevice must be used within a DeviceProvider");
  }
  return context;
}
