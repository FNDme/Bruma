import "./App.css";
import "./styles/editor.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { WritePage } from "./pages/WritePage";
import { CollectionPage } from "./pages/CollectionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotePage } from "./pages/NotePage";
import { ThemeProvider } from "./contexts/ThemeProvider";
import { JournalProvider } from "./contexts/JournalContext";
import { DeviceProvider } from "./contexts/DeviceContext";
import SystemChecksPage from "./pages/SystemChecksPage";
import { SystemChecksProvider } from "./contexts/SystemChecksContext";
import { UserCredentialsProvider } from "./contexts/UserCredentialsContext";

function App() {
  return (
    <SystemChecksProvider>
      <DeviceProvider>
        <ThemeProvider defaultTheme="system" storageKey="bruma-theme">
          <JournalProvider>
            <UserCredentialsProvider>
              <BrowserRouter>
                <Layout>
                  <Routes>
                    <Route
                      path="/"
                      element={<Navigate to="/write" replace />}
                    />
                    <Route path="/write" element={<WritePage />} />
                    <Route path="/collection" element={<CollectionPage />} />
                    <Route path="/collection/:noteId" element={<NotePage />} />
                    <Route
                      path="/system-checks"
                      element={<SystemChecksPage />}
                    />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                </Layout>
              </BrowserRouter>
            </UserCredentialsProvider>
          </JournalProvider>
        </ThemeProvider>
      </DeviceProvider>
    </SystemChecksProvider>
  );
}

export default App;
