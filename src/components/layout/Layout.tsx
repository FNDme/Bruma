import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Key,
  ShieldCheck,
  Dices,
  SquarePercent,
  List,
  Calendar,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { useCallback, useEffect, useState } from "react";
import { BrumaIcon } from "@/components/icons/BrumaIcon";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useReminderScheduler } from "@/components/reminders/useReminderScheduler";
import { useAutoReport } from "@/components/system-checks/useAutoReport";
import { DesktopIntegration } from "@/components/desktop/DesktopIntegration";
import { handleExternalLinkClick } from "@/lib/externalLinks";
import { readString, STORAGE_KEYS, writeString } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/command/CommandPalette";
import { Kbd, ShortcutsDialog } from "@/components/command/ShortcutsList";
import { useHotkeys } from "@/hooks/useHotkeys";
import {
  formatCombo,
  isMac,
  shortcutFor,
  type ShortcutId,
} from "@/lib/shortcuts";
import { useTheme } from "@/contexts/ThemeProvider";
import "@/styles/fonts.css";

interface LayoutProps {
  children: React.ReactNode;
}

type NavigationItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const navigationItems: NavigationGroup[] = [
  {
    label: "Journal",
    items: [
      {
        label: "Collection",
        path: "/collection",
        icon: <BookOpen className="mr-2 h-4 w-4" />,
      },
      {
        label: "Todo List",
        path: "/todo",
        icon: <List className="mr-2 h-4 w-4" />,
      },
      {
        label: "Routines",
        path: "/routines",
        icon: <Calendar className="mr-2 h-4 w-4" />,
      },
    ],
  },
  {
    label: "Security",
    items: [
      {
        label: "System Checks",
        path: "/system-checks",
        icon: <ShieldCheck className="mr-2 h-4 w-4" />,
      },
      {
        label: "Password Generator",
        path: "/password-generator",
        icon: <Key className="mr-2 h-4 w-4" />,
      },
    ],
  },
  {
    label: "Randomizer",
    items: [
      {
        label: "Dice Roller",
        path: "/dice-roller",
        icon: <Dices className="mr-2 h-4 w-4" />,
      },
      {
        label: "Choose For Me",
        path: "/choose-for-me",
        icon: <SquarePercent className="mr-2 h-4 w-4" />,
      },
    ],
  },
];

