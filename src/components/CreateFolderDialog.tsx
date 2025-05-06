import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Folder } from "@/contexts/JournalContext";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFolder: (name: string, parentId?: string) => Promise<void>;
  currentFolder?: Folder;
  folders: Folder[];
}

export const CreateFolderDialog: React.FC<CreateFolderDialogProps> = ({
  open,
  onOpenChange,
  onCreateFolder,
  currentFolder,
  folders,
}) => {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreateFolder(name, currentFolder?.id);
      setName("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFolderPath = (folder: Folder): string => {
    const path: string[] = [folder.name];
    let current = folder;

    while (current.parentId) {
      const parent = folders.find((f) => f.id === current.parentId);
      if (parent) {
        path.unshift(parent.name);
        current = parent;
      } else {
        break;
      }
    }

    return path.join(" > ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {currentFolder && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Location:</span>{" "}
              {getFolderPath(currentFolder)}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Folder Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              placeholder="Enter folder name"
              required
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
