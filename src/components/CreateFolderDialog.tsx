import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
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
  MAX_FOLDER_NAME_LENGTH,
  useJournal,
} from "@/contexts/JournalContext";

interface FolderNameFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  submittingLabel: string;
  initialName: string;
  /** Returns an error message or null. */
  validate: (name: string) => string | null;
  onSubmit: (name: string) => Promise<void>;
}

/** Shared name form for creating and renaming folders, with inline validation. */
function FolderNameDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  submittingLabel,
  initialName,
  validate,
  onSubmit,
}: FolderNameFormProps) {
  const [name, setName] = useState(initialName);
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setTouched(false);
      setSubmitError(null);
    }
  }, [open, initialName]);

  const validationError = validate(name);
  const shownError = submitError ?? (touched ? validationError : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (validationError) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(name.trim());
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <label htmlFor="folder-name" className="text-sm font-medium">
              Folder Name
            </label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setName(e.target.value);
                setTouched(true);
                setSubmitError(null);
              }}
              placeholder="Enter folder name"
              maxLength={MAX_FOLDER_NAME_LENGTH + 20}
              aria-invalid={shownError ? true : undefined}
              aria-describedby={shownError ? "folder-name-error" : undefined}
              disabled={isSubmitting}
              autoFocus
            />
            {shownError && (
              <p id="folder-name-error" className="text-sm text-destructive">
                {shownError}
              </p>
            )}
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
            <Button
              type="submit"
              disabled={isSubmitting || (touched && !!validationError)}
            >
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFolder: (name: string, parentId?: string) => Promise<void>;
  currentFolder?: Folder;
  /** Kept for compatibility; folder data now comes from the journal context. */
  folders?: Folder[];
}

export const CreateFolderDialog: React.FC<CreateFolderDialogProps> = ({
  open,
  onOpenChange,
  onCreateFolder,
  currentFolder,
}) => {
  const { validateFolderName, getFolderLabel } = useJournal();
  const parentId = currentFolder?.id;

  return (
    <FolderNameDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create New Folder"
      description={
        currentFolder
          ? `Location: ${getFolderLabel(currentFolder.id)}`
          : "Location: top level of your collection"
      }
      submitLabel="Create Folder"
      submittingLabel="Creating..."
      initialName=""
      validate={(name) => validateFolderName(name, parentId)}
      onSubmit={(name) => onCreateFolder(name, parentId)}
    />
  );
};

interface RenameFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder | null;
}

export const RenameFolderDialog: React.FC<RenameFolderDialogProps> = ({
  open,
  onOpenChange,
  folder,
}) => {
  const { validateFolderName, editFolder } = useJournal();

  if (!folder) return null;

  return (
    <FolderNameDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rename Folder"
      description={`Choose a new name for "${folder.name}".`}
      submitLabel="Rename"
      submittingLabel="Renaming..."
      initialName={folder.name}
      validate={(name) =>
        name.trim() === folder.name.trim()
          ? null
          : validateFolderName(name, folder.parentId, folder.id)
      }
      onSubmit={async (name) => {
        if (name === folder.name) return;
        await editFolder(folder.id, name);
        toast.success(`Folder renamed to "${name}"`);
      }}
    />
  );
};