/** True for the item's own path and any route nested under it. */
export function isNavItemActive(pathname: string, itemPath: string): boolean {
  if (itemPath === "/") return pathname === "/";
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function readCollapsed(): boolean {
  return readString(STORAGE_KEYS.sidebarCollapsed) === "true";
}

const GO_TO_SHORTCUTS: [ShortcutId, string][] = [
  ["goCollection", "/collection"],
  ["goTodo", "/todo"],
  ["goRoutines", "/routines"],
  ["goSystemChecks", "/system-checks"],
  ["goPasswordGenerator", "/password-generator"],
  ["goDiceRoller", "/dice-roller"],
  ["goChooseForMe", "/choose-for-me"],
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useReminderScheduler();
  useAutoReport();

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      writeString(STORAGE_KEYS.sidebarCollapsed, String(next));
      return next;
    });
  }, []);

  const closeOverlays = () => {
    setPaletteOpen(false);
    setShortcutsOpen(false);
  };
  const goTo = (path: string, state?: unknown) => {
    closeOverlays();
    navigate(path, state ? { state } : undefined);
  };

  useHotkeys([
    {
      combo: shortcutFor("palette").combo,
      handler: () => {
        setShortcutsOpen(false);
        setPaletteOpen((open) => !open);
      },
    },
    {
      combo: shortcutFor("shortcutsHelp").combo,
      handler: () => {
        setPaletteOpen(false);
        setShortcutsOpen((open) => !open);
      },
    },
    { combo: shortcutFor("toggleSidebar").combo, handler: toggleCollapsed },
    {
      combo: shortcutFor("toggleTheme").combo,
      handler: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    },
    { combo: shortcutFor("settings").combo, handler: () => goTo("/settings") },
    { combo: shortcutFor("newNote").combo, handler: () => goTo("/collection/new") },
    {
      combo: shortcutFor("newTodo").combo,
      handler: () => goTo("/todo", { focus: "new-todo" }),
    },
    ...GO_TO_SHORTCUTS.map(([id, path]) => ({
      combo: shortcutFor(id).combo,
      handler: () => goTo(path),
    })),
  ]);

  // Open external links (notes, anywhere in the app) with the system browser
  // instead of navigating the webview away from the app.
  useEffect(() => {
    document.addEventListener("click", handleExternalLinkClick);
    document.addEventListener("auxclick", handleExternalLinkClick);
    return () => {
      document.removeEventListener("click", handleExternalLinkClick);
      document.removeEventListener("auxclick", handleExternalLinkClick);
    };
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <nav
        id="app-sidebar"
        aria-label="Main navigation"
        className={`relative ${
          isCollapsed ? "w-18" : "w-64"
        } shrink-0 border-r border-border bg-muted/50 transition-all duration-300`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center justify-end mb-4">
            {!isCollapsed && (
              <Link
                to="/"
                aria-label="Bruma home"
                className="flex items-center gap-2 absolute left-4 rounded-md hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BrumaIcon className="h-10 w-10" aria-hidden="true" />
                <span className="text-lg font-alfa tracking-wide">Bruma</span>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={toggleCollapsed}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
              aria-controls="app-sidebar"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Button
            variant="outline"
            className={cn(
              "mb-4 w-full text-muted-foreground",
              isCollapsed ? "justify-center px-2" : "justify-start"
            )}
            onClick={() => setPaletteOpen(true)}
            aria-label="Search and commands"
            aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
            title={`Search and commands (${formatCombo(shortcutFor("palette").combo)})`}
          >
            <Search className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
            {!isCollapsed && (
              <>
                <span>Search…</span>
                <Kbd combo={shortcutFor("palette").combo} className="ml-auto" />
              </>
            )}
          </Button>
          <div className="space-y-4">
            {navigationItems.map((group) => (
              <div key={group.label} className="space-y-2">
                <h3 className="mx-2 text-sm font-semibold text-muted-foreground h-6 transition-all duration-300">
                  {isCollapsed ? (
                    <>
                      <Separator className="w-full translate-y-2" />
                      <span className="sr-only">{group.label}</span>
                    </>
                  ) : (
                    group.label
                  )}
                </h3>
                {group.items.map((item) => {
                  const active = isNavItemActive(location.pathname, item.path);
                  return (
                    <Button
                      key={item.path}
                      asChild
                      variant={active ? "default" : "ghost"}
                      className="w-full justify-start"
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Link
                        to={item.path}
                        aria-current={active ? "page" : undefined}
                        aria-label={isCollapsed ? item.label : undefined}
                      >
                        {item.icon}
                        {!isCollapsed && item.label}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-auto">
            <Separator className="my-4" />
            <Button
              asChild
              variant={
                isNavItemActive(location.pathname, "/settings")
                  ? "default"
                  : "ghost"
              }
              className={cn("w-full justify-start", isCollapsed && "px-2")}
              title={isCollapsed ? "Settings" : undefined}
            >
              <Link
                to="/settings"
                aria-current={
                  isNavItemActive(location.pathname, "/settings")
                    ? "page"
                    : undefined
                }
                aria-label={isCollapsed ? "Settings" : undefined}
              >
                <Settings className="mr-2 h-4 w-4" />
                {!isCollapsed && "Settings"}
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <ErrorBoundary variant="inline" resetKeys={[location.pathname]}>
          {children}
        </ErrorBoundary>
      </main>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onToggleSidebar={toggleCollapsed}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <DesktopIntegration />

      <Toaster />
    </div>
  );
}
