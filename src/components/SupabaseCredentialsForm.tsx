import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";

export function SupabaseCredentialsForm() {
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  // null while the keychain is being checked
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    checkCredentials();
  }, []);

  const checkCredentials = async () => {
    setError(null);
    try {
      const hasCreds = await invoke<boolean>("has_supabase_credentials");
      setHasCredentials(hasCreds);
    } catch (err) {
      console.error("Error checking credentials:", err);
      setError(errorMessage(err, "Failed to check credentials"));
      // Let the user re-enter credentials if the keychain could not be read
      setHasCredentials(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUrl = url.trim();
    const trimmedKey = anonKey.trim();
    if (!trimmedUrl || !trimmedKey) {
      setError("Please fill in all fields");
      return;
    }

    setIsBusy(true);
    try {
      await invoke("save_supabase_credentials", {
        request: { url: trimmedUrl, anon_key: trimmedKey },
      });
      setHasCredentials(true);
      setUrl("");
      setAnonKey("");
      toast.success("Supabase credentials saved");
    } catch (err) {
      console.error("Error saving credentials:", err);
      setError(errorMessage(err, "Failed to save credentials"));
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setIsBusy(true);
    try {
      await invoke("remove_supabase_credentials");
      setHasCredentials(false);
      setUrl("");
      setAnonKey("");
      toast.success("Supabase credentials removed");
    } catch (err) {
      console.error("Error removing credentials:", err);
      setError(errorMessage(err, "Failed to remove credentials"));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasCredentials === null ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-4 w-[240px]" />
          <Skeleton className="h-9 w-[160px]" />
        </div>
      ) : hasCredentials ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Supabase credentials are configured
          </p>
          <Button
            type="button"
            variant="destructive"
            onClick={handleRemove}
            disabled={isBusy}
          >
            Remove Credentials
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Supabase URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              type="url"
              inputMode="url"
              autoComplete="off"
              required
            />
            <p className="text-xs text-muted-foreground">
              Must start with https://
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="anonKey">Anonymous Key</Label>
            <Input
              id="anonKey"
              type="password"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="your-anon-key"
              required
            />
          </div>
          <Button type="submit" disabled={isBusy}>
            Save Credentials
          </Button>
        </form>
      )}
    </div>
  );
}
