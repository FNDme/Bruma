import { Link, useLocation } from "react-router-dom";
import {
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Key,
  ShieldCheck,
  Lock,
  Dices,
  SquarePercent,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";

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
        label: "Secure Vault",
        path: "/vault",
        icon: <Lock className="mr-2 h-4 w-4" />,
      },
      {
        label: "Todo List",
        path: "/todo",
        icon: <List className="mr-2 h-4 w-4" />,
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

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`relative ${
          isCollapsed ? "w-18" : "w-64"
        } border-r border-border bg-muted/50 transition-all duration-300`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center justify-end mb-4">
            {!isCollapsed && (
              <h1 className="text-lg font-semibold absolute left-4">Bruma</h1>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="space-y-4">
            {navigationItems.map((group) => (
              <div key={group.label} className="space-y-2">
                <h3 className="mx-2 text-sm font-semibold text-muted-foreground h-6 transition-all duration-300">
                  {isCollapsed ? (
                    <Separator className="w-full translate-y-2" />
                  ) : (
                    group.label
                  )}
                </h3>
                {group.items.map((item) => (
                  <Button
                    key={item.path}
                    asChild
                    variant={
                      location.pathname === item.path ? "default" : "ghost"
                    }
                    className="w-full justify-start"
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Link to={item.path}>
                      {item.icon}
                      {!isCollapsed && item.label}
                    </Link>
                  </Button>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-auto">
            <Separator className="my-4" />
            <Button
              asChild
              variant={location.pathname === "/settings" ? "default" : "ghost"}
              className={`w-full justify-start ${isCollapsed ? "px-2" : ""}`}
              title={isCollapsed ? "Settings" : undefined}
            >
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                {!isCollapsed && "Settings"}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">{children}</main>

      <Toaster />
    </div>
  );
}
