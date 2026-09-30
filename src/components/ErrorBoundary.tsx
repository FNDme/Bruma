import { Component, ErrorInfo, ReactNode, useState } from "react";
import { AlertTriangle, Home, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { clearAppData } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** "screen" fills the window (top level); "inline" fits inside the layout. */
  variant?: "screen" | "inline";
  /** When any value in this array changes, a caught error is cleared. */
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * A lazy page chunk that failed to load. React.lazy caches the rejection (and
 * browsers cache failed module fetches), so only a reload can recover.
 */
function isChunkLoadError(error: Error) {
  return (
    error.name === "ChunkLoadError" ||
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      error.message
    )
  );
}

function keysChanged(a: unknown[] = [], b: unknown[] = []) {
  return a.length !== b.length || a.some((item, i) => !Object.is(item, b[i]));
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (
      this.state.error &&
      keysChanged(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          variant={this.props.variant ?? "screen"}
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  variant: "screen" | "inline";
  onRetry: () => void;
}

function ErrorFallback({ error, variant, onRetry }: ErrorFallbackProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);

  const goHome = () => {
    // Full navigation: the router itself may be what failed.
    window.location.assign("/");
  };

  const reload = () => {
    window.location.reload();
  };

  const retry = isChunkLoadError(error) ? reload : onRetry;

  const resetData = () => {
    clearAppData();
    window.location.assign("/");
  };

  return (
    <div
      role="alert"
      className={cn(
        "flex items-center justify-center p-6 bg-background text-foreground",
        variant === "screen" ? "min-h-screen" : "h-full min-h-[60vh]"
      )}
    >
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Something went wrong
          </CardTitle>
          <CardDescription>
            Bruma hit an unexpected error while showing this screen. Your data
            has not been changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs text-muted-foreground">
            {error.message || String(error)}
          </pre>

          {confirmingReset && (
            <Alert variant="destructive">
              <AlertTitle>Erase all local app data?</AlertTitle>
              <AlertDescription>
                This permanently deletes your notes, folders, todos, routines,
                profile and theme stored on this device. It cannot be undone.
                Try reloading first if you have not already.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 justify-end">
          {confirmingReset ? (
            <>
              <Button
                variant="outline"
                onClick={() => setConfirmingReset(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={resetData}>
                <Trash2 className="mr-2 h-4 w-4" />
                Yes, erase data
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmingReset(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Reset app data
              </Button>
              <Button variant="outline" onClick={goHome}>
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
              <Button variant="outline" onClick={retry}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Try again
              </Button>
              <Button onClick={reload}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
