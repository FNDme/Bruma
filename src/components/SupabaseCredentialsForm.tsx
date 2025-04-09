import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export function SupabaseCredentialsForm() {
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [hasCredentials, setHasCredentials] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkCredentials();
  }, []);

  const checkCredentials = async () => {
    try {
      const hasCreds = await invoke<boolean>("has_supabase_credentials");
      setHasCredentials(hasCreds);
    } catch (err) {
      console.error("Error checking credentials:", err);
      setError(
        err instanceof Error ? err.message : "Failed to check credentials"
      );
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
    if (!url || !anonKey) {
      setError("Please fill in all fields");
      return;
    }

    try {
      await invoke("save_supabase_credentials", {
        request: { url, anon_key: anonKey },
      });
      setHasCredentials(true);
    } catch (err) {
      console.error("Error saving credentials:", err);
      setError(
        err instanceof Error ? err.message : "Failed to save credentials"
      );
    }
  };

  const handleRemove = async () => {
    setError(null);
    try {
      await invoke("remove_supabase_credentials");
      setHasCredentials(false);
      setUrl("");
      setAnonKey("");
    } catch (err) {
      console.error("Error removing credentials:", err);
      setError(
        err instanceof Error ? err.message : "Failed to remove credentials"
      );
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

      {hasCredentials ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Supabase credentials are configured
          </p>
          <Button variant="destructive" onClick={handleRemove}>
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
              required
            />
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
          <Button type="submit">Save Credentials</Button>
        </form>
      )}
    </div>
  );
}
