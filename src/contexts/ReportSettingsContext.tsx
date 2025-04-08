import { createContext, useContext, useState, ReactNode } from "react";

interface ReportSettings {
  userName: string;
  userEmail: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

interface ReportSettingsContextType {
  settings: ReportSettings;
  setSettings: (settings: ReportSettings) => void;
  saveSettings: () => void;
}

const defaultSettings: ReportSettings = {
  userName: "",
  userEmail: "",
  supabaseUrl: "",
  supabaseAnonKey: "",
};

const ReportSettingsContext = createContext<
  ReportSettingsContextType | undefined
>(undefined);

export function ReportSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ReportSettings>(() => {
    // Try to load settings from localStorage on initialization
    const savedSettings = localStorage.getItem("reportSettings");
    return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
  });

  const saveSettings = () => {
    // Save settings to localStorage
    localStorage.setItem("reportSettings", JSON.stringify(settings));
  };

  return (
    <ReportSettingsContext.Provider
      value={{ settings, setSettings, saveSettings }}
    >
      {children}
    </ReportSettingsContext.Provider>
  );
}

export function useReportSettings() {
  const context = useContext(ReportSettingsContext);
  if (context === undefined) {
    throw new Error(
      "useReportSettings must be used within a ReportSettingsProvider"
    );
  }
  return context;
}
