import { Link, useLocation } from "react-router-dom";
import { Pencil, BookOpen, Settings } from "lucide-react";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-muted/50">
        <div className="flex h-full flex-col p-4">
          <div className="space-y-2">
            <Button
              asChild
              variant={location.pathname === "/write" ? "default" : "ghost"}
              className="w-full justify-start"
            >
              <Link to="/write">
                <Pencil className="mr-2 h-4 w-4" />
                Write
              </Link>
            </Button>
            <Button
              asChild
              variant={
                location.pathname === "/collection" ? "default" : "ghost"
              }
              className="w-full justify-start"
            >
              <Link to="/collection">
                <BookOpen className="mr-2 h-4 w-4" />
                Collection
              </Link>
            </Button>
          </div>

          {/* Settings button at the bottom */}
          <div className="mt-auto">
            <Separator className="my-4" />
            <Button
              asChild
              variant={location.pathname === "/settings" ? "default" : "ghost"}
              className="w-full justify-start"
            >
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
