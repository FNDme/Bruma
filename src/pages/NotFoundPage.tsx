import { Link, useLocation } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 text-center gap-6">
      <Compass className="h-12 w-12 text-muted-foreground" />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">
          There is nothing at{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            {location.pathname}
          </code>
          .
        </p>
      </div>
      <Button asChild>
        <Link to="/">
          <Home className="mr-2 h-4 w-4" />
          Back to home
        </Link>
      </Button>
    </div>
  );
}
