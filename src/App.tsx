import "./styles/editor.css";
import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useRouteError,
} from "react-router-dom";
import { lazy, Suspense, type ComponentType } from "react";
import { Layout } from "@/components/layout/Layout";
import { RouteFallback } from "@/components/layout/RouteFallback";
import { JournalProvider } from "./contexts/JournalContext";
import { DeviceProvider } from "./contexts/DeviceContext";
import { SystemChecksProvider } from "./contexts/SystemChecksContext";
import { UserCredentialsProvider } from "./contexts/UserCredentialsContext";
import { TodoProvider } from "./contexts/TodoContext";
import { RoutineProvider } from "./contexts/RoutineContext";
// The landing page stays in the main chunk so the first paint needs no extra
// request; every other page is split into its own chunk and loaded on demand.
import WelcomePage from "./pages/WelcomePage";

/** React.lazy for modules that export the page under a named export. */
function lazyNamed<M, K extends keyof M>(
  load: () => Promise<M>,
  name: K
) {
  return lazy(async () => ({
    default: (await load())[name] as unknown as ComponentType,
  }));
}

const WritePage = lazyNamed(() => import("./pages/WritePage"), "WritePage");
const CollectionPage = lazyNamed(
  () => import("./pages/CollectionPage"),
  "CollectionPage"
);
const SettingsPage = lazyNamed(
  () => import("./pages/SettingsPage"),
  "SettingsPage"
);
const NotePage = lazyNamed(() => import("./pages/NotePage"), "NotePage");
const FolderPage = lazyNamed(() => import("./pages/FolderPage"), "FolderPage");
const SystemChecksPage = lazy(() => import("./pages/SystemChecksPage"));
const PasswordGeneratorPage = lazy(
  () => import("./pages/PasswordGeneratorPage")
);
const DiceRollerPage = lazy(() => import("./pages/DiceRollerPage"));
const ChooseForMePage = lazy(() => import("./pages/ChooseForMePage"));
const TodoPage = lazy(() => import("./pages/TodoPage"));
const RoutinePage = lazy(() => import("./pages/RoutinePage"));
const ManageRoutinesPage = lazy(() => import("./pages/ManageRoutinesPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function RootLayout() {
  return (
    <Layout>
      {/* Inside Layout's inline ErrorBoundary, so a chunk that fails to load
          shows the recoverable error screen while the sidebar keeps working. */}
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

// Route render errors are normally caught by the ErrorBoundary inside Layout.
// Anything that escapes it (e.g. an error in Layout itself) is re-thrown so the
// app-level ErrorBoundary in main.tsx shows its recovery screen instead of the
// router's default error page.
function RethrowRouteError(): never {
  throw useRouteError();
}

// A data router is required for useBlocker (unsaved-changes guard in WritePage).
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RethrowRouteError />,
    children: [
      { path: "/", element: <WelcomePage /> },
      { path: "/collection", element: <CollectionPage /> },
      { path: "/collection/new", element: <WritePage /> },
      { path: "/collection/:noteId", element: <NotePage /> },
      { path: "/collection/:noteId/edit", element: <WritePage /> },
      { path: "/collection/folder/:folderId", element: <FolderPage /> },
      { path: "/system-checks", element: <SystemChecksPage /> },
      { path: "/password-generator", element: <PasswordGeneratorPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/dice-roller", element: <DiceRollerPage /> },
      { path: "/choose-for-me", element: <ChooseForMePage /> },
      { path: "/todo", element: <TodoPage /> },
      { path: "/routines", element: <RoutinePage /> },
      { path: "/routines/manage", element: <ManageRoutinesPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return (
    <SystemChecksProvider>
      <DeviceProvider>
        <JournalProvider>
          <UserCredentialsProvider>
            <TodoProvider>
              <RoutineProvider>
                <RouterProvider router={router} />
              </RoutineProvider>
            </TodoProvider>
          </UserCredentialsProvider>
        </JournalProvider>
      </DeviceProvider>
    </SystemChecksProvider>
  );
}

export default App;
