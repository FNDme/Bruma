import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

interface UnlockVaultPageProps {
  onUnlock: (password: string) => Promise<boolean>;
  onReset: () => Promise<void>;
}

export const UnlockVaultPage: React.FC<UnlockVaultPageProps> = ({
  onUnlock,
  onReset,
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const success = await onUnlock(password);
      if (!success) {
        setError("Invalid password");
      }
    } catch (error) {
      setError("Failed to unlock vault");
    }
  };

  const handleReset = async () => {
    try {
      await onReset();
      setShowResetDialog(false);
    } catch (error) {
      setError("Failed to reset vault");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Unlock Vault</h1>
          <p className="mt-2 text-muted-foreground">
            Enter your password to access your secure notes
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Unlock
          </Button>
        </form>

        <div className="text-center">
          <Button
            variant="link"
            className="text-destructive"
            onClick={() => setShowResetDialog(true)}
          >
            Forgot Password? Reset Vault
          </Button>
        </div>
      </div>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Vault</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all your notes and allow you to set a
            new password. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              Reset Vault
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
