import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useJournal } from "@/contexts/JournalContext";

/** Surfaces the journal's last storage error, if any. */
export function JournalErrorAlert() {
  const { error, clearError, loadNotes } = useJournal();
  if (!error) return null;

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Something went wrong with your notes</AlertTitle>
      <AlertDescription>
        <p>{error}</p>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={() => loadNotes()}>
            Reload notes
          </Button>
          <Button size="sm" variant="ghost" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
