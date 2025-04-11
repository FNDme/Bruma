import "./App.css";
import "./styles/editor.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import WelcomePage from "./pages/WelcomePage";
import { RoutineProvider } from "./contexts/RoutineContext";
import RoutinePage from "./pages/RoutinePage";
import ManageRoutinesPage from "./pages/ManageRoutinesPage";

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="bruma-theme">
      <SystemChecksProvider>
        <DeviceProvider>
          <JournalProvider>
            <UserCredentialsProvider>
              <VaultProvider>
                <TodoProvider>
                  <RoutineProvider>
                    <BrowserRouter>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<WelcomePage />} />
                          <Route
                            path="/collection"
                            element={<CollectionPage />}
                          />
                          <Route
                            path="/collection/new"
                            element={<WritePage />}
                          />
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
                          <Route path="/routines" element={<RoutinePage />} />
                          <Route
                            path="/routines/manage"
                            element={<ManageRoutinesPage />}
                          />
                        </Routes>
                      </Layout>
                    </BrowserRouter>
                  </RoutineProvider>
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
