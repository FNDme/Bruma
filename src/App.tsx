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
import PasswordGeneratorPage from "./pages/PasswordGeneratorPage";
import { VaultProvider } from "./contexts/VaultContext";
import { VaultPage } from "./pages/VaultPage";
import DiceRollerPage from "./pages/DiceRollerPage";
import ChooseForMePage from "./pages/ChooseForMePage";
import { TodoProvider } from "./contexts/TodoContext";
import TodoPage from "./pages/TodoPage";

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="bruma-theme">
      <SystemChecksProvider>
        <DeviceProvider>
          <JournalProvider>
            <UserCredentialsProvider>
              <VaultProvider>
                <TodoProvider>
                  <BrowserRouter>
                    <Layout>
                      <Routes>
                        <Route
                          path="/"
                          element={<Navigate to="/write" replace />}
                        />
                        <Route
                          path="/collection"
                          element={<CollectionPage />}
                        />
                        <Route path="/collection/new" element={<WritePage />} />
                        <Route
                          path="/collection/:noteId"
                          element={<NotePage />}
                        />
                        <Route
                          path="/collection/:noteId/edit"
                          element={<WritePage />}
                        />
                        <Route
                          path="/system-checks"
                          element={<SystemChecksPage />}
                        />
                        <Route
                          path="/password-generator"
                          element={<PasswordGeneratorPage />}
                        />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/vault" element={<VaultPage />} />
                        <Route
                          path="/dice-roller"
                          element={<DiceRollerPage />}
                        />
                        <Route
                          path="/choose-for-me"
                          element={<ChooseForMePage />}
                        />
                        <Route path="/todo" element={<TodoPage />} />
                      </Routes>
                    </Layout>
                  </BrowserRouter>
                </TodoProvider>
              </VaultProvider>
            </UserCredentialsProvider>
          </JournalProvider>
        </DeviceProvider>
      </SystemChecksProvider>
    </ThemeProvider>
  );
}

export default App;
