import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  Folder,
  FolderDeleteMode,
  useJournal,
} from "@/contexts/JournalContext";
import { cn } from "@/lib/utils";

interface DeleteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder;
  /**
   * Called after a successful delete, with the chosen mode and the deleted
   * folder's parent id (captured before deletion).
   */
  onDeleted?: (mode: FolderDeleteMode, parentId?: string) => void;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export const DeleteFolderDialog: React.FC<DeleteFolderDialogProps> = ({
  open,
  onOpenChange,
  folder,
  onDeleted,
}) => {
  const { deleteFolder, getFolderStats, getFolderLabel } = useJournal();
  const [mode, setMode] = useState<FolderDeleteMode>("move-to-parent");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) setMode("move-to-parent");
  }, [open, folder.id]);

  const stats = getFolderStats(folder.id);
  const isEmpty = stats.noteCount === 0 && stats.subfolderCount === 0;
  const parentLabel = folder.parentId
    ? `"${getFolderLabel(folder.parentId)}"`
    : "the top level of your collection";

  const handleDelete = async () => {
    const parentId = folder.parentId;
    const effectiveMode: FolderDeleteMode = isEmpty ? "move-to-parent" : mode;
    setIsDeleting(true);
    try {
      await deleteFolder(folder.id, effectiveMode);
      toast.success(
        effectiveMode === "delete-all" && !isEmpty
          ? `Deleted "${folder.name}" and everything in it`
          : `Deleted folder "${folder.name}"`
      );
      onOpenChange(false);
      onDeleted?.(effectiveMode, parentId);
    } catch (err) {
      toast.error("Couldn't delete folder", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const options: {
    value: FolderDeleteMode;
    title: string;
    description: string;
  }[] = [
    {
      value: "move-to-parent",
      title: "Move contents to parent folder",
      description: `Only the folder is removed. Its ${plural(
        stats.directNoteCount,
        "note"
      )} and ${plural(
        stats.directSubfolderCount,
        "subfolder"
      )} move to ${parentLabel}, keeping their structure.`,
    },
    {
      value: "delete-all",
      title: "Delete everything",
      description: `Permanently deletes the folder, ${plural(
        stats.subfolderCount,
        "nested subfolder"
      )} and ${plural(stats.noteCount, "note")} inside them.`,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !isDeleting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{folder.name}"?</DialogTitle>
          <DialogDescription>
            {isEmpty
              ? "This folder is empty. Deleting it cannot be undone."
              : `This folder contains ${plural(
                  stats.noteCount,
                  "note"
                )} and ${plural(
                  stats.subfolderCount,
                  "subfolder"
                )} (including nested ones). Choose what happens to them.`}
          </DialogDescription>
        </DialogHeader>

        {!isEmpty && (
          <div role="radiogroup" className="space-y-2">
            {options.map((option) => {
              const selected = mode === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-md border p-3 transition-colors",
                    selected
                      ? option.value === "delete-all"
                        ? "border-destructive bg-destructive/5"
                        : "border-primary bg-primary/5"
                      : "hover:bg-accent"
                  )}
                >
                  <input
                    type="radio"
                    name="delete-folder-mode"
                    value={option.value}
                    checked={selected}
                    onChange={() => setMode(option.value)}
                    disabled={isDeleting}
                    className="mt-1 accent-current"
                  />
                  <span className="space-y-1">
                    <span className="block text-sm font-medium">
                      {option.title}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting
              ? "Deleting..."
              : mode === "delete-all" && !isEmpty
              ? "Delete everything"
              : "Delete folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
